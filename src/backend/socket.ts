import { buildWebSocketConnectUrl } from './urls';

type SocketHandler = (event: string, data: unknown) => void | Promise<void>;

type AddonWebSocket = {
  On: (
    event: 'open' | 'message' | 'close' | 'error',
    handler: (payload: unknown) => void
  ) => void;
  Send: (data: string) => void;
  Close: (code?: number, reason?: string) => void;
  Destroy: () => void;
};

type EngineOpenPayload = {
  sid?: string;
  pingInterval?: number;
  pingTimeout?: number;
};

/**
 * Strips Socket.IO namespace prefix from a packet payload.
 * @param payload Socket.IO payload after Engine.IO message type.
 * @example parseNamespacedPayload('2/streamkit-balance,["evt",{}]') → '["evt",{}]'
 */
const parseNamespacedPayload = (payload: string) => {
  if (!payload.startsWith('/')) {
    return payload;
  }

  const commaIndex = payload.indexOf(',');
  return commaIndex >= 0 ? payload.slice(commaIndex + 1) : '';
};

/**
 * Minimal Socket.IO v4 client over `network.websocket` (websocket transport only).
 */
export class BalanceSocketClient {
  private activeSocket: AddonWebSocket | null = null;
  private namespaceConnected = false;
  private handlers = new Set<SocketHandler>();
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly namespacePacketPrefix: string;
  private auth: Record<string, unknown>;
  private readonly socketPath: string;
  private readonly hostBase: string;
  private onReconnect: (() => void | Promise<void>) | null = null;
  private intentionalClose = false;
  private pingInterval = 25_000;
  private lastPacketAt = 0;

  /**
   * @param hostBase API origin, e.g. `https://rocketman-streams.com:443`.
   * @param socketPath Socket.IO HTTP path.
   * @param namespace Socket.IO namespace, e.g. `/streamkit-balance`.
   * @param auth Auth payload sent on namespace connect.
   */
  constructor(
    hostBase: string,
    socketPath: string,
    namespace: string,
    auth: Record<string, unknown>
  ) {
    this.hostBase = hostBase.replace(/\/$/, '');
    this.socketPath = socketPath;
    const normalizedNamespace = namespace.startsWith('/')
      ? namespace
      : `/${namespace}`;
    this.namespacePacketPrefix = normalizedNamespace;
    this.auth = auth;
  }

  /** Updates namespace auth payload (e.g. after session refresh). */
  updateAuth(auth: Record<string, unknown>) {
    this.auth = auth;
  }

  /**
   * Registers callback fired after reconnect (full resync expected).
   * @param hook Resync hook.
   */
  setReconnectHook(hook: (() => void | Promise<void>) | null) {
    this.onReconnect = hook;
  }

  /** Subscribes to Socket.IO events from the server. */
  onEvent(handler: SocketHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** Emits a Socket.IO event to the server. */
  emit(event: string, data: unknown) {
    if (!this.activeSocket || !this.namespaceConnected) {
      return;
    }
    this.activeSocket.Send(
      `42${this.namespacePacketPrefix},${JSON.stringify([event, data])}`
    );
  }

  /** Opens websocket transport and connects namespace. */
  async connect() {
    this.clearReconnect();
    this.intentionalClose = false;
    this.namespaceConnected = false;
    this.stopPing();

    const previousSocket = this.activeSocket;
    this.activeSocket = null;
    previousSocket?.Destroy();

    const url = buildWebSocketConnectUrl(this.hostBase, this.socketPath);
    console.log('[balance] socket connect →', url);

    const socket = await network.websocket.connect(url);
    this.activeSocket = socket;

    socket.On('message', (raw: unknown) => {
      if (this.activeSocket !== socket) {
        return;
      }
      this.lastPacketAt = Date.now();
      this.handlePacket(String(raw), socket);
    });

    socket.On('close', (payload: unknown) => {
      if (this.activeSocket !== socket) {
        return;
      }

      this.namespaceConnected = false;
      this.stopPing();
      this.activeSocket = null;

      const closeInfo =
        payload && typeof payload === 'object'
          ? (payload as { code?: number; reason?: string })
          : undefined;
      console.warn(
        '[balance] socket closed',
        closeInfo?.code ?? '',
        closeInfo?.reason ?? ''
      );

      if (!this.intentionalClose) {
        this.scheduleReconnect();
      }
    });

    socket.On('error', (error: unknown) => {
      if (this.activeSocket !== socket) {
        return;
      }
      console.error('[balance] socket error:', error);
    });
  }

  /** Closes the connection and cancels reconnect. */
  destroy() {
    this.intentionalClose = true;
    this.clearReconnect();
    this.stopPing();
    this.namespaceConnected = false;
    this.activeSocket?.Destroy();
    this.activeSocket = null;
  }

  private handlePacket(packet: string, socket: AddonWebSocket) {
    const engineType = packet.charAt(0);
    const payload = packet.slice(1);

    if (engineType === '0') {
      this.handleEngineOpen(payload, socket);
      return;
    }

    if (engineType === '1') {
      console.warn('[balance] engine close packet');
      return;
    }

    if (engineType === '2') {
      socket.Send(payload === 'probe' ? '3probe' : '3');
      return;
    }

    if (engineType === '3') {
      return;
    }

    if (engineType !== '4') {
      return;
    }

    const socketIoType = payload.charAt(0);
    const socketIoPayload = parseNamespacedPayload(payload.slice(1));

    if (socketIoType === '0') {
      this.namespaceConnected = true;
      this.startPing();
      console.log('[balance] socket namespace connected');
      return;
    }

    if (socketIoType === '1') {
      console.warn('[balance] namespace disconnected:', socketIoPayload);
      this.namespaceConnected = false;
      this.stopPing();
      return;
    }

    if (socketIoType === '4') {
      console.error('[balance] namespace error:', socketIoPayload);
      this.namespaceConnected = false;
      this.stopPing();
      return;
    }

    if (socketIoType !== '2' || !socketIoPayload.startsWith('[')) {
      return;
    }

    try {
      const parsed = JSON.parse(socketIoPayload) as [string, unknown];
      const event = parsed[0];
      const eventData = parsed[1];
      if (typeof event !== 'string') {
        return;
      }

      for (const handler of this.handlers) {
        void handler(event, eventData);
      }
    } catch (error) {
      console.error('[balance] invalid socket event:', error, socketIoPayload);
    }
  }

  private handleEngineOpen(payload: string, socket: AddonWebSocket) {
    try {
      const open = JSON.parse(payload) as EngineOpenPayload;
      if (Number.isFinite(open.pingInterval) && open.pingInterval! > 0) {
        this.pingInterval = open.pingInterval!;
      }
    } catch {
      // Keep default ping interval when handshake JSON is unexpected.
    }

    socket.Send(
      `40${this.namespacePacketPrefix},${JSON.stringify(this.auth)}`
    );
  }

  private startPing() {
    this.stopPing();
    this.lastPacketAt = Date.now();

    const tickMs = Math.max(5_000, Math.min(this.pingInterval, 15_000));
    this.pingTimer = setInterval(() => {
      if (!this.activeSocket || !this.namespaceConnected) {
        return;
      }

      const idleMs = Date.now() - this.lastPacketAt;
      if (idleMs < this.pingInterval - 2_000) {
        return;
      }

      try {
        this.activeSocket.Send('2');
      } catch (error) {
        console.warn('[balance] socket ping failed:', error);
      }
    }, tickMs);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || this.intentionalClose) {
      return;
    }

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        if (this.onReconnect) {
          await this.onReconnect();
        }
        await this.connect();
      } catch (error) {
        console.error('[balance] socket reconnect failed:', error);
        this.scheduleReconnect();
      }
    }, 3_000);
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

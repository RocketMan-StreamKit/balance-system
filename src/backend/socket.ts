import { buildWebSocketConnectUrl } from './urls';

type SocketHandler = (event: string, data: unknown) => void | Promise<void>;

/** Why the socket client is scheduling a reconnect. */
export type BalanceSocketReconnectReason =
  | 'transport'
  | 'namespace'
  | 'connect_error'
  | 'auth_rejected';

/** Context passed to the reconnect hook before opening a new socket. */
export type BalanceSocketReconnectContext = {
  /** 1-based reconnect attempt since the last stable connection. */
  attempt: number;
  /** Previous namespace session ended within a few seconds of connect. */
  quickDisconnect: boolean;
  /** Disconnect / error that triggered this reconnect attempt. */
  reason: BalanceSocketReconnectReason;
};

type ReconnectHook = (
  context: BalanceSocketReconnectContext
) => void | Promise<void>;
type NamespaceConnectedHook = () => void | Promise<void>;

type AddonWebSocket = {
  /** `0` connecting, `1` open, `2` closing, `3` closed. */
  readonly state: 0 | 1 | 2 | 3;
  On: (
    event: 'open' | 'message' | 'close' | 'error',
    handler: (payload: unknown) => void
  ) => void;
  Send: (data: string) => void;
  Close: (code?: number, reason?: string) => void;
  Destroy: () => void;
};

/** WebSocket readyState value for an open connection. */
const WS_OPEN = 1 as const;

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
  private onReconnect: ReconnectHook | null = null;
  private onNamespaceConnected: NamespaceConnectedHook | null = null;
  private intentionalClose = false;
  private pingInterval = 25_000;
  private lastPacketAt = 0;
  private reconnectAttempt = 0;
  private lastNamespaceConnectedAt = 0;
  private pendingNamespaceClose = false;
  private pendingAuthRejected = false;
  private lastReconnectReason: BalanceSocketReconnectReason = 'transport';
  private stableConnectionTimer: ReturnType<typeof setTimeout> | null = null;
  private static readonly RECONNECT_BASE_MS = 3_000;
  private static readonly RECONNECT_MAX_MS = 60_000;
  private static readonly STABLE_CONNECTION_MS = 15_000;
  private static readonly QUICK_DISCONNECT_MS = 5_000;

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
  setReconnectHook(hook: ReconnectHook | null) {
    this.onReconnect = hook;
  }

  /**
   * Registers callback fired when the namespace handshake succeeds.
   * @param hook Called after `connect` packet is acknowledged by the server.
   */
  setNamespaceConnectedHook(hook: NamespaceConnectedHook | null) {
    this.onNamespaceConnected = hook;
  }

  /** Subscribes to Socket.IO events from the server. */
  onEvent(handler: SocketHandler) {
    this.handlers.add(handler);
    return () => this.handlers.delete(handler);
  }

  /** Emits a Socket.IO event to the server. */
  emit(event: string, data: unknown) {
    const socket = this.activeSocket;
    if (!socket || !this.namespaceConnected || !this.isSocketOpen(socket)) {
      return;
    }
    try {
      socket.Send(
        `42${this.namespacePacketPrefix},${JSON.stringify([event, data])}`
      );
    } catch (error) {
      console.warn('[balance] socket emit failed:', error);
      this.markTransportDead(socket);
    }
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
    if (this.reconnectAttempt <= 1) {
      console.log('[balance] socket connect →', url);
    } else {
      console.warn(
        `[balance] socket reconnect attempt ${this.reconnectAttempt} →`,
        url
      );
    }

    let socket: AddonWebSocket;
    try {
      socket = await network.websocket.connect(url);
    } catch (error) {
      console.error('[balance] socket connect error:', error);
      if (!this.intentionalClose) {
        this.scheduleReconnect('connect_error');
      }
      return;
    }

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

      const initiatedByNamespace = this.pendingNamespaceClose;
      const authRejected = this.pendingAuthRejected;
      this.pendingNamespaceClose = false;
      this.pendingAuthRejected = false;

      if (!this.intentionalClose && !initiatedByNamespace) {
        const closeInfo =
          payload && typeof payload === 'object'
            ? (payload as { code?: number; reason?: string })
            : undefined;
        console.warn(
          '[balance] socket closed unexpectedly',
          closeInfo?.code ?? '',
          closeInfo?.reason ?? ''
        );
      }

      if (!this.intentionalClose) {
        const reason = authRejected
          ? 'auth_rejected'
          : initiatedByNamespace
            ? 'namespace'
            : 'transport';
        this.scheduleReconnect(reason);
      }
    });

    socket.On('error', (error: unknown) => {
      if (this.activeSocket !== socket) {
        return;
      }
      console.error('[balance] socket error:', error);
      if (!this.intentionalClose && !this.reconnectTimer) {
        this.scheduleReconnect('connect_error');
      }
    });
  }

  /** Closes the connection and cancels reconnect. */
  destroy() {
    this.intentionalClose = true;
    this.clearReconnect();
    this.clearStableConnectionTimer();
    this.stopPing();
    this.namespaceConnected = false;
    this.pendingAuthRejected = false;
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
      if (!this.isSocketOpen(socket)) {
        this.markTransportDead(socket);
        return;
      }
      try {
        socket.Send(payload === 'probe' ? '3probe' : '3');
      } catch (error) {
        console.warn('[balance] socket pong failed:', error);
        this.markTransportDead(socket);
      }
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
      this.lastNamespaceConnectedAt = Date.now();
      this.startPing();
      this.scheduleStableConnectionReset();
      console.log('[balance] socket namespace connected');
      if (this.onNamespaceConnected) {
        void this.onNamespaceConnected();
      }
      return;
    }

    if (socketIoType === '1') {
      const reason = this.formatNamespaceDisconnectReason(socketIoPayload);
      console.warn('[balance] namespace disconnected', reason);
      this.namespaceConnected = false;
      this.stopPing();
      this.closeAfterNamespaceEnd();
      return;
    }

    if (socketIoType === '4') {
      console.error(
        '[balance] namespace connect rejected:',
        this.formatNamespaceDisconnectReason(socketIoPayload)
      );
      this.namespaceConnected = false;
      this.stopPing();
      this.pendingAuthRejected = true;
      this.closeAfterNamespaceEnd();
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

    if (!this.isSocketOpen(socket)) {
      this.markTransportDead(socket);
      return;
    }

    try {
      socket.Send(
        `40${this.namespacePacketPrefix},${JSON.stringify(this.auth)}`
      );
    } catch (error) {
      console.warn('[balance] socket namespace connect send failed:', error);
      this.markTransportDead(socket);
    }
  }

  private startPing() {
    this.stopPing();
    this.lastPacketAt = Date.now();

    const tickMs = Math.max(5_000, Math.min(this.pingInterval, 15_000));
    this.pingTimer = setInterval(() => {
      const socket = this.activeSocket;
      if (!socket || !this.namespaceConnected) {
        return;
      }

      if (!this.isSocketOpen(socket)) {
        console.warn('[balance] socket not open during ping, reconnecting');
        this.markTransportDead(socket);
        return;
      }

      const idleMs = Date.now() - this.lastPacketAt;
      if (idleMs < this.pingInterval - 2_000) {
        return;
      }

      try {
        socket.Send('2');
      } catch (error) {
        console.warn('[balance] socket ping failed:', error);
        this.markTransportDead(socket);
      }
    }, tickMs);
  }

  /**
   * Returns whether the sandbox WebSocket is in the open readyState.
   * @param socket Addon WebSocket handle from `network.websocket.connect`.
   * @example this.isSocketOpen(socket) → true
   */
  private isSocketOpen(socket: AddonWebSocket) {
    return socket.state === WS_OPEN;
  }

  /**
   * Tears down a dead transport without waiting for a delayed `close` event.
   * Always `Destroy()`s the socket so the host connection slot is released.
   * @param socket Socket that failed Send / left the open state.
   * @param reason Reconnect reason recorded for the next attempt.
   * @example this.markTransportDead(socket, 'transport');
   */
  private markTransportDead(
    socket: AddonWebSocket,
    reason: BalanceSocketReconnectReason = 'transport'
  ) {
    if (this.intentionalClose) {
      return;
    }

    this.namespaceConnected = false;
    this.stopPing();

    if (this.activeSocket === socket) {
      this.activeSocket = null;
    }

    try {
      socket.Destroy();
    } catch (error) {
      console.warn('[balance] socket destroy failed:', error);
    }

    this.scheduleReconnect(reason);
  }

  private stopPing() {
    if (this.pingTimer) {
      clearInterval(this.pingTimer);
      this.pingTimer = null;
    }
  }

  private scheduleReconnect(reason: BalanceSocketReconnectReason) {
    if (this.reconnectTimer || this.intentionalClose) {
      return;
    }

    this.lastReconnectReason = reason;
    this.reconnectAttempt += 1;
    const delayMs = this.getReconnectDelayMs();
    if (this.reconnectAttempt === 1) {
      console.warn(
        `[balance] socket disconnected (${reason}), reconnect in ${Math.round(delayMs / 1000)}s`
      );
    } else if (this.reconnectAttempt % 3 === 0) {
      console.warn(
        `[balance] socket still offline, retry ${this.reconnectAttempt} in ${Math.round(delayMs / 1000)}s`
      );
    }

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        if (this.onReconnect) {
          await this.onReconnect(this.buildReconnectContext());
        }
        await this.connect();
      } catch (error) {
        console.error('[balance] socket reconnect failed:', error);
        this.scheduleReconnect('transport');
      }
    }, delayMs);
  }

  private buildReconnectContext(): BalanceSocketReconnectContext {
    const connectedAt = this.lastNamespaceConnectedAt;
    const quickDisconnect =
      connectedAt > 0 &&
      Date.now() - connectedAt < BalanceSocketClient.QUICK_DISCONNECT_MS;

    return {
      attempt: this.reconnectAttempt,
      quickDisconnect,
      reason: this.lastReconnectReason,
    };
  }

  private getReconnectDelayMs() {
    const exponential = Math.min(
      BalanceSocketClient.RECONNECT_MAX_MS,
      BalanceSocketClient.RECONNECT_BASE_MS *
        2 ** Math.max(0, this.reconnectAttempt - 1)
    );
    const jitterMs = Math.floor(Math.random() * 1_000);
    return exponential + jitterMs;
  }

  private scheduleStableConnectionReset() {
    this.clearStableConnectionTimer();
    this.stableConnectionTimer = setTimeout(() => {
      this.stableConnectionTimer = null;
      this.reconnectAttempt = 0;
    }, BalanceSocketClient.STABLE_CONNECTION_MS);
  }

  private closeAfterNamespaceEnd() {
    this.pendingNamespaceClose = true;
    this.closeActiveSocket();
  }

  private closeActiveSocket() {
    const socket = this.activeSocket;
    if (!socket) {
      return;
    }

    try {
      socket.Close();
    } catch (error) {
      console.warn('[balance] socket close failed:', error);
    }
  }

  private formatNamespaceDisconnectReason(payload: string) {
    const trimmed = payload.trim();
    if (!trimmed) {
      return '(no reason)';
    }

    try {
      const parsed = JSON.parse(trimmed) as { message?: string };
      if (typeof parsed.message === 'string' && parsed.message.trim()) {
        return parsed.message.trim();
      }
    } catch {
      // Plain-text disconnect reason from server.
    }

    return trimmed;
  }

  private clearStableConnectionTimer() {
    if (this.stableConnectionTimer) {
      clearTimeout(this.stableConnectionTimer);
      this.stableConnectionTimer = null;
    }
  }

  private clearReconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

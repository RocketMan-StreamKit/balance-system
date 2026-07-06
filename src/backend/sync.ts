import {
  BALANCE_SOCKET_NAMESPACE,
  BALANCE_SOCKET_PATH,
} from '../constants';
import type {
  BalanceSpendCommand,
  BalanceSyncPayload,
} from '../types';
import { resolveBalanceCurrency } from '../balance/currency';
import { loadParams, saveParams } from '../balance/store';
import { getBroadcasterProfile } from '../twitch/api';
import { buildSyncCatalog } from '../triggers/catalog';
import { executeSpendCommand } from '../triggers/dispatch';
import { buildApiUrl, resolveApiBaseUrl } from './urls';
import { BalanceSocketClient } from './socket';
import { parseRegisterResponse, resolveLicenseAuth } from './register';

let socketClient: BalanceSocketClient | null = null;

const buildSocketAuth = (params: {
  session_token: string;
  license_id: string;
}) => ({
  sessionToken: params.session_token,
  licenseId: params.license_id,
});

/**
 * Builds the payload sent to the balance backend.
 * @example const payload = await buildSyncPayload();
 */
export const buildSyncPayload = async (): Promise<BalanceSyncPayload | null> => {
  const params = await loadParams();
  const streamer = await getBroadcasterProfile();
  if (!streamer) {
    return null;
  }

  const currencyCode = await resolveBalanceCurrency();
  const catalog = await buildSyncCatalog(params);

  return {
    licenseId: params.license_id,
    sessionToken: params.session_token,
    streamer: {
      displayName: streamer.displayName,
      avatar: streamer.avatar,
      login: streamer.login,
    },
    currency: String(currencyCode),
    viewers: params.viewers.map((viewer: { twitchId: string; login: string; displayName: string; balance: number }) => ({
      twitchId: viewer.twitchId,
      login: viewer.login,
      displayName: viewer.displayName,
      balance: viewer.balance,
    })),
    addons: catalog.addons,
    sounds: catalog.sounds,
    categories: catalog.categories,
    allowSpendMessage: params.allow_spend_message,
  };
};

/**
 * Registers the addon session on the balance backend.
 * @returns Registration result with session token and viewer page URL.
 */
export const registerBackendSession = async () => {
  const params = await loadParams();
  const streamer = await getBroadcasterProfile({ force: true });
  if (!streamer) {
    throw new Error(
      'Twitch broadcaster profile is unavailable. Enable the Twitch addon and authorize your account.'
    );
  }

  const url = await buildApiUrl('/register', params);
  const licenseAuth = resolveLicenseAuth();
  const body = {
    ...licenseAuth,
    streamer,
  };

  console.log('[balance] register →', url);

  const response = await network.request.post(url, body);
  const parsed = parseRegisterResponse(url, response);

  await saveParams({
    session_token: parsed.sessionToken,
    license_id: parsed.licenseId ?? params.license_id,
    viewer_page_url: parsed.viewerPageUrl ?? params.viewer_page_url,
  });

  return parsed;
};

/**
 * Pushes the current balance state to the backend (in-memory store on server).
 */
export const syncStateToBackend = async () => {
  const payload = await buildSyncPayload();
  if (!payload?.sessionToken) {
    return { success: false as const, message: 'Not registered' };
  }

  const url = await buildApiUrl('/sync');
  const response = await network.request.post(url, payload);
  const parsed = JSON.parse(response) as { success?: boolean; message?: string };
  return parsed.success
    ? { success: true as const }
    : { success: false as const, message: parsed.message };
};

/**
 * Connects Socket.IO to receive spend commands from viewers.
 */
export const connectBalanceSocket = async () => {
  const params = await loadParams();
  if (!params.session_token) {
    await registerBackendSession();
  }

  const refreshed = await loadParams();
  const host = await resolveApiBaseUrl(refreshed);
  socketClient?.destroy();

  socketClient = new BalanceSocketClient(
    host,
    BALANCE_SOCKET_PATH,
    BALANCE_SOCKET_NAMESPACE,
    buildSocketAuth(refreshed)
  );

  socketClient.setReconnectHook(async () => {
    await registerBackendSession();
    const params = await loadParams();
    socketClient?.updateAuth(buildSocketAuth(params));
    await syncStateToBackend();
  });

  socketClient.onEvent(async (event, payload) => {
    if (event !== 'balance:spend') {
      return;
    }

    const command = payload as BalanceSpendCommand;
    const result = await executeSpendCommand(command);
    socketClient?.emit('balance:spend-result', {
      requestId: command.requestId,
      ...result,
    });

    if (result.success) {
      await syncStateToBackend();
    }
  });

  await socketClient.connect();
};

/** Tears down backend socket connection. */
export const disconnectBalanceSocket = () => {
  socketClient?.destroy();
  socketClient = null;
};

/**
 * Full startup: register, sync state, open socket.
 */
export const startBackendConnection = async () => {
  try {
    status.Update({
      current: 'connecting',
      message: {
        en: 'Connecting to balance server…',
        ru: 'Подключение к серверу баланса…',
        uk: 'Підключення до сервера балансу…',
      },
    });

    await registerBackendSession();
    await syncStateToBackend();

    try {
      await connectBalanceSocket();
    } catch (socketError) {
      const socketMessage =
        socketError instanceof Error ? socketError.message : 'Socket connection failed';
      console.error('[balance] socket connection failed:', socketMessage, socketError);
      status.Update({
        current: 'error',
        message: {
          en: `Registered, but socket failed: ${socketMessage}`,
          ru: `Регистрация прошла, но сокет не подключился: ${socketMessage}`,
          uk: `Реєстрація пройшла, але сокет не підключився: ${socketMessage}`,
        },
      });
      notify.Send({
        id: `${data.id}_backend_socket_error`,
        type: 'warning',
        title: {
          en: 'Balance server',
          ru: 'Сервер баланса',
          uk: 'Сервер балансу',
        },
        message: {
          en: `Session registered, but realtime connection failed: ${socketMessage}`,
          ru: `Сессия зарегистрирована, но realtime-соединение не установлено: ${socketMessage}`,
          uk: `Сесію зареєстровано, але realtime-з'єднання не встановлено: ${socketMessage}`,
        },
      });
      return;
    }

    status.Update({
      current: 'online',
      message: {
        en: 'Balance server connected',
        ru: 'Сервер баланса подключён',
        uk: 'Сервер балансу підключено',
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Backend registration failed';
    console.error('[balance] backend connection failed:', message, error);
    status.Update({
      current: 'error',
      message: {
        en: 'Balance server error',
        ru: 'Ошибка сервера баланса',
        uk: 'Помилка сервера балансу',
      },
    });

    notify.Send({
      id: `${data.id}_backend_error`,
      type: 'error',
      title: {
        en: 'Balance server',
        ru: 'Сервер баланса',
        uk: 'Сервер балансу',
      },
      message: {
        en: message,
        ru: message,
        uk: message,
      },
    });
  }
};

/**
 * Resync after local balance changes.
 */
export const resyncBackend = async () => {
  const result = await syncStateToBackend();
  if (!result.success) {
    console.warn('[balance] resync failed:', result.message);
  }
};

import {
  AUTH_SERVER_LOCAL_URL,
  AUTH_SERVER_RU_URL,
  BALANCE_API_PATH,
  DEFAULT_API_SERVER,
} from '../constants';
import type { BalanceAddonParams } from '../types';
import { loadParams } from '../balance/store';

type AppConfig = {
  proxy?: boolean;
  localDevelopEndpoint?: boolean;
};

/**
 * Resolves the balance backend base URL (origin only).
 * @param params Addon params.
 * @param appConfig App config from CONFIG_READ.
 */
export const resolveApiBaseUrl = async (
  params?: BalanceAddonParams,
  appConfig?: AppConfig | null
) => {
  const current = params ?? (await loadParams());

  if (isDeveloperMode && current.api_server_override) {
    return current.api_server_override.replace(/\/$/, '');
  }

  const cfg = appConfig ?? ((await api.config.getConfig()) as AppConfig | null);

  if (
    isDeveloperMode &&
    cfg?.localDevelopEndpoint &&
    current.api_server_override === DEFAULT_API_SERVER
  ) {
    return AUTH_SERVER_LOCAL_URL;
  }

  return cfg?.proxy ? AUTH_SERVER_RU_URL : DEFAULT_API_SERVER;
};

/**
 * Builds full REST URL for a balance backend path.
 * @param path Path after BALANCE_API_PATH.
 * @param params Optional addon params.
 */
export const buildApiUrl = async (
  path: string,
  params?: BalanceAddonParams
) => {
  const base = await resolveApiBaseUrl(params);
  const suffix = path.startsWith('/') ? path : `/${path}`;
  return `${base}${BALANCE_API_PATH}${suffix}`;
};

/**
 * Builds Engine.IO websocket URL with an explicit port so sandbox URL checks pass.
 * @param hostBase API origin, e.g. `https://local.rocketman-streams.com:443`.
 * @param socketPath Socket.IO HTTP path.
 */
export const buildWebSocketConnectUrl = (
  hostBase: string,
  socketPath: string
) => {
  const base = new URL(hostBase);
  const port =
    base.port ||
    (base.protocol === 'https:'
      ? '443'
      : base.protocol === 'http:'
        ? '80'
        : '443');
  const path = socketPath.startsWith('/') ? socketPath : `/${socketPath}`;
  return `wss://${base.hostname}:${port}${path}/?EIO=4&transport=websocket`;
};

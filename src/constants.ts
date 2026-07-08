/** Stable addon identifier from manifest.json. */
export const ADDON_ID = 'balance-system';

/** Default page size for the in-app viewer list. */
export const VIEWERS_PAGE_SIZE = 30;

/** Maximum page size accepted by the viewer list API. */
export const VIEWERS_PAGE_MAX = 500;

/** Viewer page grouping id for sound actions (not an installable addon). */
export const SOUNDS_CATALOG_GROUP = 'streamkit-balance:sounds' as const;

/** 1×1 transparent PNG used when an addon icon cannot be loaded. */
export const FALLBACK_LOGO_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

/** Shared sounds section metadata for the viewer page sync payload. */
export const SOUNDS_SECTION_META = {
  name: {
    en: 'Sounds',
    ru: 'Звуки',
    uk: 'Звуки',
  },
  description: {
    en: 'Spend balance to play sounds on stream',
    ru: 'Тратьте баланс на звуки на стриме',
    uk: 'Витрачайте баланс на звуки на стрімі',
  },
  logoBase64:
    'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0iI2ZmZmZmZiI+PHBhdGggZD0iTTMgOXY2aDRsNSA1VjRMNyA5SDN6bTEzLjUgM2MwLTEuNzctMS4wMi0zLjI5LTIuNS00LjAzdjguMDVjMS40OC0uNzMgMi41LTIuMjUgMi41LTQuMDJ6TTE0IDMuMjN2Mi4wNmMyLjg5Ljg2IDUgMy41NCA1IDYuNzFzLTIuMTEgNS44NS01IDYuNzF2Mi4wNmM0LjAxLS45MSA3LTQuNDkgNy04Ljc3cy0yLjk5LTcuODYtNy04Ljc3eiIvPjwvc3ZnPg==',
} as const;

/** Maximum length of an optional viewer message on site spend. */
export const SPEND_MESSAGE_MAX_LENGTH = 200;

/** Twitch platform addon id (RocketMan-StreamKit catalog). */
export const TWITCH_ADDON_ID = 'twitch';

/** Default API host when app proxy is disabled. */
export const DEFAULT_API_SERVER = 'https://rocketman-streams.com:443';

/** API host when app proxy is enabled. */
export const AUTH_SERVER_RU_URL = 'https://ru.rocketman-streams.com:443';

/** Local development API host (developer mode only). */
export const AUTH_SERVER_LOCAL_URL = 'https://local.rocketman-streams.com:443';

/** REST API path prefix for the balance backend. */
export const BALANCE_API_PATH = '/api/streamkit-balance';

/** Socket.IO HTTP path on the balance backend. */
export const BALANCE_SOCKET_PATH = '/api/streamkit-balance/socket.io';

/** Socket.IO namespace for addon sessions. */
export const BALANCE_SOCKET_NAMESPACE = '/streamkit-balance';

/**
 * Currencies available in addon settings.
 * Conversion uses the app exchange rates via `currency.convert`.
 */
export const SUPPORTED_CURRENCIES = [
  'USD',
  'RUB',
  'UAH',
  'EUR',
  'KZT',
  'BYN',
] as const;

export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number];

/**
 * Builds API server select options for developer settings.
 * @param includeLocalhost When true, includes the local dev server URL.
 * @example buildAuthServerSelectOptions(isDeveloperMode)
 */
export const buildAuthServerSelectOptions = (includeLocalhost: boolean) => {
  const urlLabel = (url: string) => ({
    en: url,
    ru: url,
    uk: url,
  });

  const options = [
    { value: DEFAULT_API_SERVER, label: urlLabel(DEFAULT_API_SERVER) },
    { value: AUTH_SERVER_RU_URL, label: urlLabel(AUTH_SERVER_RU_URL) },
  ];

  if (includeLocalhost) {
    options.push({
      value: AUTH_SERVER_LOCAL_URL,
      label: urlLabel(AUTH_SERVER_LOCAL_URL),
    });
  }

  return options;
};

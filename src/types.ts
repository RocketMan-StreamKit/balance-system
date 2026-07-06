import type { SupportedCurrency } from './constants';

/** Localized string object accepted by addon APIs. */
export type LocalizedText = {
  en: string;
  ru?: string;
  uk?: string;
};

/** Viewer balance entry stored in addon params. */
export type ViewerEntry = {
  /** Twitch user id (numeric string). */
  twitchId: string;
  /** Lowercase Twitch login. */
  login: string;
  /** Display name shown in UI (updated on resolve). */
  displayName: string;
  /** Balance in the configured addon currency. */
  balance: number;
  /** Last update timestamp (ms). */
  updatedAt: number;
};

/** Shop category for the viewer web page. */
export type BalanceCategory = {
  id: string;
  name: LocalizedText;
};

/** Purchasable trigger exposed on the viewer web page. */
export type BalanceShopItem = {
  id: string;
  categoryId: string;
  price: number;
  name: LocalizedText;
  description: LocalizedText;
  /** Viewer page card group: overlay/game addon or shared sounds block. */
  catalogGroup: 'addon' | 'sounds';
  addonId: string;
  trigger: {
    type: 'donation' | 'subscribe' | 'subgift' | 'follow' | 'custom';
    key?: string;
    value?: string | number | boolean;
  };
};

/** Addon params persisted via GenerateConfig / api.config. */
export type BalanceAddonParams = {
  currency: SupportedCurrency | 'app';
  /** Currency code balances and shop prices are stored in. */
  stored_currency: string;
  api_server_override: string;
  allow_external_credit: boolean;
  /** When true, viewers can attach a message on the web page before spend. */
  allow_spend_message: boolean;
  /** When true, viewer balances are uploaded to the balance backend backup API. */
  viewer_backup_enabled: boolean;
  viewers: ViewerEntry[];
  categories: BalanceCategory[];
  shop_items: BalanceShopItem[];
  session_token: string;
  license_id: string;
  viewer_page_url: string;
};

/** Viewer list payload stored on the balance backend backup API. */
export type ViewerBackupData = {
  viewers: ViewerEntry[];
};

/** Payload sent to the balance backend on register/sync. */
export type BalanceSyncPayload = {
  licenseId: string;
  sessionToken: string;
  streamer: {
    displayName: string;
    avatar: string;
    login: string;
  };
  currency: string;
  viewers: Array<{
    twitchId: string;
    login: string;
    displayName: string;
    balance: number;
  }>;
  addons: BalanceSyncAddonEntry[];
  sounds?: BalanceSyncSoundsEntry;
  categories: BalanceCategory[];
  /** When true, the viewer page may show a message field before spend. */
  allowSpendMessage: boolean;
};

/** Purchasable action on the viewer page (no addon title duplication). */
export type BalanceSyncTriggerEntry = {
  id: string;
  price: number;
  /** Action label, e.g. sound name. Omitted when the card title is enough. */
  label?: LocalizedText;
};

/** Addon card on the viewer page (overlays and similar). */
export type BalanceSyncAddonEntry = {
  addonId: string;
  name: LocalizedText;
  description: LocalizedText;
  categoryId: string;
  logoBase64: string;
  triggers: BalanceSyncTriggerEntry[];
};

/** Shared sounds block on the viewer page. */
export type BalanceSyncSoundsEntry = {
  name: LocalizedText;
  description: LocalizedText;
  logoBase64: string;
  triggers: BalanceSyncTriggerEntry[];
};

/** Where the viewer initiated a balance spend. */
export type BalanceSpendSource = 'website' | 'twitch_extension';

/** Spend command from backend socket. */
export type BalanceSpendCommand = {
  requestId: string;
  viewerTwitchId: string;
  viewerLogin?: string;
  itemId: string;
  /** Spend origin: viewer page or Twitch extension. */
  source?: BalanceSpendSource;
  /** Optional viewer message when `allow_spend_message` is enabled. */
  message?: string;
};

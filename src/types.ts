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
  api_server_override: string;
  allow_external_credit: boolean;
  viewers: ViewerEntry[];
  categories: BalanceCategory[];
  shop_items: BalanceShopItem[];
  session_token: string;
  license_id: string;
  viewer_page_url: string;
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

/** Spend command from backend socket. */
export type BalanceSpendCommand = {
  requestId: string;
  viewerTwitchId: string;
  viewerLogin?: string;
  itemId: string;
};

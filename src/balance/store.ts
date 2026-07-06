import type { BalanceAddonParams, ViewerEntry } from '../types';
import { roundBalance } from './round';

/** Normalizes viewer balances to two decimal places. */
const normalizeViewerBalances = (viewers: ViewerEntry[]) =>
  viewers.map(viewer => ({
    ...viewer,
    balance: roundBalance(viewer.balance),
  }));

/** Parses viewers from params JSON storage. */
export const parseViewers = (raw: unknown): ViewerEntry[] => {
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as ViewerEntry[];
    return Array.isArray(parsed) ? normalizeViewerBalances(parsed) : [];
  } catch {
    return [];
  }
};

/** Serializes viewers for params storage. */
export const serializeViewers = (viewers: ViewerEntry[]) =>
  JSON.stringify(viewers);

type SaveParamsOptions = {
  /** When true, skips debounced server backup upload. */
  skipBackup?: boolean;
};

type ViewerSavedHook = (viewers: ViewerEntry[]) => void;

let onViewersSaved: ViewerSavedHook | null = null;

/**
 * Registers a callback invoked after viewer list persistence.
 * @param hook Called with the saved viewer list.
 */
export const setViewerSavedHook = (hook: ViewerSavedHook | null) => {
  onViewersSaved = hook;
};

/**
 * Loads current addon params with parsed viewers list.
 * @example const params = await loadParams();
 */
export const loadParams = async (): Promise<BalanceAddonParams> => {
  const params = (await api.config.getParams()) as BalanceAddonParams & {
    viewers_json?: string;
    categories_json?: string;
    shop_items_json?: string;
  };

  return {
    ...params,
    viewer_backup_enabled: params.viewer_backup_enabled !== false,
    viewers: parseViewers(params.viewers_json),
    categories: parseJsonArray(params.categories_json),
    shop_items: parseJsonArray(params.shop_items_json),
  };
};

/**
 * Persists addon params including serialized collections.
 * @param patch Partial params to merge.
 */
export const saveParams = async (
  patch: Partial<BalanceAddonParams> & {
    viewers?: ViewerEntry[];
    categories?: BalanceAddonParams['categories'];
    shop_items?: BalanceAddonParams['shop_items'];
  },
  options?: SaveParamsOptions
) => {
  const current = await loadParams();
  const next = { ...current, ...patch };
  const payload: Record<string, unknown> = { ...next };

  if (patch.viewers !== undefined) {
    payload.viewers_json = serializeViewers(
      normalizeViewerBalances(patch.viewers)
    );
    delete payload.viewers;
  }
  if (patch.categories !== undefined) {
    payload.categories_json = JSON.stringify(patch.categories);
    delete payload.categories;
  }
  if (patch.shop_items !== undefined) {
    payload.shop_items_json = JSON.stringify(patch.shop_items);
    delete payload.shop_items;
  }

  delete payload.viewers;
  delete payload.categories;
  delete payload.shop_items;

  await api.config.updateParams(payload);

  if (patch.viewers !== undefined && !options?.skipBackup) {
    onViewersSaved?.(normalizeViewerBalances(patch.viewers));
  }

  return loadParams();
};

const parseJsonArray = <T>(raw: unknown): T[] => {
  if (typeof raw !== 'string' || !raw.trim()) {
    return [];
  }
  try {
    const parsed = JSON.parse(raw) as T[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

/**
 * Finds a viewer by Twitch id or login (case-insensitive).
 * @param viewers Stored viewer list.
 * @param login Twitch login.
 * @param twitchId Twitch user id.
 */
export const findViewer = (
  viewers: ViewerEntry[],
  login?: string,
  twitchId?: string
) => {
  const normalizedLogin = login?.trim().toLowerCase();
  const normalizedId = twitchId?.trim();

  return viewers.find(entry => {
    if (normalizedId && entry.twitchId === normalizedId) {
      return true;
    }
    if (normalizedLogin && entry.login.toLowerCase() === normalizedLogin) {
      return true;
    }
    return false;
  });
};

/**
 * Upserts a viewer entry by twitch id / login.
 * @param viewers Current list.
 * @param entry Viewer to upsert.
 */
export const upsertViewerEntry = (
  viewers: ViewerEntry[],
  entry: ViewerEntry
): ViewerEntry[] => {
  const existing = findViewer(viewers, entry.login, entry.twitchId);
  const normalizedEntry = {
    ...entry,
    balance: roundBalance(entry.balance),
    updatedAt: Date.now(),
  };
  const next = existing
    ? viewers.map(item =>
        item.twitchId === existing.twitchId || item.login === existing.login
          ? { ...existing, ...normalizedEntry }
          : item
      )
    : [...viewers, normalizedEntry];

  return next.sort(
    (a, b) => b.balance - a.balance || a.login.localeCompare(b.login)
  );
};

/**
 * Removes a viewer by twitch id or login.
 * @param viewers Current list.
 * @param login Twitch login.
 * @param twitchId Twitch user id.
 */
export const removeViewerEntry = (
  viewers: ViewerEntry[],
  login?: string,
  twitchId?: string
) => viewers.filter(entry => !findViewer([entry], login, twitchId));

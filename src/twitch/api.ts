import { TWITCH_ADDON_ID } from '../constants';
import type { ViewerEntry } from '../types';
import { convertToBalanceCurrency } from '../balance/currency';
import {
  findViewer,
  loadParams,
  saveParams,
  upsertViewerEntry,
} from '../balance/store';

type TwitchUser = {
  id: string;
  login: string;
  display_name: string;
  profile_image_url?: string;
};

type TwitchHelixUsersResponse = {
  data?: TwitchUser[];
};

type BroadcasterProfile = {
  twitchId: string;
  login: string;
  displayName: string;
  avatar: string;
};

const BROADCASTER_PROFILE_CACHE_MS = 5 * 60_000;
let cachedBroadcasterProfile: BroadcasterProfile | null = null;
let cachedBroadcasterProfileAt = 0;

type TwitchApiGetResult = {
  success?: boolean;
  status?: number;
  body?: unknown;
  message?: string;
};

/**
 * Parses Helix JSON body from a Twitch addon `apiGet` RPC response.
 * @param response Result of `addons.request('twitch', 'apiGet', ...)`.
 * @example
 * const users = parseTwitchHelixResponse(await addons.request('twitch', 'apiGet', { url }));
 * const user = users?.data?.[0];
 */
export const parseTwitchHelixResponse = (
  response:
    | { success: boolean; result?: unknown; message?: string }
    | { success: false; message?: string }
): TwitchHelixUsersResponse | null => {
  if (!response.success) {
    return null;
  }

  const wrapped = response.result as TwitchApiGetResult | undefined;
  if (!wrapped || typeof wrapped !== 'object') {
    return null;
  }

  if (wrapped.success === false) {
    console.warn('[balance] Twitch apiGet failed:', wrapped.message);
    return null;
  }

  let body = wrapped.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body) as TwitchHelixUsersResponse;
    } catch {
      return null;
    }
  }

  if (!body || typeof body !== 'object') {
    return null;
  }

  return body as TwitchHelixUsersResponse;
};

/**
 * Returns the authorized broadcaster profile from the Twitch addon.
 * Uses `getChannelId` for core identity and `apiGet` for avatar.
 * @param options.force When true, bypasses the short-lived profile cache.
 * @example const profile = await getBroadcasterProfile();
 */
export const getBroadcasterProfile = async (options?: {
  force?: boolean;
}) => {
  if (
    !options?.force &&
    cachedBroadcasterProfile &&
    Date.now() - cachedBroadcasterProfileAt < BROADCASTER_PROFILE_CACHE_MS
  ) {
    return cachedBroadcasterProfile;
  }

  const profile = await fetchBroadcasterProfile();
  if (profile) {
    cachedBroadcasterProfile = profile;
    cachedBroadcasterProfileAt = Date.now();
  }

  return profile;
};

/**
 * Loads broadcaster profile from Twitch addon RPC without using the cache.
 */
const fetchBroadcasterProfile = async (): Promise<BroadcasterProfile | null> => {
  const channel = await addons.request(TWITCH_ADDON_ID, 'getChannelId', {});
  if (
    !channel.success ||
    !channel.result ||
    typeof channel.result !== 'object'
  ) {
    const reason =
      'message' in channel && typeof channel.message === 'string'
        ? channel.message
        : 'unknown error';
    console.warn('[balance] Twitch getChannelId failed:', reason);
    return null;
  }

  const meta = channel.result as {
    channelId?: string;
    login?: string;
    username?: string;
    displayName?: string;
  };

  const channelId = meta.channelId?.trim();
  if (!channelId) {
    console.warn('[balance] Twitch getChannelId returned no channelId');
    return null;
  }

  const response = await addons.request(TWITCH_ADDON_ID, 'apiGet', {
    url: `https://api.twitch.tv/helix/users?id=${encodeURIComponent(channelId)}`,
  });

  const helix = parseTwitchHelixResponse(response);
  const user = helix?.data?.[0];

  const login = String(
    user?.login ?? meta.login ?? meta.username ?? ''
  ).toLowerCase();
  const displayName = String(
    user?.display_name ??
      meta.displayName ??
      meta.login ??
      meta.username ??
      login
  );

  if (!login) {
    console.warn('[balance] Twitch broadcaster login is empty', { meta, user });
    return null;
  }

  return {
    twitchId: String(user?.id ?? channelId),
    login,
    displayName,
    avatar: String(user?.profile_image_url ?? ''),
  };
};

/**
 * Resolves Twitch user profile by login via the Twitch addon RPC.
 * @param login Twitch login (case-insensitive).
 */
export const resolveTwitchUserByLogin = async (
  login: string
): Promise<TwitchUser | null> => {
  const trimmed = login.trim();
  if (!trimmed) {
    return null;
  }

  const response = await addons.request(TWITCH_ADDON_ID, 'apiGet', {
    url: `https://api.twitch.tv/helix/users?login=${encodeURIComponent(trimmed)}`,
  });

  const helix = parseTwitchHelixResponse(response);
  const user = helix?.data?.[0];
  if (!user?.id || !user?.login) {
    console.warn('[balance] Twitch user lookup failed for login:', trimmed);
    return null;
  }

  return user;
};

const HELIX_USERS_BATCH_SIZE = 100;

/**
 * Fetches Twitch users by id via Helix (up to 100 ids per request).
 * @param twitchIds Twitch user ids to resolve.
 * @example const users = await fetchTwitchUsersByIds(['1', '2']);
 */
export const fetchTwitchUsersByIds = async (twitchIds: string[]) => {
  const unique = [...new Set(twitchIds.map(id => id.trim()).filter(Boolean))];
  const usersById = new Map<string, TwitchUser>();

  for (
    let offset = 0;
    offset < unique.length;
    offset += HELIX_USERS_BATCH_SIZE
  ) {
    const chunk = unique.slice(offset, offset + HELIX_USERS_BATCH_SIZE);
    const query = chunk.map(id => `id=${encodeURIComponent(id)}`).join('&');
    const response = await addons.request(TWITCH_ADDON_ID, 'apiGet', {
      url: `https://api.twitch.tv/helix/users?${query}`,
    });
    const helix = parseTwitchHelixResponse(response);

    for (const user of helix?.data ?? []) {
      if (user?.id) {
        usersById.set(user.id, user);
      }
    }
  }

  return usersById;
};

/**
 * Returns Twitch profile image URL for a viewer by Twitch user id.
 * @param twitchId Twitch user id.
 */
export const resolveTwitchAvatarById = async (twitchId: string) => {
  const id = twitchId.trim();
  if (!id) {
    return '';
  }

  const response = await addons.request(TWITCH_ADDON_ID, 'apiGet', {
    url: `https://api.twitch.tv/helix/users?id=${encodeURIComponent(id)}`,
  });

  const user = parseTwitchHelixResponse(response)?.data?.[0];
  return user?.profile_image_url ?? '';
};

/**
 * Credits balance for a donation that did not trigger any stream action.
 * @param login Donor Twitch login.
 * @param amount Donation amount.
 * @param currencyCode Donation currency.
 */
export const creditDonationBalance = async (
  login: string,
  amount: number,
  currencyCode: string
) => {
  const converted = await convertToBalanceCurrency(amount, currencyCode);
  const twitchUser = await resolveTwitchUserByLogin(login);
  const params = await loadParams();
  const existing = findViewer(params.viewers, login, twitchUser?.id);

  const entry: ViewerEntry = {
    twitchId: twitchUser?.id ?? existing?.twitchId ?? '',
    login: (twitchUser?.login ?? login).toLowerCase(),
    displayName: twitchUser?.display_name ?? existing?.displayName ?? login,
    balance: (existing?.balance ?? 0) + converted,
    updatedAt: Date.now(),
  };

  if (!entry.twitchId) {
    console.warn(
      '[balance] Skipping donation without resolvable Twitch id:',
      login
    );
    return null;
  }

  const viewers = upsertViewerEntry(params.viewers, entry);
  await saveParams({ viewers });
  return entry;
};

/**
 * Credits balance from another addon or manual adjustment.
 * @param options Credit target and amount.
 */
export const creditViewerBalance = async (options: {
  login?: string;
  twitchId?: string;
  amount: number;
  displayName?: string;
}) => {
  const params = await loadParams();
  const login = options.login?.trim().toLowerCase();
  const twitchId = options.twitchId?.trim();
  let twitchUser: TwitchUser | null = null;

  if (login) {
    twitchUser = await resolveTwitchUserByLogin(login);
  } else if (twitchId) {
    const response = await addons.request(TWITCH_ADDON_ID, 'apiGet', {
      url: `https://api.twitch.tv/helix/users?id=${encodeURIComponent(twitchId)}`,
    });
    twitchUser = parseTwitchHelixResponse(response)?.data?.[0] ?? null;
  }

  const resolvedLogin = (twitchUser?.login ?? login ?? '').toLowerCase();
  const resolvedTwitchId = twitchUser?.id ?? twitchId ?? '';
  if (!resolvedLogin && !resolvedTwitchId) {
    return { success: false as const, message: 'login or twitchId required' };
  }

  const existing = findViewer(params.viewers, resolvedLogin, resolvedTwitchId);
  const entry: ViewerEntry = {
    twitchId: resolvedTwitchId || existing?.twitchId || '',
    login: resolvedLogin || existing?.login || '',
    displayName:
      options.displayName ??
      twitchUser?.display_name ??
      existing?.displayName ??
      resolvedLogin,
    balance: (existing?.balance ?? 0) + options.amount,
    updatedAt: Date.now(),
  };

  if (!entry.twitchId) {
    return {
      success: false as const,
      message: login
        ? `Twitch user not found: ${login}`
        : 'Twitch user not found',
    };
  }

  const viewers = upsertViewerEntry(params.viewers, entry);
  await saveParams({ viewers });
  return { success: true as const, viewer: entry };
};

/**
 * Sets viewer balance to an absolute value.
 * Creates a new viewer via Twitch lookup when they are not in the list yet.
 * @param options Target viewer and new balance.
 */
export const setViewerBalance = async (options: {
  login?: string;
  twitchId?: string;
  balance: number;
  displayName?: string;
}) => {
  const params = await loadParams();
  const login = options.login?.trim().toLowerCase();
  const twitchId = options.twitchId?.trim();
  const existing = findViewer(params.viewers, login, twitchId);
  let twitchUser: TwitchUser | null = null;

  if (!existing) {
    if (login) {
      twitchUser = await resolveTwitchUserByLogin(login);
    } else if (twitchId) {
      const response = await addons.request(TWITCH_ADDON_ID, 'apiGet', {
        url: `https://api.twitch.tv/helix/users?id=${encodeURIComponent(twitchId)}`,
      });
      twitchUser = parseTwitchHelixResponse(response)?.data?.[0] ?? null;
    }
  }

  const entry: ViewerEntry = {
    twitchId: twitchId || existing?.twitchId || twitchUser?.id || '',
    login: (login || existing?.login || twitchUser?.login || '').toLowerCase(),
    displayName:
      options.displayName ??
      existing?.displayName ??
      twitchUser?.display_name ??
      login ??
      '',
    balance: options.balance,
    updatedAt: Date.now(),
  };

  if (!entry.twitchId || !entry.login) {
    return {
      success: false as const,
      message: login
        ? `Twitch user not found: ${login}`
        : 'Twitch user not found',
    };
  }

  const viewers = upsertViewerEntry(params.viewers, entry);
  await saveParams({ viewers });
  return { success: true as const, viewer: entry };
};

/**
 * Removes a viewer from the balance list.
 * @param options Target login or twitch id.
 */
export const deleteViewerBalance = async (options: {
  login?: string;
  twitchId?: string;
}) => {
  const params = await loadParams();
  const viewers = params.viewers.filter(
    (entry: ViewerEntry) =>
      !(
        (options.twitchId && entry.twitchId === options.twitchId) ||
        (options.login &&
          entry.login.toLowerCase() === options.login.toLowerCase())
      )
  );

  if (viewers.length === params.viewers.length) {
    return { success: false as const, message: 'Viewer not found' };
  }

  await saveParams({ viewers });
  return { success: true as const };
};

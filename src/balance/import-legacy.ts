import type { SupportedCurrency } from '../constants';
import { convertToBalanceCurrency } from './currency';
import { loadParams, saveParams, upsertViewerEntry } from './store';
import { fetchTwitchUsersByIds } from '../twitch/api';
import type { ViewerEntry } from '../types';

type LegacyViewerRow = {
  i?: unknown;
  n?: unknown;
  a?: unknown;
};

type LegacyImportPayload = {
  data?: LegacyViewerRow[];
};

/**
 * Parses StreamKit legacy balance export JSON.
 * @param raw Raw JSON string pasted by the user.
 */
export const parseStreamKitLegacyExport = (raw: string) => {
  let parsed: LegacyImportPayload;
  try {
    parsed = JSON.parse(raw) as LegacyImportPayload;
  } catch {
    throw new Error('Invalid JSON');
  }

  if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.data)) {
    throw new Error('Expected object with a "data" array');
  }

  return parsed.data
    .map(row => ({
      twitchId: String(row.i ?? '').trim(),
      displayName: String(row.n ?? '').trim(),
      amount: Number(row.a),
    }))
    .filter(row => row.twitchId && Number.isFinite(row.amount));
};

/**
 * Resolves viewer identity from a pre-fetched Helix map or legacy export fields.
 * @param twitchId Twitch user id from legacy export.
 * @param fallbackName Display name from legacy export.
 * @param usersById Helix users keyed by Twitch id.
 */
const resolveLegacyViewerIdentity = (
  twitchId: string,
  fallbackName: string,
  usersById: Map<string, { id: string; login: string; display_name: string }>
) => {
  const user = usersById.get(twitchId);

  if (user) {
    return {
      twitchId: user.id,
      login: user.login.toLowerCase(),
      displayName: user.display_name || fallbackName || user.login,
    };
  }

  const login = fallbackName.trim().toLowerCase();
  if (!login) {
    return null;
  }

  return {
    twitchId,
    login,
    displayName: fallbackName || login,
  };
};

/**
 * Imports viewer balances from a StreamKit legacy JSON export.
 * @param rawJson Pasted JSON (`{ data: [{ i, n, a }] }`).
 * @param sourceCurrency Currency of amounts in the export.
 */
export const importStreamKitLegacyViewers = async (
  rawJson: string,
  sourceCurrency: SupportedCurrency
) => {
  const rows = parseStreamKitLegacyExport(rawJson);
  if (rows.length === 0) {
    return { success: false as const, message: 'No valid viewer rows found' };
  }

  const usersById = await fetchTwitchUsersByIds(rows.map(row => row.twitchId));

  const params = await loadParams();
  let viewers = [...params.viewers];
  let imported = 0;
  let skipped = 0;

  for (const row of rows) {
    const identity = resolveLegacyViewerIdentity(
      row.twitchId,
      row.displayName,
      usersById
    );
    if (!identity) {
      skipped += 1;
      continue;
    }

    let balance = row.amount;
    try {
      balance = await convertToBalanceCurrency(row.amount, sourceCurrency);
    } catch {
      skipped += 1;
      continue;
    }

    const entry: ViewerEntry = {
      twitchId: identity.twitchId,
      login: identity.login,
      displayName: identity.displayName,
      balance,
      updatedAt: Date.now(),
    };

    viewers = upsertViewerEntry(viewers, entry);
    imported += 1;
  }

  await saveParams({ viewers });

  return {
    success: true as const,
    imported,
    skipped,
  };
};

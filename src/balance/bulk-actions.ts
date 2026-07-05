import type { SupportedCurrency } from '../constants';
import { SUPPORTED_CURRENCIES } from '../constants';
import { convertToBalanceCurrency } from './currency';
import { findViewer, loadParams, saveParams } from './store';
import type { ViewerEntry } from '../types';

/** Viewer reference for bulk operations. */
export type BulkViewerRef = {
  twitchId: string;
  login?: string;
};

export type BulkViewerAction =
  | 'delete'
  | 'reset'
  | 'add'
  | 'subtract'
  | 'merge';

type MergePayload = {
  twitchId: string;
  login: string;
  displayName: string;
  balance?: number;
};

/**
 * Matches a stored viewer against a bulk action target reference.
 * @param viewer Stored viewer entry.
 * @param ref Target reference from the UI.
 */
const matchesViewerRef = (viewer: ViewerEntry, ref: BulkViewerRef) => {
  const refId = ref.twitchId.trim();
  if (refId && viewer.twitchId === refId) {
    return true;
  }

  const refLogin = ref.login?.trim().toLowerCase();
  return Boolean(refLogin && viewer.login.toLowerCase() === refLogin);
};

/**
 * Resolves target viewers for a bulk action.
 * @param viewers Full viewer list.
 * @param targets Selected viewer references.
 */
const resolveBulkTargets = (
  viewers: ViewerEntry[],
  targets: BulkViewerRef[]
) => {
  const matched: ViewerEntry[] = [];
  const seen = new Set<string>();

  for (const ref of targets) {
    const viewer = viewers.find(entry => matchesViewerRef(entry, ref));
    if (!viewer || seen.has(viewer.twitchId)) {
      continue;
    }
    seen.add(viewer.twitchId);
    matched.push(viewer);
  }

  return matched;
};

/**
 * Applies a bulk action to the selected viewers.
 * @param options Bulk action payload from the application UI.
 */
export const applyBulkViewerAction = async (options: {
  action: BulkViewerAction;
  targets: BulkViewerRef[];
  amount?: number;
  sourceCurrency?: SupportedCurrency;
  merge?: MergePayload;
}) => {
  const { action, targets } = options;
  if (!targets.length) {
    return { success: false as const, message: 'No viewers selected' };
  }

  const params = await loadParams();
  const selected = resolveBulkTargets(params.viewers, targets);
  if (selected.length === 0) {
    return { success: false as const, message: 'Selected viewers not found' };
  }

  let viewers = [...params.viewers];
  const selectedIds = new Set(selected.map(viewer => viewer.twitchId));

  if (action === 'delete') {
    viewers = viewers.filter(viewer => !selectedIds.has(viewer.twitchId));
    await saveParams({ viewers });
    return { success: true as const, affected: selected.length };
  }

  if (action === 'reset') {
    viewers = viewers.map(viewer =>
      selectedIds.has(viewer.twitchId)
        ? { ...viewer, balance: 0, updatedAt: Date.now() }
        : viewer
    );
    await saveParams({ viewers });
    return { success: true as const, affected: selected.length };
  }

  if (action === 'add' || action === 'subtract') {
    const amount = Number(options.amount);
    const sourceCurrency = options.sourceCurrency;

    if (!Number.isFinite(amount) || amount <= 0) {
      return {
        success: false as const,
        message: 'amount must be a positive number',
      };
    }

    if (!sourceCurrency || !SUPPORTED_CURRENCIES.includes(sourceCurrency)) {
      return { success: false as const, message: 'Invalid source currency' };
    }

    let converted: number;
    try {
      converted = await convertToBalanceCurrency(amount, sourceCurrency);
    } catch (error) {
      return {
        success: false as const,
        message:
          error instanceof Error ? error.message : 'Currency conversion failed',
      };
    }

    viewers = viewers.map(viewer => {
      if (!selectedIds.has(viewer.twitchId)) {
        return viewer;
      }

      const nextBalance =
        action === 'add'
          ? viewer.balance + converted
          : Math.max(0, viewer.balance - converted);

      return {
        ...viewer,
        balance: nextBalance,
        updatedAt: Date.now(),
      };
    });

    await saveParams({ viewers });
    return { success: true as const, affected: selected.length };
  }

  if (action === 'merge') {
    if (selected.length < 2) {
      return {
        success: false as const,
        message: 'Select at least two viewers to merge',
      };
    }

    const merge = options.merge;
    const twitchId = merge?.twitchId.trim() ?? '';
    const login = merge?.login.trim().toLowerCase() ?? '';
    const displayName = merge?.displayName.trim() ?? '';

    if (!twitchId || !login || !displayName) {
      return {
        success: false as const,
        message: 'Merge requires twitchId, login, and displayName',
      };
    }

    const summedBalance = selected.reduce(
      (sum, viewer) => sum + viewer.balance,
      0
    );
    const balance =
      merge?.balance !== undefined && Number.isFinite(Number(merge.balance))
        ? Number(merge.balance)
        : summedBalance;

    if (!Number.isFinite(balance) || balance < 0) {
      return {
        success: false as const,
        message: 'balance must be a non-negative number',
      };
    }

    viewers = viewers.filter(viewer => !selectedIds.has(viewer.twitchId));

    const existing = findViewer(viewers, login, twitchId);
    const merged: ViewerEntry = {
      twitchId,
      login,
      displayName,
      balance,
      updatedAt: Date.now(),
    };

    if (existing) {
      viewers = viewers.map(viewer =>
        viewer.twitchId === existing.twitchId
          ? { ...existing, ...merged }
          : viewer
      );
    } else {
      viewers.push(merged);
    }

    viewers.sort(
      (a, b) => b.balance - a.balance || a.login.localeCompare(b.login)
    );

    await saveParams({ viewers });
    return { success: true as const, affected: selected.length };
  }

  return { success: false as const, message: 'Unknown bulk action' };
};

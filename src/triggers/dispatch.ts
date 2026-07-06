import { ADDON_ID } from '../constants';
import type { BalanceShopItem, BalanceSpendCommand } from '../types';
import { buildSiteSpendMessage } from '../dashboard/platform';
import { resolveBalanceCurrency } from '../balance/currency';
import { findViewer, loadParams, saveParams, upsertViewerEntry } from '../balance/store';
import { resolveTwitchAvatarById } from '../twitch/api';
import { buildSpendTriggers } from './registry';

/**
 * Executes a spend command from the viewer web page (via backend socket).
 * @param command Spend request with item and viewer identity.
 */
export const executeSpendCommand = async (command: BalanceSpendCommand) => {
  const params = await loadParams();
  const item = params.shop_items.find((entry: BalanceShopItem) => entry.id === command.itemId);
  if (!item) {
    return { success: false as const, message: 'Unknown shop item' };
  }

  const viewer = findViewer(
    params.viewers,
    command.viewerLogin,
    command.viewerTwitchId
  );
  if (!viewer) {
    return { success: false as const, message: 'Viewer not found' };
  }

  if (viewer.balance < item.price) {
    return { success: false as const, message: 'Insufficient balance' };
  }

  const nextBalance = viewer.balance - item.price;
  const viewers = upsertViewerEntry(params.viewers, {
    ...viewer,
    balance: nextBalance,
  });
  await saveParams({ viewers });

  const currencyCode = await resolveBalanceCurrency();
  const avatar = await resolveTwitchAvatarById(viewer.twitchId);

  await dashboard.addRecord(
    {
      id: random.id(),
      type: 'custom',
      platform: ADDON_ID,
      amount: [item.price, String(currencyCode)],
      message: buildSiteSpendMessage(),
      from: viewer.twitchId,
    },
    {
      id: viewer.twitchId,
      name: viewer.displayName || viewer.login,
      avatar,
      platform: ADDON_ID,
    },
    {
      triggers: buildSpendTriggers(item).triggers,
    }
  );

  return {
    success: true as const,
    balance: nextBalance,
    itemId: item.id,
  };
};

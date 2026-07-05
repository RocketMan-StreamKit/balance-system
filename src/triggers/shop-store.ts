import type { BalanceCategory, BalanceShopItem } from '../types';
import { loadParams, saveParams } from '../balance/store';
import { resyncBackend } from '../backend/sync';
import { registerBalanceDashboardTriggers } from './registry';

/**
 * Persists shop catalog and refreshes dashboard triggers + backend sync.
 * @param shopItems Shop items to store.
 * @param categories Optional category list.
 */
export const saveShopCatalog = async (
  shopItems: BalanceShopItem[],
  categories?: BalanceCategory[]
) => {
  const patch: {
    shop_items: BalanceShopItem[];
    categories?: BalanceCategory[];
  } = { shop_items: shopItems };

  if (categories) {
    patch.categories = categories;
  }

  await saveParams(patch);
  await registerBalanceDashboardTriggers(shopItems);
  await resyncBackend();
};

/**
 * Adds or updates a single shop item.
 * @param item Shop item payload.
 */
export const upsertShopItem = async (item: BalanceShopItem) => {
  const params = await loadParams();
  const items = params.shop_items.filter(entry => entry.id !== item.id);
  items.push(item);
  await saveShopCatalog(items, params.categories);
  return item;
};

/**
 * Removes a shop item by id.
 * @param itemId Shop item id.
 */
export const deleteShopItem = async (itemId: string) => {
  const params = await loadParams();
  const items = params.shop_items.filter(entry => entry.id !== itemId);
  if (items.length === params.shop_items.length) {
    return { success: false as const, message: 'Shop item not found' };
  }

  await saveShopCatalog(items, params.categories);
  return { success: true as const };
};

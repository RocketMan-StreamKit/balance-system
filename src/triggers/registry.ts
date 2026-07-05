import type { BalanceShopItem } from '../types';
import { loadParams } from '../balance/store';
import { resolveBalanceCurrency } from '../balance/currency';

export const SHOP_TRIGGER_KEY = 'shop';

/**
 * Registers dashboard triggers so overlays/sounds/timer can react to site purchases.
 * @param shopItems Current shop catalog.
 */
export const registerBalanceDashboardTriggers = async (
  shopItems: BalanceShopItem[] = []
) => {
  const items = shopItems.length ? shopItems : (await loadParams()).shop_items;
  const currencyCode = await resolveBalanceCurrency();

  await dashboard.registerTriggers([
    {
      type: 'custom',
      key: SHOP_TRIGGER_KEY,
      label: {
        en: 'Site activation',
        ru: 'Активация через сайт',
        uk: 'Активація через сайт',
      },
      valueType: 'number',
      valueHint: {
        en: `Cost in ${currencyCode}`,
        ru: `Стоимость в ${currencyCode}`,
        uk: `Вартість у ${currencyCode}`,
      },
    },
  ]);

  return items;
};

/**
 * Builds the dashboard trigger fired when a viewer buys a shop item.
 * @param item Purchased shop item.
 */
export const buildShopPurchaseTrigger = (item: BalanceShopItem) => ({
  type: 'custom' as const,
  key: SHOP_TRIGGER_KEY,
  value: item.price,
});

/**
 * Merges shop purchase trigger with the configured source trigger for consumers.
 * @param item Purchased shop item.
 */
export const buildSpendTriggers = (item: BalanceShopItem) => ({
  triggers: [buildShopPurchaseTrigger(item), item.trigger],
});

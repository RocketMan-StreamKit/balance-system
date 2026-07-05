import { ADDON_ID, SOUNDS_CATALOG_GROUP } from '../constants';
import type { BalanceShopItem, LocalizedText } from '../types';
import { loadParams } from '../balance/store';
import { saveShopCatalog } from './shop-store';
import { SHOP_TRIGGER_KEY } from './registry';

type AppliedRule =
  | {
      system: 'overlay';
      targetId: string;
      trigger: { type: string; key?: string; value: string | number | boolean };
    }
  | {
      system: 'sounds';
      soundName: string;
      trigger: { type: string; key?: string; value: string | number | boolean };
    };

const isBalanceShopRule = (trigger: AppliedRule['trigger']) =>
  trigger.type === 'custom' &&
  trigger.key === SHOP_TRIGGER_KEY &&
  Number.isFinite(Number(trigger.value)) &&
  Number(trigger.value) > 0;

const buildAutoItemId = (price: number, group: 'addon' | 'sounds') =>
  `auto:${SHOP_TRIGGER_KEY}:${group}:${price}`;

const buildAutoShopItem = (rule: AppliedRule, price: number): BalanceShopItem => {
  if (rule.system === 'sounds') {
    return {
      id: buildAutoItemId(price, 'sounds'),
      categoryId: 'default',
      price,
      catalogGroup: 'sounds',
      addonId: SOUNDS_CATALOG_GROUP,
      name: { en: rule.soundName },
      description: { en: '' },
      trigger: {
        type: 'custom',
        key: SHOP_TRIGGER_KEY,
        value: price,
      },
    };
  }

  return {
    id: buildAutoItemId(price, 'addon'),
    categoryId: 'default',
    price,
    catalogGroup: 'addon',
    addonId: rule.targetId,
    name: { en: '' },
    description: { en: '' },
    trigger: {
      type: 'custom',
      key: SHOP_TRIGGER_KEY,
      value: price,
    },
  };
};

const collectBalanceShopRules = (
  applied: Awaited<ReturnType<typeof triggers.getApplied>>
): AppliedRule[] => {
  if (!applied.success) {
    return [];
  }

  const rules: AppliedRule[] = [];

  for (const entry of applied.categories.overlay[ADDON_ID] ?? []) {
    rules.push({ system: 'overlay', targetId: entry.targetId, trigger: entry.trigger });
  }
  for (const entry of applied.categories.sounds[ADDON_ID] ?? []) {
    rules.push({ system: 'sounds', soundName: entry.soundName, trigger: entry.trigger });
  }

  return rules;
};

const isSameShopItem = (left: BalanceShopItem, right: BalanceShopItem) =>
  left.id === right.id &&
  left.addonId === right.addonId &&
  left.catalogGroup === right.catalogGroup &&
  left.price === right.price &&
  left.name.en === right.name.en;

/**
 * Builds shop catalog entries from overlay/sound rules that use the balance
 * addon site-activation trigger (price in balance currency).
 */
export const syncShopFromBalanceRules = async () => {
  const applied = await triggers.getApplied();
  const params = await loadParams();
  const manualItems = params.shop_items
    .filter(item => !item.id.startsWith('auto:'))
    .map(normalizeShopItem);
  const autoByKey = new Map<string, BalanceShopItem>();

  for (const rule of collectBalanceShopRules(applied)) {
    if (!isBalanceShopRule(rule.trigger)) {
      continue;
    }

    const price = Number(rule.trigger.value);
    const item = buildAutoShopItem(rule, price);
    autoByKey.set(`${item.catalogGroup}:${price}`, item);
  }

  const nextItems = [...manualItems, ...autoByKey.values()].sort(
    (a, b) =>
      a.catalogGroup.localeCompare(b.catalogGroup) ||
      a.price - b.price ||
      a.id.localeCompare(b.id)
  );

  const unchanged =
    nextItems.length === params.shop_items.length &&
    nextItems.every((item, index) => {
      const current = normalizeShopItem(params.shop_items[index]);
      return isSameShopItem(current, item);
    });

  if (!unchanged) {
    await saveShopCatalog(nextItems, params.categories);
  }

  return nextItems;
};

const normalizeShopItem = (item: BalanceShopItem): BalanceShopItem => ({
  ...item,
  catalogGroup: item.catalogGroup ?? 'addon',
});

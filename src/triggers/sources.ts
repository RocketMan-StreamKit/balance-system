import type { BalanceShopItem } from '../types';

/** Trigger source option for shop item picker. */
export type TriggerSourceOption = {
  id: string;
  addonId: string;
  label: string;
  systems: string[];
  trigger: BalanceShopItem['trigger'];
};

/**
 * Collects unique dashboard trigger sources from saved overlay/timer/sound rules.
 * @example const options = await collectTriggerSourceOptions();
 */
export const collectTriggerSourceOptions = async (): Promise<
  TriggerSourceOption[]
> => {
  const applied = await triggers.getApplied();
  if (!applied.success) {
    return [];
  }

  const unique = new Map<string, TriggerSourceOption>();

  const addOption = (
    addonId: string,
    trigger: BalanceShopItem['trigger'],
    system: string,
    meta?: string
  ) => {
    const key = `${addonId}:${trigger.type}:${trigger.key ?? ''}:${String(trigger.value ?? '')}`;
    const existing = unique.get(key);
    const label = `${addonId} · ${trigger.type}${trigger.key ? ` · ${trigger.key}` : ''}${trigger.value !== undefined ? ` · ${trigger.value}` : ''}${meta ? ` (${meta})` : ''}`;

    if (existing) {
      if (!existing.systems.includes(system)) {
        existing.systems.push(system);
      }
      return;
    }

    unique.set(key, {
      id: key,
      addonId,
      label,
      systems: [system],
      trigger: {
        type: trigger.type,
        key: trigger.key,
        value: trigger.value,
      },
    });
  };

  for (const [addonId, rules] of Object.entries(applied.categories.overlay)) {
    for (const rule of rules) {
      addOption(addonId, rule.trigger, 'overlay', rule.targetId);
    }
  }

  for (const [addonId, rules] of Object.entries(applied.categories.timer)) {
    for (const rule of rules) {
      addOption(addonId, rule.trigger, 'timer');
    }
  }

  for (const [addonId, rules] of Object.entries(applied.categories.sounds)) {
    for (const rule of rules) {
      addOption(addonId, rule.trigger, 'sounds', rule.soundName);
    }
  }

  for (const [addonId, rules] of Object.entries(applied.categories.hotkeys)) {
    for (const rule of rules) {
      addOption(addonId, rule.trigger, 'hotkeys', rule.presetName);
    }
  }

  for (const [addonId, rules] of Object.entries(applied.categories.game)) {
    for (const rule of rules) {
      addOption(addonId, rule.trigger, 'game', rule.actionId);
    }
  }

  return [...unique.values()].sort((a, b) => a.label.localeCompare(b.label));
};

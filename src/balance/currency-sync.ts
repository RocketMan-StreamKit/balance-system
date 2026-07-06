import { ADDON_ID } from '../constants';
import type { SupportedCurrency } from '../constants';
import type { BalanceShopItem, ViewerEntry } from '../types';
import { resyncBackend } from '../backend/sync';
import {
  registerBalanceDashboardTriggers,
  SHOP_TRIGGER_KEY,
} from '../triggers/registry';
import { syncShopFromBalanceRules } from '../triggers/sync-from-applied';
import { resolveBalanceCurrency } from './currency';
import { roundBalance } from './round';
import { loadParams, saveParams } from './store';

type AppTriggerRule = {
  addonId?: string;
  type?: string;
  key?: string;
  value?: string | number | boolean;
};

type AppConfigSnapshot = {
  triggers?: Array<{
    targetId: string;
    addonId: string;
    type: string;
    key?: string;
    value: string | number | boolean;
  }>;
  timerTriggers?: Array<{
    addonId: string;
    type: string;
    key?: string;
    value: string | number | boolean;
    seconds: number;
    convertCurrency?: boolean;
  }>;
  gameTriggers?: Array<{
    gameAddonId: string;
    actionId: string;
    addonId: string;
    type: string;
    key?: string;
    value: string | number | boolean;
  }>;
  sounds?: Array<{
    id: string;
    name: string;
    url: string;
    volume: number;
    triggers: AppTriggerRule[];
  }>;
  hotkeyPresets?: Array<{
    id: string;
    name: string;
    triggers: AppTriggerRule[];
    scenario: unknown[];
  }>;
};

const APP_CURRENCY_POLL_MS = 30_000;

let syncInProgress = false;
let appCurrencyPollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Returns true when a trigger encodes a site-activation price in balance currency.
 * @param trigger Dashboard trigger rule.
 */
const isShopPriceTrigger = (trigger: {
  type?: string;
  key?: string;
  value?: unknown;
}) =>
  trigger.type === 'custom' &&
  trigger.key === SHOP_TRIGGER_KEY &&
  Number.isFinite(Number(trigger.value)) &&
  Number(trigger.value) > 0;

/**
 * Converts a numeric amount between two currency codes.
 * @param amount Value in the source currency.
 * @param from Source currency code.
 * @param to Target currency code.
 */
const convertAmount = async (
  amount: number,
  from: string,
  to: string
): Promise<number> => {
  if (from === to) {
    return roundBalance(amount);
  }

  const converted = await currency.convert(
    amount,
    from as SupportedCurrency,
    to as SupportedCurrency
  );
  if (!converted.success) {
    throw new Error(converted.message ?? 'Currency conversion failed');
  }

  return roundBalance(converted.amount);
};

/**
 * Converts a shop trigger value when it stores a site-activation price.
 * @param trigger Shop item trigger payload.
 * @param from Source currency code.
 * @param to Target currency code.
 */
const convertShopTrigger = async (
  trigger: BalanceShopItem['trigger'],
  from: string,
  to: string
) => {
  if (!isShopPriceTrigger(trigger)) {
    return trigger;
  }

  const price = await convertAmount(Number(trigger.value), from, to);
  return { ...trigger, value: price };
};

/**
 * Converts manual shop item prices (auto items are rebuilt from applied rules).
 * @param items Stored shop catalog.
 * @param from Source currency code.
 * @param to Target currency code.
 */
const convertManualShopItems = async (
  items: BalanceShopItem[],
  from: string,
  to: string
) =>
  Promise.all(
    items
      .filter(item => !item.id.startsWith('auto:'))
      .map(async item => {
        const price = await convertAmount(item.price, from, to);
        return {
          ...item,
          price,
          trigger: await convertShopTrigger(item.trigger, from, to),
        };
      })
  );

/**
 * Converts viewer balances to a new storage currency.
 * @param viewers Stored viewer list.
 * @param from Source currency code.
 * @param to Target currency code.
 */
const convertViewerBalances = async (
  viewers: ViewerEntry[],
  from: string,
  to: string
) =>
  Promise.all(
    viewers.map(async viewer => ({
      ...viewer,
      balance: await convertAmount(viewer.balance, from, to),
      updatedAt: Date.now(),
    }))
  );

/**
 * Converts site-activation trigger prices saved in the main application config.
 * @param from Source currency code.
 * @param to Target currency code.
 */
const migrateAppliedTriggerPrices = async (from: string, to: string) => {
  if (!permissions.has('CONFIG_WRITE')) {
    console.warn(
      '[balance] Skipping applied trigger migration: CONFIG_WRITE permission is required'
    );
    return;
  }

  const config = (await api.config.getConfig()) as AppConfigSnapshot | null;
  if (!config) {
    return;
  }

  const convertRule = async <T extends AppTriggerRule>(rule: T): Promise<T> => {
    if (rule.addonId !== ADDON_ID || !isShopPriceTrigger(rule)) {
      return rule;
    }

    const converted = await convertAmount(Number(rule.value), from, to);
    return { ...rule, value: converted };
  };

  const triggers = await Promise.all(
    (config.triggers ?? []).map(async entry =>
      entry.addonId === ADDON_ID
        ? { ...entry, ...(await convertRule(entry)) }
        : entry
    )
  );

  const timerTriggers = await Promise.all(
    (config.timerTriggers ?? []).map(async entry =>
      entry.addonId === ADDON_ID
        ? { ...entry, ...(await convertRule(entry)) }
        : entry
    )
  );

  const gameTriggers = await Promise.all(
    (config.gameTriggers ?? []).map(async entry =>
      entry.addonId === ADDON_ID
        ? { ...entry, ...(await convertRule(entry)) }
        : entry
    )
  );

  const sounds = await Promise.all(
    (config.sounds ?? []).map(async sound => ({
      ...sound,
      triggers: await Promise.all(
        (sound.triggers ?? []).map(trigger => convertRule(trigger))
      ),
    }))
  );

  const hotkeyPresets = await Promise.all(
    (config.hotkeyPresets ?? []).map(async preset => ({
      ...preset,
      triggers: await Promise.all(
        (preset.triggers ?? []).map(trigger => convertRule(trigger))
      ),
    }))
  );

  await api.config.setConfig({
    triggers,
    timerTriggers,
    gameTriggers,
    sounds,
    hotkeyPresets,
  });
};

/**
 * Converts all stored balances and prices after the effective currency changed.
 * @param from Previous storage currency code.
 * @param to New storage currency code.
 */
const migrateStoredValues = async (from: string, to: string) => {
  const params = await loadParams();
  const viewers = await convertViewerBalances(params.viewers, from, to);
  const manualItems = await convertManualShopItems(params.shop_items, from, to);

  await migrateAppliedTriggerPrices(from, to);

  const autoItems = params.shop_items.filter(item =>
    item.id.startsWith('auto:')
  );
  await saveParams({
    viewers,
    shop_items: [...manualItems, ...autoItems],
    stored_currency: to,
  });

  const shopItems = await syncShopFromBalanceRules();
  await registerBalanceDashboardTriggers(shopItems);
  await resyncBackend();

  console.log(
    `[balance] converted balances and prices from ${from} to ${to} (${viewers.length} viewers)`
  );
};

/**
 * Ensures persisted balances match the current effective currency.
 * Initializes `stored_currency` on first run or migrates when it changed.
 * @returns True when a migration was performed.
 * @example const migrated = await ensureBalanceCurrencySynced();
 */
export const ensureBalanceCurrencySynced = async (): Promise<boolean> => {
  if (syncInProgress) {
    return false;
  }

  syncInProgress = true;
  try {
    const params = await loadParams();
    const targetCurrency = String(await resolveBalanceCurrency());
    const storedCurrency = params.stored_currency?.trim();

    if (!storedCurrency) {
      await saveParams(
        { stored_currency: targetCurrency },
        { skipBackup: true }
      );
      return false;
    }

    if (storedCurrency === targetCurrency) {
      return false;
    }

    await migrateStoredValues(storedCurrency, targetCurrency);
    return true;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Currency migration failed';
    console.error('[balance] currency migration failed:', message, error);
    return false;
  } finally {
    syncInProgress = false;
  }
};

/**
 * Restarts polling that watches app currency when addon uses "same as app".
 */
export const restartAppCurrencyPoll = async () => {
  if (appCurrencyPollTimer) {
    clearInterval(appCurrencyPollTimer);
    appCurrencyPollTimer = null;
  }

  const params = await loadParams();
  if (params.currency !== 'app') {
    return;
  }

  appCurrencyPollTimer = setInterval(() => {
    void ensureBalanceCurrencySynced();
  }, APP_CURRENCY_POLL_MS);
};

/**
 * Starts polling app currency when addon uses "same as app".
 * @example registerBalanceCurrencyWatcher();
 */
export const registerBalanceCurrencyWatcher = () => {
  void restartAppCurrencyPoll();
};

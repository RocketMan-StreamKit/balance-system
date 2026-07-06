import {
  ensureBalanceCurrencySynced,
  restartAppCurrencyPoll,
} from '../balance/currency-sync';
import { resyncBackend } from '../backend/sync';
import { clearAddonCatalogMetaCache } from '../addons/catalog-meta';
import { registerBalanceDashboardTriggers } from './registry';
import { syncShopFromBalanceRules } from './sync-from-applied';

/**
 * Subscribes to params/trigger changes that affect shop catalog and backend sync.
 */
export const registerBalanceTriggerLifecycle = () => {
  events.On('onParamsUpdated', async () => {
    await ensureBalanceCurrencySynced();
    await restartAppCurrencyPoll();
    clearAddonCatalogMetaCache();
    await registerBalanceDashboardTriggers();
    await resyncBackend();
  });

  events.On('triggers:applied-changed', async () => {
    clearAddonCatalogMetaCache();
    await syncShopFromBalanceRules();
  });
};

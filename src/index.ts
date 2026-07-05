import { ADDON_ID } from './constants';
import { registerBalanceConfig } from './config';
import { subscribeDonationCredits, setDonationSyncHook } from './balance/donations';
import { registerBalanceRpc } from './rpc';
import {
  bindViewerBackupOnSave,
  restoreViewersFromBackup,
} from './backend/backup';
import {
  resyncBackend,
  startBackendConnection,
} from './backend/sync';
import { registerHttpEndpoints } from './endpoints';
import { registerBalanceDashboardPlatform } from './dashboard/platform';
import { registerBalanceTriggerLifecycle } from './triggers/lifecycle';
import { registerBalanceDashboardTriggers } from './triggers/registry';
import { syncShopFromBalanceRules } from './triggers/sync-from-applied';

registerBalanceConfig();
bindViewerBackupOnSave();

void (async () => {
  await registerHttpEndpoints();
  await restoreViewersFromBackup();
  registerBalanceRpc();
  await registerBalanceDashboardPlatform();
  registerBalanceTriggerLifecycle();
  await registerBalanceDashboardTriggers();
  await syncShopFromBalanceRules();
  setDonationSyncHook(resyncBackend);
  subscribeDonationCredits();
  await startBackendConnection();
})();

console.log(`[${ADDON_ID}] viewer balance system loaded`);

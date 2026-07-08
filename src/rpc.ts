import { resolveBalanceCurrency } from './balance/currency';
import { loadParams } from './balance/store';
import { creditViewerBalance } from './twitch/api';

/**
 * Registers RPC handlers exposed to other addons.
 * @example registerBalanceRpc();
 */
export const registerBalanceRpc = () => {
  addons.onRequest('canCreditBalance', async () => {
    const settings = await loadParams();
    return {
      success: true,
      allowed: settings.allow_external_credit,
    };
  });

  addons.onRequest('getCurrency', async () => {
    const currencyCode = await resolveBalanceCurrency();
    return {
      success: true,
      currency: currencyCode,
    };
  });

  addons.onRequest(
    'creditBalance',
    async ({ fromAddonId, params: rpcParams }) => {
      const settings = await loadParams();
      if (!settings.allow_external_credit) {
        return {
          success: false,
          message: 'External balance credit is disabled in addon settings',
        };
      }

      const payload = (rpcParams ?? {}) as {
        amount?: unknown;
        login?: unknown;
        twitchId?: unknown;
        displayName?: unknown;
      };

      const amount = Number(payload.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        return { success: false, message: 'amount must be a positive number' };
      }

      const result = await creditViewerBalance({
        login: typeof payload.login === 'string' ? payload.login : undefined,
        twitchId:
          typeof payload.twitchId === 'string' ? payload.twitchId : undefined,
        amount,
        displayName:
          typeof payload.displayName === 'string'
            ? payload.displayName
            : undefined,
      });

      if (!result.success) {
        return result;
      }

      console.log(
        `[balance] credited ${amount} from addon ${fromAddonId} to`,
        result.viewer?.login
      );

      return {
        success: true,
        viewer: result.viewer,
      };
    }
  );
};

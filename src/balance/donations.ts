import { creditDonationBalance } from '../twitch/api';

/** Dashboard record payload subset used for donation filtering. */
type DonationRecordPayload = {
  record: {
    type: string;
    amount?: [number, string];
    attach?: Array<{ type: string; value: string }>;
  };
  user?: {
    id: string;
    name: string;
  };
};

type SyncHook = () => void | Promise<void>;

let onBalanceChanged: SyncHook | null = null;

/**
 * Registers a callback invoked after automatic donation credit.
 * @param hook Sync function (typically backend resync).
 */
export const setDonationSyncHook = (hook: SyncHook | null) => {
  onBalanceChanged = hook;
};

/**
 * Returns true when the dashboard record did not trigger overlays/sounds/hotkeys/timer.
 * @param payload Incoming dashboard record payload.
 */
export const isUntriggeredDonation = (payload: DonationRecordPayload) => {
  if (payload.record.type !== 'donation') {
    return false;
  }

  const attach = payload.record.attach ?? [];
  if (attach.length > 0) {
    return false;
  }

  const amount = payload.record.amount;
  if (!amount || typeof amount[0] !== 'number' || !amount[1]) {
    return false;
  }

  return Boolean(payload.user?.name || payload.user?.id);
};

/**
 * Subscribes to dashboard donations without triggers and credits viewer balance.
 * @example subscribeDonationCredits();
 */
export const subscribeDonationCredits = () => {
  dashboard.onRecord(async (payload: DonationRecordPayload) => {
    if (!isUntriggeredDonation(payload)) {
      return;
    }

    const amount = payload.record.amount!;
    const login = payload.user!.name;
    const credited = await creditDonationBalance(login, amount[0], amount[1]);

    if (credited && onBalanceChanged) {
      await onBalanceChanged();
    }
  });
};

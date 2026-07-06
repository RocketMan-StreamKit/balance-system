import { ADDON_ID, SPEND_MESSAGE_MAX_LENGTH } from '../constants';
import type { BalanceSpendSource } from '../types';

const BALANCE_PLATFORM_NAME = {
  en: 'Viewer balance system',
  ru: 'Система баланса зрителей',
  uk: 'Система балансу глядачів',
} as const;

/**
 * Registers the balance addon as a dashboard platform (source of site spend events).
 */
export const registerBalanceDashboardPlatform = async () => {
  await dashboard.registerPlatform({
    id: ADDON_ID,
    name: BALANCE_PLATFORM_NAME,
  });
};

/**
 * Normalizes an optional viewer message for site spend.
 * @param raw Message from the spend command.
 * @param allowed Whether addon settings allow spend messages.
 */
export const normalizeSpendMessage = (
  raw: unknown,
  allowed: boolean
): string | undefined => {
  if (!allowed || typeof raw !== 'string') {
    return undefined;
  }

  const trimmed = raw.trim();
  if (!trimmed) {
    return undefined;
  }

  if (trimmed.length > SPEND_MESSAGE_MAX_LENGTH) {
    return trimmed.slice(0, SPEND_MESSAGE_MAX_LENGTH);
  }

  return trimmed;
};

const SPEND_SOURCE_LABELS: Record<
  BalanceSpendSource,
  { en: string; ru: string; uk: string }
> = {
  website: {
    en: 'Site activation',
    ru: 'Активация через сайт',
    uk: 'Активація через сайт',
  },
  twitch_extension: {
    en: 'Twitch extension activation',
    ru: 'Активация через расширение Twitch',
    uk: 'Активація через розширення Twitch',
  },
};

/**
 * Localized dashboard message for a viewer balance spend (amount is passed separately).
 * @param source Spend origin from the backend socket command.
 * @param message Optional viewer message appended after a colon.
 */
export const buildSiteSpendMessage = (
  source: BalanceSpendSource = 'website',
  message?: string
) => {
  const label = SPEND_SOURCE_LABELS[source] ?? SPEND_SOURCE_LABELS.website;
  const suffix = message ? `: ${message}` : '';

  return {
    en: `${label.en}${suffix}`,
    ru: `${label.ru}${suffix}`,
    uk: `${label.uk}${suffix}`,
  };
};

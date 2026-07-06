import { ADDON_ID, SPEND_MESSAGE_MAX_LENGTH } from '../constants';

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

/**
 * Localized dashboard message for a viewer site spend (amount is passed separately).
 * @param message Optional viewer message appended after a colon.
 */
export const buildSiteSpendMessage = (message?: string) => {
  const suffix = message ? `: ${message}` : '';
  return {
    en: `Site activation${suffix}`,
    ru: `Активация через сайт${suffix}`,
    uk: `Активація через сайт${suffix}`,
  };
};

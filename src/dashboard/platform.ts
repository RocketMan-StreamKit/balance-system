import { ADDON_ID } from '../constants';

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
 * Localized dashboard message for a viewer site spend.
 * @param price Spent balance amount.
 * @param currencyCode Balance currency code.
 */
export const buildSiteSpendMessage = (price: number, currencyCode: string) => {
  const amount = `${price.toFixed(2)} ${currencyCode}`;
  return {
    en: `Site activation: ${amount}`,
    ru: `Активация через сайт: ${amount}`,
    uk: `Активація через сайт: ${amount}`,
  };
};

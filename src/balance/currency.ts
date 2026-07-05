import type { SupportedCurrency } from '../constants';
import { loadParams } from './store';

/**
 * Resolves the currency code used for balance storage.
 * @example const code = await resolveBalanceCurrency();
 */
export const resolveBalanceCurrency = async (): Promise<SupportedCurrency | string> => {
  const params = await loadParams();
  if (params.currency && params.currency !== 'app') {
    return params.currency;
  }

  const current = await currency.getCurrent();
  return current.success ? current.currency : 'USD';
};

/**
 * Converts a donation amount into the balance currency.
 * @param amount Donation amount.
 * @param fromCurrency Donation currency code.
 */
export const convertToBalanceCurrency = async (
  amount: number,
  fromCurrency: string
) => {
  const target = await resolveBalanceCurrency();
  if (fromCurrency === target) {
    return amount;
  }

  const converted = await currency.convert(
    amount,
    fromCurrency as Parameters<typeof currency.convert>[1],
    target as Parameters<typeof currency.convert>[2]
  );
  if (!converted.success) {
    throw new Error(converted.message ?? 'Currency conversion failed');
  }

  return converted.amount;
};

/**
 * Formats a balance amount with currency code for UI.
 * @param amount Numeric balance.
 * @param currencyCode Currency code.
 */
export const formatBalance = (amount: number, currencyCode: string) =>
  `${amount.toFixed(2)} ${currencyCode}`;

/**
 * Rounds a balance amount to two decimal places.
 * @param amount Numeric balance.
 */
export const roundBalance = (amount: number) =>
  Math.round(amount * 100) / 100;

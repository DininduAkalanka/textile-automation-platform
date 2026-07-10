/** Single source of currency formatting. The store operates in LKR. */
export const formatLKR = (amount: number | string): string =>
  'Rs ' +
  Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

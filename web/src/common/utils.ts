export const formatNumber = (
  value: number,
  options?: Intl.NumberFormatOptions
) => new Intl.NumberFormat('en-US', options).format(value);

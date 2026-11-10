/** What a spreadsheet keeps of a number: Excel stores and shows 15 significant digits. */
const SIGNIFICANT_DIGITS = 15;

/**
 * The number as a decimal string without exponent or trailing zeros, rounded
 * to the digits a spreadsheet keeps, so a price stored as 37.420000000000002
 * reads as the 37.42 that was typed. Null for a value that is not finite.
 */
export const plainDecimalOf = (value: number): string | null => {
  if (!Number.isFinite(value)) return null;

  const [mantissa, exponentText] = value
    .toPrecision(SIGNIFICANT_DIGITS)
    .split('e');
  const isNegative = mantissa.startsWith('-');
  const [integerPart, fractionPart = ''] = mantissa.replace('-', '').split('.');
  const digits = integerPart + fractionPart;
  const pointAt = integerPart.length + Number(exponentText ?? 0);

  const whole =
    pointAt <= 0
      ? `0.${'0'.repeat(-pointAt)}${digits}`
      : pointAt >= digits.length
        ? digits + '0'.repeat(pointAt - digits.length)
        : `${digits.slice(0, pointAt)}.${digits.slice(pointAt)}`;

  const trimmed = whole.includes('.')
    ? whole.replace(/0+$/, '').replace(/\.$/, '')
    : whole;
  const normalized = trimmed.replace(/^0+(?=\d)/, '');

  return isNegative && /[1-9]/.test(normalized) ? `-${normalized}` : normalized;
};

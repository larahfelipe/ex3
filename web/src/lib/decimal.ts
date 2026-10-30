import type { Locale } from '@/i18n/config';
import type { DecimalString } from '@/types';

/**
 * Amounts stay decimal strings from the API to the form and back. Arithmetic
 * on them counts units of 10^-scale in a `bigint`, so no value ever passes
 * through binary floating point.
 */

/** The API stores quantities and amounts as DECIMAL(38,18) and rejects what the column would round. */
export const DECIMAL_COLUMN = { PRECISION: 38, SCALE: 18 } as const;

export const INTEGER_DIGITS = DECIMAL_COLUMN.PRECISION - DECIMAL_COLUMN.SCALE;

const STORABLE_DECIMAL_PATTERN = new RegExp(
  `^(0|[1-9]\\d{0,${INTEGER_DIGITS - 1}})(\\.\\d{1,${DECIMAL_COLUMN.SCALE}})?$`
);

const NONZERO_DIGIT = /[1-9]/;

const DIGITS_ONLY_PATTERN = /^\d+$/;

const SEPARATED_NUMBER_PATTERN = /^[\d.,]+$/;

type Separator = '.' | ',';

type LocaleSeparators = Record<'decimal' | 'group', Separator> &
  Record<'ambiguousGroup', RegExp>;

type UnreadDecimal =
  | { outcome: 'ambiguous'; asDecimal: DecimalString; asWhole: DecimalString }
  | { outcome: 'unreadable' };

export type DecimalReading =
  { outcome: 'read'; value: DecimalString } | UnreadDecimal;

type SeparatorReading = { outcome: 'read'; value: string } | UnreadDecimal;

const escapeForPattern = (separator: string) => `\\${separator}`;

const localeSeparators = new Map<Locale, LocaleSeparators>();

/** The separators a language writes numbers with: "," before the decimals in pt-BR, "." in en-US. */
const separatorsOf = (locale: Locale): LocaleSeparators => {
  const cached = localeSeparators.get(locale);

  if (cached !== undefined) return cached;

  const decimal: Separator =
    new Intl.NumberFormat(locale)
      .formatToParts(1.5)
      .find(({ type }) => type === 'decimal')?.value === ','
      ? ','
      : '.';
  const group: Separator = decimal === ',' ? '.' : ',';
  const separators = {
    decimal,
    group,
    /**
     * The language's group separator alone before exactly three digits, after
     * a nonzero lead, separates the decimals in the other convention, so it is
     * refused, not guessed: "1.500" in pt-BR, "1,500" in en-US.
     */
    ambiguousGroup: new RegExp(
      `^[1-9]\\d{0,2}${escapeForPattern(group)}\\d{3}$`
    )
  };

  localeSeparators.set(locale, separators);

  return separators;
};

const isGroupedWhole = (text: string, separator: string) =>
  new RegExp(`^[1-9]\\d{0,2}(${escapeForPattern(separator)}\\d{3})+$`).test(
    text
  );

const withoutSeparator = (text: string, separator: string) =>
  text.split(separator).join('');

const UNREADABLE: UnreadDecimal = { outcome: 'unreadable' };

const interpretSeparators = (
  compact: string,
  { group, ambiguousGroup }: LocaleSeparators
): SeparatorReading => {
  if (!SEPARATED_NUMBER_PATTERN.test(compact)) return UNREADABLE;
  if (DIGITS_ONLY_PATTERN.test(compact))
    return { outcome: 'read', value: compact };

  const lastDot = compact.lastIndexOf('.');
  const lastComma = compact.lastIndexOf(',');

  if (lastDot !== -1 && lastComma !== -1) {
    const decimalSeparator = lastDot > lastComma ? '.' : ',';
    const groupSeparator = decimalSeparator === '.' ? ',' : '.';
    const decimalAt = Math.max(lastDot, lastComma);
    const whole = compact.slice(0, decimalAt);
    const fraction = compact.slice(decimalAt + 1);

    return isGroupedWhole(whole, groupSeparator) &&
      DIGITS_ONLY_PATTERN.test(fraction)
      ? {
          outcome: 'read',
          value: `${withoutSeparator(whole, groupSeparator)}.${fraction}`
        }
      : UNREADABLE;
  }

  const separator = lastDot !== -1 ? '.' : ',';
  const separatorCount = compact.split(separator).length - 1;

  if (separatorCount > 1)
    return isGroupedWhole(compact, separator)
      ? { outcome: 'read', value: withoutSeparator(compact, separator) }
      : UNREADABLE;

  // The pattern keeps both readings within the column: six digits at most.
  if (separator === group && ambiguousGroup.test(compact))
    return {
      outcome: 'ambiguous',
      asDecimal: compact.replace(separator, '.') as DecimalString,
      asWhole: compact.replace(separator, '') as DecimalString
    };

  return { outcome: 'read', value: compact.replace(separator, '.') };
};

/** Unsigned, without leading zeros, and within what the column stores unrounded. */
export const isStorableDecimal = (value: string): value is DecimalString =>
  STORABLE_DECIMAL_PATTERN.test(value);

/**
 * Reads a number as a person writes it, in `locale` or in the other
 * convention: a lone separator before the decimals, and dots or commas between
 * groups of three digits. With both, the last one separates the decimals. Only
 * what the column stores is read.
 */
export const readDecimal = (locale: Locale, text: string): DecimalReading => {
  const reading = interpretSeparators(
    text.replace(/\s/gu, ''),
    separatorsOf(locale)
  );

  if (reading.outcome !== 'read') return reading;

  const { value } = reading;

  return isStorableDecimal(value) ? { outcome: 'read', value } : UNREADABLE;
};

/**
 * `value` as a person types it in `locale`, with its decimal separator and no
 * grouping, which `readDecimal` reads back as `value`.
 */
export const decimalInputTextOf = (locale: Locale, value: string) =>
  value.replace('.', separatorsOf(locale).decimal);

export const isNonzeroDecimal = (value: string) => NONZERO_DIGIT.test(value);

export const decimalPlacesOf = (value: string) =>
  value.split('.').at(1)?.length ?? 0;

/** Exact only for a storable `value` with at most `scale` decimal places. */
export const unitsOf = (value: string, scale: number) => {
  const [whole, fraction = ''] = value.split('.');

  return BigInt(`${whole}${fraction.padEnd(scale, '0')}`);
};

/** -1, 0 or 1 as `a` is below, equal to or above `b`, exactly, for storable decimals. */
export const compareDecimals = (a: string, b: string) => {
  const scale = Math.max(decimalPlacesOf(a), decimalPlacesOf(b));
  const difference = unitsOf(a, scale) - unitsOf(b, scale);

  return difference === 0n ? 0 : difference > 0n ? 1 : -1;
};

/** A nonnegative count of 10^-scale units, written with exactly `scale` decimal places. */
export const decimalOfUnits = (units: bigint, scale: number) => {
  const digits = units.toString().padStart(scale + 1, '0');

  return (
    scale === 0 ? digits : `${digits.slice(0, -scale)}.${digits.slice(-scale)}`
  ) as DecimalString;
};

/** To `scale` decimal places, halves away from zero, for a storable `value`. */
export const roundDecimal = (value: string, scale: number) => {
  const places = decimalPlacesOf(value);

  if (places <= scale) return decimalOfUnits(unitsOf(value, scale), scale);

  const divisor = 10n ** BigInt(places - scale);
  const units = unitsOf(value, places);
  const quotient = units / divisor;
  const hasRoundedUp = (units % divisor) * 2n >= divisor;

  return decimalOfUnits(hasRoundedUp ? quotient + 1n : quotient, scale);
};

/**
 * `value` moved by `count` whole units, keeping its decimals, or null when
 * the result would not be positive or would not fit the column.
 */
export const shiftByWholeUnits = (value: string, count: number) => {
  const places = decimalPlacesOf(value);
  const units = unitsOf(value, places) + BigInt(count) * 10n ** BigInt(places);

  if (units <= 0n) return null;

  const shifted = decimalOfUnits(units, places);

  return isStorableDecimal(shifted) ? shifted : null;
};

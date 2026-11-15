import { Prisma } from '@prisma/client';

import { DecimalColumn } from '@/config/Constants';

import type { RecurrenceFrequency } from './models';

/**
 * No sum or product of personal finance rounds at this precision: every value
 * fits `DECIMAL(38,18)`, and a total adds at most a few digits of carry.
 */
export const FinanceDecimal = Prisma.Decimal.clone({
  precision: 2 * DecimalColumn.PRECISION
});

export type FinanceDecimal = InstanceType<typeof FinanceDecimal>;

export type DecimalInput = Prisma.Decimal | string;

export const ZERO = new FinanceDecimal(0);

const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;

export const minorUnitsOf = (currency: string) =>
  new Intl.NumberFormat('en', {
    style: 'currency',
    currency
  }).resolvedOptions().maximumFractionDigits ?? 2;

export const decimalOf = (value: DecimalInput) =>
  new FinanceDecimal(value.toString());

export const sumOf = (values: Iterable<DecimalInput>) => {
  let total = ZERO;

  for (const value of values) total = total.plus(decimalOf(value));

  return total;
};

export const fitsMinorUnits = (amount: DecimalInput, currency: string) =>
  decimalOf(amount).decimalPlaces() <= minorUnitsOf(currency);

export const truncateToMinorUnits = (amount: DecimalInput, currency: string) =>
  decimalOf(amount).toDecimalPlaces(
    minorUnitsOf(currency),
    FinanceDecimal.ROUND_DOWN
  );

export const ratioOf = (numerator: DecimalInput, denominator: DecimalInput) => {
  const divisor = decimalOf(denominator);

  if (divisor.isZero()) return null;

  return decimalOf(numerator)
    .dividedBy(divisor)
    .toDecimalPlaces(DecimalColumn.SCALE, FinanceDecimal.ROUND_DOWN)
    .toFixed();
};

export const splitIntoInstallments = (
  total: DecimalInput,
  count: number,
  currency: string
): Array<string> | null => {
  const amount = decimalOf(total);
  const share = truncateToMinorUnits(amount.dividedBy(count), currency);

  if (share.isZero()) return null;

  const remainder = amount.minus(share.times(count));

  return Array.from({ length: count }, (_, index) =>
    (index === 0 ? share.plus(remainder) : share).toFixed()
  );
};

export const monthlyEquivalentOf = (
  amount: DecimalInput,
  frequency: RecurrenceFrequency,
  currency: string
) => {
  const value = decimalOf(amount);

  const monthly =
    frequency === 'WEEKLY'
      ? value.times(WEEKS_PER_YEAR).dividedBy(MONTHS_PER_YEAR)
      : frequency === 'YEARLY'
        ? value.dividedBy(MONTHS_PER_YEAR)
        : value;

  return truncateToMinorUnits(monthly, currency).toFixed();
};

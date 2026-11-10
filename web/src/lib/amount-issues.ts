import type { Format } from '@/i18n/format';
import type { Translator } from '@/i18n/translator';

import { DECIMAL_COLUMN, INTEGER_DIGITS, type DecimalReading } from './decimal';

type RejectedReading = Exclude<DecimalReading, { outcome: 'read' }>;

/** What the API's decimal column stores, as the messages about an amount state it. */
const DECIMAL_LIMITS = {
  integerDigits: INTEGER_DIGITS,
  decimals: DECIMAL_COLUMN.SCALE
};

export const decimalLimitsIssueOf = (t: Translator<'validation'>) =>
  t('amount.invalid', DECIMAL_LIMITS);

/** Names each reading as text to type, which the field reads one way only. */
export const typedAmountIssueOf = (
  reading: RejectedReading,
  t: Translator<'validation'>,
  { decimalInputTextOf }: Format
) =>
  reading.outcome === 'ambiguous'
    ? t('amount.ambiguous', {
        asDecimal: decimalInputTextOf(reading.asDecimal),
        asWhole: reading.asWhole
      })
    : decimalLimitsIssueOf(t);

/** Names each reading as the amount it would be, since a money field takes digits only. */
export const pastedAmountIssueOf = (
  reading: RejectedReading,
  t: Translator<'validation'>,
  { formatQuantity }: Format
) =>
  reading.outcome === 'ambiguous'
    ? t('amount.pastedAmbiguous', {
        asDecimal: formatQuantity(reading.asDecimal),
        asWhole: formatQuantity(reading.asWhole)
      })
    : t('amount.pastedInvalid', DECIMAL_LIMITS);

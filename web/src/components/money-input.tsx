import type { ChangeEvent, ClipboardEvent, FC } from 'react';

import { formatDecimal } from '@/common/utils';
import { Input, type InputProps } from '@/components/ui';
import {
  decimalOfUnits,
  decimalPlacesOf,
  INTEGER_DIGITS,
  isStorableDecimal,
  readDecimal,
  unitsOf,
  type DecimalReading
} from '@/lib/decimal';
import { cn } from '@/lib/utils';

export type RejectedAmount = Exclude<DecimalReading, { outcome: 'read' }>;

type MoneyInputProps = Omit<
  InputProps,
  'type' | 'inputMode' | 'value' | 'onChange' | 'onPaste'
> & {
  value: string;
  /** Decimal places typed digits fill; a value written with more keeps them. */
  decimals: number;
  onValueChange: (value: string) => void;
  onRejectedPaste: (reading: RejectedAmount) => void;
};

const NON_DIGIT = /\D/g;

const LEADING_ZEROS = /^0+/;

const AFFIX_CHARACTER = /[\p{Sc}\p{L}\s]/u;

/** Above twenty integer digits, eighteen decimals, their separators and a currency sign. */
const PASTED_AMOUNT_MAX_LENGTH = 64;

const DELETION_INPUT_TYPE_PREFIX = 'delete';

/** Drops a currency sign or code around the amount, as in "R$ 1.234,56" or "12.50 USD". */
const amountTextOf = (pasted: string) => {
  const characters = Array.from(pasted);
  const start = characters.findIndex((c) => !AFFIX_CHARACTER.test(c));
  const end = characters.findLastIndex((c) => !AFFIX_CHARACTER.test(c));

  return start === -1 ? '' : characters.slice(start, end + 1).join('');
};

const isDeletion = (event: ChangeEvent<HTMLInputElement>) =>
  event.nativeEvent instanceof InputEvent &&
  event.nativeEvent.inputType.startsWith(DELETION_INPUT_TYPE_PREFIX);

/**
 * Digits enter from the right, as on a cash machine: typing 1, 2, 5 and 0
 * reads 12.50, and deleting takes the last digit back. Separators are never
 * typed, so no locale can misread them; a pasted amount is read whole, with
 * either convention, instead of digit by digit. The form holds the plain
 * decimal the API takes, and only the display is grouped.
 */
export const MoneyInput: FC<MoneyInputProps> = ({
  value,
  decimals,
  onValueChange,
  onRejectedPaste,
  className,
  ...props
}) => {
  const scale = Math.max(decimals, decimalPlacesOf(value));

  const enterDigits = (event: ChangeEvent<HTMLInputElement>) => {
    const typedDigits = event.target.value.replace(NON_DIGIT, '');
    const digits = typedDigits.replace(LEADING_ZEROS, '');

    if (typedDigits === '' || (digits === '' && isDeletion(event)))
      return onValueChange('');
    if (digits.length > INTEGER_DIGITS + scale) return;

    onValueChange(decimalOfUnits(BigInt(digits || '0'), scale));
  };

  const pasteAmount = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();

    const pasted = event.clipboardData.getData('text');
    const reading: DecimalReading =
      pasted.length > PASTED_AMOUNT_MAX_LENGTH
        ? { outcome: 'unreadable' }
        : readDecimal(amountTextOf(pasted));

    if (reading.outcome !== 'read') return onRejectedPaste(reading);

    const pastedScale = Math.max(decimals, decimalPlacesOf(reading.value));

    onValueChange(
      decimalOfUnits(unitsOf(reading.value, pastedScale), pastedScale)
    );
  };

  return (
    <Input
      {...props}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder={formatDecimal('0', decimals)}
      className={cn('tabular-nums', className)}
      value={isStorableDecimal(value) ? formatDecimal(value, scale) : value}
      onChange={enterDigits}
      onPaste={pasteAmount}
    />
  );
};

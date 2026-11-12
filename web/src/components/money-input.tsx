import type {
  AriaAttributes,
  ChangeEvent,
  ClipboardEvent,
  FC,
  ReactNode,
  Ref
} from 'react';

import { useTranslations } from 'use-intl';

import { OFFERED_CURRENCIES } from '@/common/constants';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  type InputProps
} from '@/components/ui';
import { useFormat } from '@/i18n/format';
import {
  decimalOfUnits,
  decimalPlacesOf,
  INTEGER_DIGITS,
  isStorableDecimal,
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

type CurrencyAmountInputProps = Omit<MoneyInputProps, 'leftElement'> &
  Record<'currency', string> &
  Partial<Record<'currencyControl', ReactNode>>;

type CurrencySelectProps = Record<'value', string> &
  Record<'onValueChange', (currency: string) => void> &
  Partial<Record<'name', string>> &
  Partial<Record<'onBlur', VoidFunction>> &
  Partial<Record<'ref', Ref<HTMLButtonElement>>> &
  Pick<AriaAttributes, 'aria-invalid' | 'aria-describedby'>;

/**
 * What opens an amount field, the currency's symbol or a selector of it,
 * joined to the field's edge and set in the figures' own size, so both share
 * one baseline.
 */
const CURRENCY_ADDON_CLASS =
  'relative -mr-px h-(--field-height) shrink-0 rounded-l-md rounded-r-none border border-input px-3 text-base font-medium md:text-sm focus-visible:z-10 group-data-invalid/amount:border-negative';

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
  const { formatDecimal, readDecimal } = useFormat();
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

/**
 * The amount with its currency attached: the symbol leads the figures, as
 * text or as `currencyControl`, a selector of it. The amount is held apart
 * from the currency, so choosing another one leaves the figures as typed:
 * nothing is converted.
 */
export const CurrencyAmountInput: FC<CurrencyAmountInputProps> = ({
  currency,
  currencyControl,
  className,
  ...props
}) => {
  const { currencySymbolOf } = useFormat();

  return (
    <div
      data-invalid={props['aria-invalid'] === true || undefined}
      className="group/amount flex"
    >
      {currencyControl ?? (
        <span
          aria-hidden
          className={cn(
            CURRENCY_ADDON_CLASS,
            'inline-flex min-w-11 items-center justify-center bg-muted/50 text-muted-foreground'
          )}
        >
          {currencySymbolOf(currency)}
        </span>
      )}

      <div className="min-w-0 flex-1">
        <MoneyInput
          {...props}
          className={cn(
            'relative rounded-l-none focus-visible:z-10',
            className
          )}
        />
      </div>
    </div>
  );
};

/** The offered currencies, and the one given when it is not among them, such as a stored record's. */
export const CurrencySelect: FC<CurrencySelectProps> = ({
  value,
  name,
  ref,
  onValueChange,
  onBlur,
  ...aria
}) => {
  const t = useTranslations('common.form');
  const { currencyNameOf, currencySymbolOf } = useFormat();
  const currencies: ReadonlyArray<string> = OFFERED_CURRENCIES.some(
    (currency) => currency === value
  )
    ? OFFERED_CURRENCIES
    : [...OFFERED_CURRENCIES, value];

  return (
    <Select name={name} value={value} onValueChange={onValueChange}>
      <SelectTrigger
        {...aria}
        ref={ref}
        aria-label={t('currency')}
        className={cn(
          CURRENCY_ADDON_CLASS,
          'w-auto min-w-19 gap-1.5 bg-muted/50 hover:bg-accent'
        )}
        onBlur={onBlur}
      >
        <SelectValue>
          <span aria-hidden>{currencySymbolOf(value)}</span>

          <span className="sr-only">{currencyNameOf(value)}</span>
        </SelectValue>
      </SelectTrigger>

      <SelectContent align="start">
        {currencies.map((currency) => (
          <SelectItem key={currency} value={currency}>
            <span className="font-medium">{currency}</span>

            <span className="ml-2 text-muted-foreground">
              {currencySymbolOf(currency)}

              {' · '}

              {currencyNameOf(currency)}
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

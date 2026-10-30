import type { ChangeEvent } from 'react';

import { Input, type InputProps } from '@/components/ui';

type NumberInputProps = Omit<InputProps, 'type' | 'inputMode'> &
  Partial<Record<'allowsDecimals', boolean>>;

const NOT_DIGIT = /\D/g;

const NOT_DECIMAL_CHARACTER = /[^\d.,]/g;

/** `text` without what cannot be part of a count or, with `allowsDecimals`, of a decimal. */
export const numberTextOf = (text: string, allowsDecimals: boolean) =>
  text.replace(allowsDecimals ? NOT_DECIMAL_CHARACTER : NOT_DIGIT, '');

/**
 * A count or a quantity, typed: whatever cannot be part of one, such as a
 * letter, a sign or an exponent, is dropped as it is typed or pasted, and the
 * caret stays where it was. A decimal takes either separator, which the form
 * reads by the language; an amount of money takes the money input instead.
 */
export const NumberInput = ({
  allowsDecimals = false,
  onChange,
  ...props
}: NumberInputProps) => {
  const keepNumber = (event: ChangeEvent<HTMLInputElement>) => {
    const input = event.target;
    const typed = input.value;
    const kept = numberTextOf(typed, allowsDecimals);

    if (kept !== typed) {
      const caret = numberTextOf(
        typed.slice(0, input.selectionStart ?? typed.length),
        allowsDecimals
      ).length;

      input.value = kept;
      input.setSelectionRange(caret, caret);
    }

    onChange?.(event);
  };

  return (
    <Input
      autoComplete="off"
      {...props}
      type="text"
      inputMode={allowsDecimals ? 'decimal' : 'numeric'}
      onChange={keepNumber}
    />
  );
};

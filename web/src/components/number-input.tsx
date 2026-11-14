import type { ChangeEvent } from 'react';

import { Input, type InputProps } from '@/components/ui';

type NumberInputProps = Omit<InputProps, 'type' | 'inputMode'> &
  Partial<Record<'allowsDecimals', boolean>>;

const NOT_DIGIT = /\D/g;

const NOT_DECIMAL_CHARACTER = /[^\d.,]/g;

export const numberTextOf = (text: string, allowsDecimals: boolean) =>
  text.replace(allowsDecimals ? NOT_DECIMAL_CHARACTER : NOT_DIGIT, '');

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

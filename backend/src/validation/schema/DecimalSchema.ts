import { z } from 'zod';

import { DecimalColumn } from '@/config/Constants';

const INTEGER_DIGITS = DecimalColumn.PRECISION - DecimalColumn.SCALE;

/** Unsigned, without exponent or leading zeros, and stored by the column without rounding. */
const DECIMAL_PATTERN = new RegExp(
  `^(0|[1-9]\\d{0,${INTEGER_DIGITS - 1}})(\\.\\d{1,${DecimalColumn.SCALE}})?$`
);

export const NONZERO_DIGIT = /[1-9]/;

export const decimalSchema = (field: string) =>
  z
    .string()
    .regex(
      DECIMAL_PATTERN,
      `${field} must be a decimal string with at most ${INTEGER_DIGITS} integer digits and ${DecimalColumn.SCALE} decimal places`
    );

export const positiveDecimalSchema = (field: string) =>
  decimalSchema(field).regex(
    NONZERO_DIGIT,
    `${field} must be greater than zero`
  );

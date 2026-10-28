import { z } from 'zod';

// From the module, not the `@/config` barrel: the barrel is still initializing
// when this schema loads, and `z.enum` reads the object right away.
import {
  ExpenseCategories,
  ExpenseKinds,
  ExpenseStatusFilters,
  FinanceLimits,
  FinanceMessages,
  PaymentMethods,
  RecurrenceFrequencies
} from '@/config/Constants';
import {
  differenceInDays,
  parseCalendarDay,
  parseCalendarMonth,
  utcToday
} from '@/domain/CalendarDay';
import { fitsMinorUnits } from '@/domain/FinanceMoney';

import { boundedTextSchema } from '../BoundedTextSchema';
import { isSupportedCurrency } from '../CurrencyCodeSchema';

const listOf = (values: Record<string, string>) =>
  Object.values(values)
    .map((value) => `\`${value}\``)
    .join(', ');

const upperCaseEnumSchema = <Values extends Record<string, string>>(
  values: Values,
  field: string
) =>
  z
    .string()
    .trim()
    .toUpperCase()
    .pipe(z.enum(values, `${field} must be one of ${listOf(values)}`));

export const calendarDaySchema = (field: string) =>
  z.string().transform((value, ctx) => {
    const day = parseCalendarDay(value);

    if (day === null) {
      ctx.addIssue({
        code: 'custom',
        message: `${field} must be a calendar day as YYYY-MM-DD`
      });

      return z.NEVER;
    }

    return day;
  });

export const calendarMonthSchema = (field: string) =>
  z.string().transform((value, ctx) => {
    const month = parseCalendarMonth(value);

    if (month === null) {
      ctx.addIssue({
        code: 'custom',
        message: `${field} must be a calendar month as YYYY-MM`
      });

      return z.NEVER;
    }

    return month;
  });

/**
 * The caller's calendar day, which decides what is overdue: the server's UTC
 * day is a day ahead of, or behind, the caller's for part of every day. It
 * defaults to the UTC day and may differ from it by the span of the world's
 * time zones, so no caller can move "today" further than its own clock does.
 */
export const ReferenceDaySchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    const serverDay = utcToday();

    if (value === undefined) return serverDay;

    const day = parseCalendarDay(value);

    if (
      day === null ||
      Math.abs(differenceInDays(day, serverDay)) >
        FinanceLimits.REFERENCE_DAY_TOLERANCE_DAYS
    ) {
      ctx.addIssue({
        code: 'custom',
        message: FinanceMessages.REFERENCE_DAY_OUT_OF_RANGE
      });

      return z.NEVER;
    }

    return day;
  });

export const financeIdSchema = (field: string) =>
  z.uuid(`${field} must be a UUID`);

export const ExpenseCategorySchema = upperCaseEnumSchema(
  ExpenseCategories,
  'Category'
);

export const PaymentMethodSchema = upperCaseEnumSchema(
  PaymentMethods,
  'Payment method'
);

export const RecurrenceFrequencySchema = upperCaseEnumSchema(
  RecurrenceFrequencies,
  'Frequency'
);

export const ExpenseStatusFilterSchema = upperCaseEnumSchema(
  ExpenseStatusFilters,
  'Status'
);

export const ExpenseKindSchema = upperCaseEnumSchema(ExpenseKinds, 'Kind');

export const ExpenseDescriptionSchema = z.object({
  description: boundedTextSchema(
    'Description',
    FinanceLimits.DESCRIPTION_MAX_LENGTH
  ),
  category: ExpenseCategorySchema,
  subcategory: boundedTextSchema(
    'Subcategory',
    FinanceLimits.SUBCATEGORY_MAX_LENGTH
  )
    .nullable()
    .default(null),
  paymentMethod: PaymentMethodSchema.nullable().default(null),
  account: boundedTextSchema('Account', FinanceLimits.ACCOUNT_MAX_LENGTH)
    .nullable()
    .default(null),
  notes: boundedTextSchema('Notes', FinanceLimits.NOTES_MAX_LENGTH)
    .nullable()
    .default(null)
});

/** The same fields, each optional, for an edit that names only what changes. */
export const ExpenseDescriptionPatchSchema = z.object({
  description: ExpenseDescriptionSchema.shape.description.optional(),
  category: ExpenseCategorySchema.optional(),
  subcategory: ExpenseDescriptionSchema.shape.subcategory.unwrap().optional(),
  paymentMethod: PaymentMethodSchema.nullable().optional(),
  account: ExpenseDescriptionSchema.shape.account.unwrap().optional(),
  notes: ExpenseDescriptionSchema.shape.notes.unwrap().optional()
});

/** Refuses each named amount with more decimal places than `currency` has minor units. */
export const requireMinorUnits =
  <Fields extends string>(fields: ReadonlyArray<Fields>) =>
  (
    payload: Partial<Record<Fields, string | null>> &
      Record<'currency', string>,
    ctx: z.RefinementCtx
  ) => {
    if (!isSupportedCurrency(payload.currency)) return;

    for (const field of fields) {
      const amount = payload[field];

      if (
        typeof amount === 'string' &&
        !fitsMinorUnits(amount, payload.currency)
      )
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: FinanceMessages.AMOUNT_PRECISION
        });
    }
  };

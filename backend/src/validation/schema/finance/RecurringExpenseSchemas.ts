import { z } from 'zod';

import {
  FinanceLimits,
  FinanceMessages,
  RecurringExpenseStatuses
} from '@/config/Constants';
import { addMonths, utcToday } from '@/domain/CalendarDay';

import { currencyCodeSchema } from '../CurrencyCodeSchema';
import { positiveDecimalSchema } from '../DecimalSchema';
import { PageQuerySchema } from '../PaginationQuerySchema';
import {
  calendarDaySchema,
  ExpenseDescriptionPatchSchema,
  ExpenseDescriptionSchema,
  financeIdSchema,
  RecurrenceFrequencySchema,
  ReferenceDaySchema,
  requireMinorUnits
} from './FinanceFieldSchemas';

const SERIES_STATUSES = Object.values(RecurringExpenseStatuses);

export const RecurringExpenseIdSchema = financeIdSchema('Recurring expense id');

export const RecurringExpenseParamsSchema = z.object({
  id: RecurringExpenseIdSchema
});

export const RecurringExpenseReadSchema = z.object({
  id: RecurringExpenseIdSchema,
  today: ReferenceDaySchema
});

const requireEndAfterStart = (
  { startDate, endDate }: { startDate: Date; endDate: Date | null },
  ctx: z.RefinementCtx
) => {
  if (endDate !== null && endDate.getTime() < startDate.getTime())
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: FinanceMessages.END_BEFORE_START
    });
};

/**
 * A start further back than the occurrence horizon would generate a backlog of
 * overdue occurrences at once, unbounded for a weekly series started years
 * ago.
 */
const requireRecentStart = (
  { startDate }: { startDate: Date },
  ctx: z.RefinementCtx
) => {
  if (
    startDate.getTime() <
    addMonths(utcToday(), -FinanceLimits.OCCURRENCE_HORIZON_MONTHS).getTime()
  )
    ctx.addIssue({
      code: 'custom',
      path: ['startDate'],
      message: `Start date must be within the last ${FinanceLimits.OCCURRENCE_HORIZON_MONTHS} months`
    });
};

export const CreateRecurringExpenseSchema = z
  .object({
    ...ExpenseDescriptionSchema.shape,
    amount: positiveDecimalSchema('Amount'),
    isVariable: z.boolean('Variable must be a boolean').default(false),
    currency: currencyCodeSchema('Currency'),
    frequency: RecurrenceFrequencySchema,
    startDate: calendarDaySchema('Start date'),
    endDate: calendarDaySchema('End date').nullable().default(null)
  })
  .superRefine(requireEndAfterStart)
  .superRefine(requireRecentStart)
  .superRefine(requireMinorUnits(['amount']));

/**
 * Frequency and start define which days the series falls on, so they are fixed
 * at creation. The other fields apply to the occurrences from `effectiveFrom`
 * on (the current day by default) that have no payments and were not edited
 * on their own.
 */
export const UpdateRecurringExpenseSchema = z.object({
  ...ExpenseDescriptionPatchSchema.shape,
  id: RecurringExpenseIdSchema,
  amount: positiveDecimalSchema('Amount').optional(),
  isVariable: z.boolean('Variable must be a boolean').optional(),
  endDate: calendarDaySchema('End date').nullable().optional(),
  effectiveFrom: calendarDaySchema('Effective from').optional()
});

export const CancelRecurringExpenseSchema = z.object({
  id: RecurringExpenseIdSchema,
  effectiveFrom: calendarDaySchema('Effective from').optional()
});

export const GetRecurringExpensesQuerySchema = z.object({
  ...PageQuerySchema.shape,
  today: ReferenceDaySchema,
  currency: currencyCodeSchema('Currency').optional(),
  status: z
    .enum(
      SERIES_STATUSES,
      `Status must be one of ${SERIES_STATUSES.join(', ')}`
    )
    .optional()
});

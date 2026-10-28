import { z } from 'zod';

import {
  FinanceLimits,
  InstallmentPlanStatuses,
  RecurrenceFrequencies
} from '@/config/Constants';

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

const PLAN_STATUSES = Object.values(InstallmentPlanStatuses);

export const InstallmentPlanIdSchema = financeIdSchema('Installment plan id');

export const InstallmentPlanParamsSchema = z.object({
  id: InstallmentPlanIdSchema
});

export const InstallmentPlanReadSchema = z.object({
  id: InstallmentPlanIdSchema,
  today: ReferenceDaySchema
});

const installmentCountSchema = (field: string) =>
  z.coerce
    .number(`${field} must be a number`)
    .int(`${field} must be an integer`)
    .min(1, `${field} must be at least 1`)
    .max(
      FinanceLimits.INSTALLMENT_MAX_COUNT,
      `${field} must be at most ${FinanceLimits.INSTALLMENT_MAX_COUNT}`
    );

const ONE_AMOUNT_MESSAGE =
  'Give either the total amount or the installment amount';

/** Exactly one of the two: the sum of the installments, or each one's amount. */
const requireOneAmount = (
  {
    totalAmount,
    installmentAmount
  }: Partial<Record<'totalAmount' | 'installmentAmount', string>>,
  ctx: z.RefinementCtx
) => {
  if ((totalAmount === undefined) === (installmentAmount === undefined))
    ctx.addIssue({
      code: 'custom',
      path: ['totalAmount'],
      message: ONE_AMOUNT_MESSAGE
    });
};

export const CreateInstallmentPlanSchema = z
  .object({
    ...ExpenseDescriptionSchema.shape,
    currency: currencyCodeSchema('Currency'),
    totalAmount: positiveDecimalSchema('Total amount').optional(),
    installmentAmount: positiveDecimalSchema('Installment amount').optional(),
    principalAmount: positiveDecimalSchema('Cash price')
      .nullable()
      .default(null),
    installmentCount: installmentCountSchema('Installment count'),
    firstDueDate: calendarDaySchema('First due date'),
    frequency: RecurrenceFrequencySchema.default(RecurrenceFrequencies.MONTHLY),
    entryDate: calendarDaySchema('Entry date').optional()
  })
  .superRefine(requireOneAmount)
  .superRefine(
    requireMinorUnits(['totalAmount', 'installmentAmount', 'principalAmount'])
  )
  .transform(({ totalAmount, installmentAmount, ...plan }, ctx) => {
    if (totalAmount !== undefined) return { ...plan, amount: { totalAmount } };
    if (installmentAmount !== undefined)
      return { ...plan, amount: { installmentAmount } };

    ctx.addIssue({
      code: 'custom',
      path: ['totalAmount'],
      message: ONE_AMOUNT_MESSAGE
    });

    return z.NEVER;
  });

/** Descriptive fields only; what is owed changes through a reschedule. */
export const UpdateInstallmentPlanSchema = z.object({
  ...ExpenseDescriptionPatchSchema.shape,
  id: InstallmentPlanIdSchema,
  principalAmount: positiveDecimalSchema('Cash price').nullable().optional()
});

/**
 * Replaces the installments after the last one with payments by
 * `remainingCount` new ones adding up to `remainingAmount`, at the plan's
 * frequency from `nextDueDate`.
 */
export const RescheduleInstallmentPlanSchema = z.object({
  id: InstallmentPlanIdSchema,
  remainingAmount: positiveDecimalSchema('Remaining amount'),
  remainingCount: installmentCountSchema('Remaining installment count'),
  nextDueDate: calendarDaySchema('Next due date')
});

export const GetInstallmentPlansQuerySchema = z.object({
  ...PageQuerySchema.shape,
  currency: currencyCodeSchema('Currency').optional(),
  status: z
    .enum(PLAN_STATUSES, `Status must be one of ${PLAN_STATUSES.join(', ')}`)
    .optional()
});

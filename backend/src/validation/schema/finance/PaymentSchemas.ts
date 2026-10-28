import { z } from 'zod';

import { FinanceLimits, FinanceMessages } from '@/config/Constants';
import { differenceInDays, utcToday } from '@/domain/CalendarDay';

import { boundedTextSchema } from '../BoundedTextSchema';
import { currencyCodeSchema } from '../CurrencyCodeSchema';
import { decimalSchema } from '../DecimalSchema';
import { PageQuerySchema } from '../PaginationQuerySchema';
import { ExpenseIdSchema } from './ExpenseSchemas';
import {
  calendarDaySchema,
  financeIdSchema,
  PaymentMethodSchema
} from './FinanceFieldSchemas';

const PaymentIdSchema = financeIdSchema('Payment id');

const PaymentEntrySchema = z.object({
  amount: decimalSchema('Amount'),
  discount: decimalSchema('Discount').default('0'),
  fees: decimalSchema('Fees').default('0'),
  paidOn: calendarDaySchema('Payment date').refine(
    (day) =>
      differenceInDays(day, utcToday()) <=
      FinanceLimits.REFERENCE_DAY_TOLERANCE_DAYS,
    FinanceMessages.PAYMENT_IN_FUTURE
  ),
  method: PaymentMethodSchema.nullable().default(null),
  notes: boundedTextSchema('Notes', FinanceLimits.NOTES_MAX_LENGTH)
    .nullable()
    .default(null)
});

const POSITIVE = /[1-9]/;

/** A payment must settle something: an amount, a discount, or both. */
const requireSettlement = (
  { amount, discount }: Partial<Record<'amount' | 'discount', string>>,
  ctx: z.RefinementCtx
) => {
  if (
    amount !== undefined &&
    discount !== undefined &&
    !POSITIVE.test(amount) &&
    !POSITIVE.test(discount)
  )
    ctx.addIssue({
      code: 'custom',
      path: ['amount'],
      message: FinanceMessages.PAYMENT_EMPTY
    });
};

export const PaymentParamsSchema = z.object({
  id: ExpenseIdSchema,
  paymentId: PaymentIdSchema
});

export const RecordPaymentSchema = z
  .object({ ...PaymentEntrySchema.shape, id: ExpenseIdSchema })
  .superRefine(requireSettlement);

export const UpdatePaymentSchema = z
  .object({
    ...PaymentParamsSchema.shape,
    amount: PaymentEntrySchema.shape.amount.optional(),
    discount: decimalSchema('Discount').optional(),
    fees: decimalSchema('Fees').optional(),
    paidOn: PaymentEntrySchema.shape.paidOn.optional(),
    method: PaymentMethodSchema.nullable().optional(),
    notes: PaymentEntrySchema.shape.notes.unwrap().optional()
  })
  .superRefine(requireSettlement);

export const GetPaymentsQuerySchema = z.object({
  ...PageQuerySchema.shape,
  currency: currencyCodeSchema('Currency').optional(),
  paidFrom: calendarDaySchema('Paid from').optional(),
  paidTo: calendarDaySchema('Paid to').optional(),
  includeVoided: z
    .enum(['true', 'false'], 'Include voided must be true or false')
    .transform((value) => value === 'true')
    .default(false)
});

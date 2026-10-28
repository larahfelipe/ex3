import { z } from 'zod';

import {
  ExpenseSortFields,
  FinanceLimits,
  SortOrderTypes
} from '@/config/Constants';

import { boundedTextSchema } from '../BoundedTextSchema';
import { currencyCodeSchema } from '../CurrencyCodeSchema';
import { decimalSchema, positiveDecimalSchema } from '../DecimalSchema';
import { PageQuerySchema } from '../PaginationQuerySchema';
import {
  calendarDaySchema,
  ExpenseCategorySchema,
  ExpenseDescriptionPatchSchema,
  ExpenseDescriptionSchema,
  ExpenseKindSchema,
  ExpenseStatusFilterSchema,
  financeIdSchema,
  ReferenceDaySchema,
  requireMinorUnits
} from './FinanceFieldSchemas';

const EXPENSE_SORT_FIELDS = Object.values(ExpenseSortFields);
const SORT_ORDERS = Object.values(SortOrderTypes);

export const ExpenseIdSchema = financeIdSchema('Expense id');

export const ExpenseParamsSchema = z.object({ id: ExpenseIdSchema });

export const ExpenseReadSchema = z.object({
  id: ExpenseIdSchema,
  today: ReferenceDaySchema
});

/** No payment is part of a new expense: it is owed until a payment is recorded for it. */
export const CreateExpenseSchema = z
  .object({
    ...ExpenseDescriptionSchema.shape,
    amount: positiveDecimalSchema('Amount'),
    currency: currencyCodeSchema('Currency'),
    dueDate: calendarDaySchema('Due date'),
    entryDate: calendarDaySchema('Entry date').optional()
  })
  .superRefine(requireMinorUnits(['amount']));

/**
 * The currency is fixed at creation, so the amount's precision is checked
 * against the stored one by the service. `cancelled` cancels or restores the
 * expense.
 */
export const UpdateExpenseSchema = z.object({
  ...ExpenseDescriptionPatchSchema.shape,
  id: ExpenseIdSchema,
  amount: positiveDecimalSchema('Amount').optional(),
  dueDate: calendarDaySchema('Due date').optional(),
  entryDate: calendarDaySchema('Entry date').optional(),
  cancelled: z.boolean('Cancelled must be a boolean').optional()
});

export const GetExpensesQuerySchema = z.object({
  ...PageQuerySchema.shape,
  today: ReferenceDaySchema,
  sortBy: z
    .enum(
      EXPENSE_SORT_FIELDS,
      `Sort field must be one of ${EXPENSE_SORT_FIELDS.join(', ')}`
    )
    .default(ExpenseSortFields.DUE_DATE),
  sortOrder: z
    .enum(SORT_ORDERS, `Sort order must be one of ${SORT_ORDERS.join(', ')}`)
    .default(SortOrderTypes.ASCENDENT),
  search: boundedTextSchema(
    'Search',
    FinanceLimits.SEARCH_MAX_LENGTH
  ).optional(),
  status: ExpenseStatusFilterSchema.optional(),
  kind: ExpenseKindSchema.optional(),
  category: ExpenseCategorySchema.optional(),
  currency: currencyCodeSchema('Currency').optional(),
  dueFrom: calendarDaySchema('Due from').optional(),
  dueTo: calendarDaySchema('Due to').optional(),
  minAmount: decimalSchema('Minimum amount').optional(),
  maxAmount: decimalSchema('Maximum amount').optional(),
  installmentPlanId: financeIdSchema('Installment plan id').optional(),
  recurringExpenseId: financeIdSchema('Recurring expense id').optional()
});

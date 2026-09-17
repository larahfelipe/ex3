import { z } from 'zod';

import { TransactionTypes } from '@/config/Constants';

import { boundedTextSchema } from '../BoundedTextSchema';
import { currencyCodeSchema } from '../CurrencyCodeSchema';
import {
  decimalSchema,
  NONZERO_DIGIT,
  positiveDecimalSchema
} from '../DecimalSchema';
import { TransactionTypeSchema } from './TransactionTypeSchema';

/**
 * Bounds the free-text fields (OWASP API4:2023, unrestricted resource
 * consumption). Assumed, not measured: above a broker's name and a short note.
 */
const BROKER_MAX_LENGTH = 60;
const NOTES_MAX_LENGTH = 500;

export const TransactionBrokerSchema = boundedTextSchema(
  'Transaction broker',
  BROKER_MAX_LENGTH
);

export const ExecutionTimeSchema = z.iso
  .datetime({
    offset: true,
    error:
      'Transaction execution time must be an ISO 8601 date-time with a time zone'
  })
  .transform((value) => new Date(value));

export const TransactionEntrySchema = z.object({
  type: TransactionTypeSchema,
  quantity: positiveDecimalSchema('Transaction quantity'),
  unitPrice: decimalSchema('Transaction unit price'),
  fees: decimalSchema('Transaction fees').default('0'),
  taxes: decimalSchema('Transaction taxes').default('0'),
  currency: currencyCodeSchema('Transaction currency'),
  executedAt: ExecutionTimeSchema,
  broker: TransactionBrokerSchema.nullable().default(null),
  notes: boundedTextSchema('Transaction notes', NOTES_MAX_LENGTH)
    .nullable()
    .default(null)
});

export const requireUnitPriceUnlessBonus = (
  {
    type,
    unitPrice
  }: Pick<z.output<typeof TransactionEntrySchema>, 'type' | 'unitPrice'>,
  ctx: z.RefinementCtx
) => {
  if (type !== TransactionTypes.BONUS && !NONZERO_DIGIT.test(unitPrice))
    ctx.addIssue({
      code: 'custom',
      path: ['unitPrice'],
      message: 'Transaction unit price must be greater than zero'
    });
};

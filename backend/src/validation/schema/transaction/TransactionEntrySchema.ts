import { z } from 'zod';

import { boundedTextSchema } from '../BoundedTextSchema';
import { currencyCodeSchema } from '../CurrencyCodeSchema';
import { decimalSchema, positiveDecimalSchema } from '../DecimalSchema';
import { TransactionTypeSchema } from './TransactionTypeSchema';

/**
 * Bounds the free-text fields (OWASP API4:2023, unrestricted resource
 * consumption). Assumed, not measured: above a broker's name and a short note.
 */
const BROKER_MAX_LENGTH = 60;
const NOTES_MAX_LENGTH = 500;

export const TransactionEntrySchema = z.object({
  type: TransactionTypeSchema,
  quantity: positiveDecimalSchema('Transaction quantity'),
  unitPrice: positiveDecimalSchema('Transaction unit price'),
  fees: decimalSchema('Transaction fees').default('0'),
  taxes: decimalSchema('Transaction taxes').default('0'),
  currency: currencyCodeSchema('Transaction currency'),
  executedAt: z.iso
    .datetime({
      offset: true,
      error:
        'Transaction execution time must be an ISO 8601 date-time with a time zone'
    })
    .transform((value) => new Date(value)),
  broker: boundedTextSchema('Transaction broker', BROKER_MAX_LENGTH)
    .nullable()
    .default(null),
  notes: boundedTextSchema('Transaction notes', NOTES_MAX_LENGTH)
    .nullable()
    .default(null)
});

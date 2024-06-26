import { z } from 'zod';

import { TransactionTypes } from '@/config';
import type { TransactionType } from '@/domain/models';

export const CreateTransactionSchema = z.object({
  type: z
    .string()
    .min(3, 'Transaction type must have at least 3 characters')
    .max(4, 'Transaction type must have at most 4 characters')
    .transform((value) => value.trim().toUpperCase())
    .refine(
      (value) =>
        Object.values(TransactionTypes).includes(value as TransactionType),
      {
        message: 'Transaction type must be either `BUY` or `SELL`'
      }
    ),
  amount: z.number().positive('Transaction amount must be greater than zero'),
  price: z.number().positive('Transaction price must be greater than zero'),
  assetSymbol: z
    .string()
    .min(1, 'Asset symbol must have at least 1 character')
    .max(6, 'Asset symbol must have at most 6 characters')
    .transform((value) => value.trim().toUpperCase())
});

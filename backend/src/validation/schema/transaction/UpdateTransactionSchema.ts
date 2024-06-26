import { z } from 'zod';

import type { TransactionType } from '@/domain/models';

const transactionTypes: Array<TransactionType> = ['BUY', 'SELL'];

export const UpdateTransactionSchema = z.object({
  id: z
    .string()
    .min(1, 'Asset id must have at least 1 character')
    .transform((value) => value.trim()),
  type: z
    .string()
    .min(3, 'Transaction type must have at least 3 characters')
    .max(4, 'Transaction type must have at most 4 characters')
    .transform((value) => value.trim().toUpperCase())
    .refine((value) => transactionTypes.includes(value as TransactionType), {
      message: 'Transaction type must be either BUY or SELL'
    }),
  amount: z.number().positive('Transaction amount must be greater than zero'),
  price: z.number().positive('Transaction price must be greater than zero')
});

import { z } from 'zod';

import { TransactionIdSchema } from './TransactionIdSchema';
import { TransactionTypeSchema } from './TransactionTypeSchema';

export const UpdateTransactionSchema = z.object({
  id: TransactionIdSchema,
  type: TransactionTypeSchema,
  amount: z.number().positive('Transaction amount must be greater than zero'),
  price: z.number().positive('Transaction price must be greater than zero')
});

import { z } from 'zod';

import { TransactionEntrySchema } from './TransactionEntrySchema';
import { TransactionIdSchema } from './TransactionIdSchema';

export const UpdateTransactionSchema = z.object({
  id: TransactionIdSchema,
  ...TransactionEntrySchema.shape
});

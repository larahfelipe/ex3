import { z } from 'zod';

import { TransactionIdSchema } from './TransactionIdSchema';

export const DeleteTransactionSchema = z.object({
  id: TransactionIdSchema
});

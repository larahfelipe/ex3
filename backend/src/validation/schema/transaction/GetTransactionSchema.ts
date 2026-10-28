import { z } from 'zod';

import { TransactionIdSchema } from './TransactionIdSchema';

export const GetTransactionSchema = z.object({
  id: TransactionIdSchema
});

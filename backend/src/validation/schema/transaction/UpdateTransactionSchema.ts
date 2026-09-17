import { z } from 'zod';

import {
  requireUnitPriceUnlessBonus,
  TransactionEntrySchema
} from './TransactionEntrySchema';
import { TransactionIdSchema } from './TransactionIdSchema';

export const UpdateTransactionSchema = z
  .object({
    id: TransactionIdSchema,
    ...TransactionEntrySchema.shape
  })
  .superRefine(requireUnitPriceUnlessBonus);

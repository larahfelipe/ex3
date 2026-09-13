import { z } from 'zod';

// From the module, not the `@/config` barrel: the barrel is still initializing
// when this schema loads, and `z.enum` reads the object right away.
import { RecordableTransactionTypes } from '@/config/Constants';

export const TransactionTypeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .pipe(
    z.enum(
      RecordableTransactionTypes,
      'Transaction type must be either `BUY` or `SELL`'
    )
  );

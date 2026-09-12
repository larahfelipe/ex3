import { z } from 'zod';

export const TransactionIdSchema = z.uuid('Transaction id must be a UUID');

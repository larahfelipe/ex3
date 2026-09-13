import { TransactionMessages } from '@/config/Constants';
import { BadRequestError } from '@/errors';
import type { TransactionRepository } from '@/infra/database';

type LedgerRefusal = Exclude<
  Awaited<ReturnType<TransactionRepository['delete']>>,
  { outcome: 'recorded' | 'not-found' }
>;

const REFUSAL_MESSAGES = {
  'negative-amount': TransactionMessages.ACC_NEGATIVE_AMOUNT,
  'currency-mismatch': TransactionMessages.CURRENCY_MISMATCH,
  'out-of-range': TransactionMessages.POSITION_OUT_OF_RANGE
} satisfies Record<LedgerRefusal['outcome'], string>;

export const ledgerRefusalError = ({ outcome }: LedgerRefusal) =>
  new BadRequestError(REFUSAL_MESSAGES[outcome]);

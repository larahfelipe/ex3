import type { FC } from 'react';

import { twMerge } from 'tailwind-merge';

import type { ListedTransaction } from '@/app/api/v1/transactions';
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_TONES
} from '@/common/constants';
import {
  formatExecutionTime,
  formatMoney,
  formatPrice,
  formatQuantity
} from '@/common/utils';
import { UnavailableValue } from '@/components/amounts';
import {
  Button,
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui';
import type { Children } from '@/types';

type TransactionDetailsDialogProps = Record<
  'transaction',
  ListedTransaction | null
> &
  Record<'onClose', VoidFunction>;

type DetailItemProps = Children &
  Record<'label', string> &
  Partial<Record<'className', string>>;

const DetailItem: FC<DetailItemProps> = ({ label, className, children }) => (
  <div className={twMerge('min-w-0 space-y-1', className)}>
    <dt className="text-sm text-muted-foreground">{label}</dt>

    <dd className="font-medium wrap-anywhere">{children}</dd>
  </div>
);

const TransactionDetails: FC<Record<'transaction', ListedTransaction>> = ({
  transaction: {
    type,
    symbol,
    executedAt,
    quantity,
    unitPrice,
    currency,
    fees,
    taxes,
    broker,
    notes
  }
}) => (
  <>
    <DialogHeader>
      <DialogTitle>
        <span className={TRANSACTION_TYPE_TONES[type]}>
          {TRANSACTION_TYPE_LABELS[type]}
        </span>

        {` ${symbol}`}
      </DialogTitle>

      <DialogDescription>
        {'Executed on '}

        <time dateTime={executedAt}>{formatExecutionTime(executedAt)}</time>
      </DialogDescription>
    </DialogHeader>

    <dl className="grid gap-4 sm:grid-cols-2">
      <DetailItem label="Quantity">{formatQuantity(quantity)}</DetailItem>

      <DetailItem label="Unit price">
        {formatPrice(unitPrice, currency)}
      </DetailItem>

      <DetailItem label="Fees">{formatMoney(fees, currency)}</DetailItem>

      <DetailItem label="Taxes">{formatMoney(taxes, currency)}</DetailItem>

      <DetailItem label="Broker">{broker ?? <UnavailableValue />}</DetailItem>

      <DetailItem label="Notes" className="sm:col-span-2">
        {notes ?? <UnavailableValue />}
      </DetailItem>
    </dl>

    <DialogFooter>
      <DialogClose asChild>
        <Button variant="secondary">Close</Button>
      </DialogClose>
    </DialogFooter>
  </>
);

export const TransactionDetailsDialog: FC<TransactionDetailsDialogProps> = ({
  transaction,
  onClose
}) => (
  <Dialog open={transaction !== null} onOpenChange={onClose}>
    <DialogContent>
      {transaction !== null && <TransactionDetails transaction={transaction} />}
    </DialogContent>
  </Dialog>
);

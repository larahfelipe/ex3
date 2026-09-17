import type { FC } from 'react';

import type { ListedTransaction } from '@/app/api/v1/transactions';
import {
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPE_TONES,
  TRANSACTION_UNIT_PRICE_LABELS
} from '@/common/constants';
import {
  formatExecutionTime,
  formatMoney,
  formatPrice,
  formatQuantity
} from '@/common/utils';
import { UnavailableValue } from '@/components/amounts';
import { DetailItem } from '@/components/detail-item';
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

type TransactionAction = (transaction: ListedTransaction) => void;

type TransactionActions = Record<'onEdit' | 'onDelete', TransactionAction>;

type TransactionDetailsDialogProps = Record<
  'transaction',
  ListedTransaction | null
> &
  Record<'onClose', VoidFunction> &
  TransactionActions;

const TransactionDetails: FC<
  Record<'transaction', ListedTransaction> & TransactionActions
> = ({ transaction, onEdit, onDelete }) => {
  const {
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
  } = transaction;

  return (
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

        <DetailItem label={TRANSACTION_UNIT_PRICE_LABELS[type]}>
          {formatPrice(unitPrice, currency)}
        </DetailItem>

        <DetailItem label="Fees">{formatMoney(fees, currency)}</DetailItem>

        <DetailItem label="Taxes">{formatMoney(taxes, currency)}</DetailItem>

        <DetailItem label="Broker">{broker ?? <UnavailableValue />}</DetailItem>

        <DetailItem label="Notes" className="sm:col-span-2">
          {notes ?? <UnavailableValue />}
        </DetailItem>
      </dl>

      <DialogFooter className="gap-2 sm:space-x-0">
        <Button
          variant="outline"
          className="text-destructive hover:text-destructive sm:mr-auto"
          onClick={() => onDelete(transaction)}
        >
          Delete
        </Button>

        <DialogClose asChild>
          <Button variant="secondary">Close</Button>
        </DialogClose>

        <Button onClick={() => onEdit(transaction)}>Edit</Button>
      </DialogFooter>
    </>
  );
};

export const TransactionDetailsDialog: FC<TransactionDetailsDialogProps> = ({
  transaction,
  onClose,
  onEdit,
  onDelete
}) => (
  <Dialog open={transaction !== null} onOpenChange={onClose}>
    <DialogContent>
      {transaction !== null && (
        <TransactionDetails
          transaction={transaction}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      )}
    </DialogContent>
  </Dialog>
);

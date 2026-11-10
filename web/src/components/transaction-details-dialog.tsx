import type { FC } from 'react';

import { useTranslations } from 'use-intl';

import type { ListedTransaction } from '@/app/api/v1/transactions';
import { TRANSACTION_TYPE_TONES } from '@/common/constants';
import {
  Metric,
  Money,
  Price,
  Quantity,
  UnavailableValue
} from '@/components/financial';
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
import { useFormat } from '@/i18n/format';

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
  const t = useTranslations('transactions');
  const tActions = useTranslations('common.actions');
  const { formatExecutionDay } = useFormat();
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
          {t.rich('details.title', {
            type: t(`types.${type}`),
            symbol,
            tone: (chunks) => (
              <span className={TRANSACTION_TYPE_TONES[type]}>{chunks}</span>
            )
          })}
        </DialogTitle>

        <DialogDescription>
          {t.rich('details.executedOn', {
            date: formatExecutionDay(executedAt),
            executed: (chunks) => <time dateTime={executedAt}>{chunks}</time>
          })}
        </DialogDescription>
      </DialogHeader>

      <dl className="grid gap-4 sm:grid-cols-2">
        <Metric label={t('fields.quantity')}>
          <Quantity value={quantity} />
        </Metric>

        <Metric label={t(`unitPrice.${type}`)}>
          <Price exact value={unitPrice} currency={currency} />
        </Metric>

        <Metric label={t('fields.fees')}>
          <Money value={fees} currency={currency} />
        </Metric>

        <Metric label={t('fields.taxes')}>
          <Money value={taxes} currency={currency} />
        </Metric>

        <Metric label={t('fields.broker')}>
          {broker ?? <UnavailableValue />}
        </Metric>

        <Metric label={t('fields.notes')} className="sm:col-span-2">
          {notes ?? <UnavailableValue />}
        </Metric>
      </dl>

      <DialogFooter>
        <Button
          variant="destructive-subtle"
          className="sm:mr-auto"
          onClick={() => onDelete(transaction)}
        >
          {tActions('delete')}
        </Button>

        <DialogClose asChild>
          <Button variant="secondary">{tActions('close')}</Button>
        </DialogClose>

        <Button onClick={() => onEdit(transaction)}>{tActions('edit')}</Button>
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

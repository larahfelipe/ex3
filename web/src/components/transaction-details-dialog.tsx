import type { FC } from 'react';

import { Pencil, Trash2 } from 'lucide-react';
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
  Dialog,
  DialogActionFooter,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  IconButton
} from '@/components/ui';
import { useFormat } from '@/i18n/format';

type TransactionAction = (transaction: ListedTransaction) => void;

type TransactionActions = Record<'onEdit' | 'onDelete', TransactionAction>;

type TransactionDetailsDialogProps = Record<'transaction', ListedTransaction> &
  Record<'onClose', VoidFunction> &
  TransactionActions;

const TransactionDetails: FC<
  Record<'transaction', ListedTransaction> & TransactionActions
> = ({ transaction, onEdit, onDelete }) => {
  const t = useTranslations('transactions');
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

      <DialogBody>
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
      </DialogBody>

      <DialogActionFooter
        tools={
          <>
            <IconButton
              icon={Pencil}
              label={t('details.edit')}
              onClick={() => onEdit(transaction)}
            />

            <IconButton
              icon={Trash2}
              variant="ghost-destructive"
              label={t('details.delete')}
              onClick={() => onDelete(transaction)}
            />
          </>
        }
      />
    </>
  );
};

export const TransactionDetailsDialog: FC<TransactionDetailsDialogProps> = ({
  transaction,
  onClose,
  onEdit,
  onDelete
}) => (
  <Dialog open onOpenChange={onClose}>
    <DialogContent>
      <TransactionDetails
        transaction={transaction}
        onEdit={onEdit}
        onDelete={onDelete}
      />
    </DialogContent>
  </Dialog>
);

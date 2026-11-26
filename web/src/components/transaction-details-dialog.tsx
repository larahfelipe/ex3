import type { FC } from 'react';

import { Pencil, Trash2 } from 'lucide-react';
import { useTranslations } from 'use-intl';

import type { ListedTransaction } from '@/app/api/v1/transactions';
import { TRANSACTION_TYPE_TONES } from '@/common/constants';
import {
  DetailSection,
  FACT_LIST_CLASS,
  FACT_VALUE_CLASS,
  SUMMARY_DETAIL_CLASS,
  SUMMARY_PANEL_CLASS,
  SUMMARY_VALUE_CLASS
} from '@/components/detail-section';
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
import { isNonzeroDecimal } from '@/lib/decimal';
import { isCostOf, transactionEffectOf } from '@/lib/transaction-effect';
import { cn } from '@/lib/utils';

type TransactionAction = (transaction: ListedTransaction) => void;

type TransactionActions = Record<'onEdit' | 'onDelete', TransactionAction>;

type TransactionDetailsDialogProps = Record<'transaction', ListedTransaction> &
  Record<'onClose', VoidFunction> &
  TransactionActions;

const TransactionDetails: FC<
  Record<'transaction', ListedTransaction> & TransactionActions
> = ({ transaction, onEdit, onDelete }) => {
  const t = useTranslations('transactions');
  const { formatExecutionDay, formatMoney, formatPrice, formatQuantity } =
    useFormat();
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
  const effect = transactionEffectOf(type, {
    quantity,
    unitPrice,
    fees,
    taxes
  });

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

      <DialogBody className="gap-5">
        <dl className={cn(SUMMARY_PANEL_CLASS, 'sm:grid-cols-2')}>
          <Metric
            label={t(`form.effect.${type}`)}
            className="sm:col-span-2"
            valueClassName={SUMMARY_VALUE_CLASS}
          >
            {effect === null ? (
              <UnavailableValue />
            ) : (
              <>
                {formatMoney(effect.net, currency)}

                <span className={SUMMARY_DETAIL_CLASS}>
                  {t(
                    !isNonzeroDecimal(effect.charges)
                      ? 'form.effectOf.units'
                      : isCostOf(type)
                        ? 'form.effectOf.unitsPlusCharges'
                        : 'form.effectOf.unitsLessCharges',
                    {
                      quantity: formatQuantity(effect.quantity),
                      unitPrice: formatPrice(effect.unitPrice, currency),
                      charges: formatMoney(effect.charges, currency)
                    }
                  )}
                </span>
              </>
            )}
          </Metric>

          <Metric
            label={t('fields.quantity')}
            valueClassName={FACT_VALUE_CLASS}
          >
            <Quantity value={quantity} />
          </Metric>

          <Metric
            label={t(`unitPrice.${type}`)}
            valueClassName={FACT_VALUE_CLASS}
          >
            <Price exact value={unitPrice} currency={currency} />
          </Metric>
        </dl>

        <DetailSection title={t('details.facts')}>
          <dl className={FACT_LIST_CLASS}>
            <Metric label={t('fields.fees')} valueClassName={FACT_VALUE_CLASS}>
              <Money value={fees} currency={currency} />
            </Metric>

            <Metric label={t('fields.taxes')} valueClassName={FACT_VALUE_CLASS}>
              <Money value={taxes} currency={currency} />
            </Metric>

            {broker !== null && (
              <Metric
                label={t('fields.broker')}
                valueClassName={FACT_VALUE_CLASS}
              >
                {broker}
              </Metric>
            )}

            {notes !== null && (
              <Metric
                label={t('fields.notes')}
                className="sm:col-span-2"
                valueClassName="text-sm font-normal whitespace-pre-line"
              >
                {notes}
              </Metric>
            )}
          </dl>
        </DetailSection>
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

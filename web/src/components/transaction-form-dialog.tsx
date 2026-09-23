import { useId, type FC } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type {
  ListedTransaction,
  TransactionType
} from '@/app/api/v1/transactions';
import {
  CURRENCIES,
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPES,
  TRANSACTION_UNIT_PRICE_LABELS
} from '@/common/constants';
import { ChoiceField, FormField } from '@/components/form-field';
import { SubmitButton } from '@/components/submit-button';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  SegmentedControl,
  SegmentedControlItem
} from '@/components/ui';
import { presentSubmitError } from '@/lib/submit-error';

export type TransactionFormTarget =
  | { kind: 'create'; symbol: string; currency: string }
  | { kind: 'edit'; transaction: ListedTransaction };

export type TransactionDraft = z.output<typeof TransactionFormSchema>;

type TransactionFormDialogProps = {
  target: TransactionFormTarget;
  onCancel: VoidFunction;
  onSubmit: (draft: TransactionDraft) => Promise<unknown>;
};

type TransactionFormInput = z.input<typeof TransactionFormSchema>;

type TransactionFormField = keyof TransactionFormInput;

/** The API stores quantities and prices as DECIMAL(38,18), rejects what the column would round and bounds broker and notes to these lengths. */
const DECIMAL_COLUMN = { PRECISION: 38, SCALE: 18 } as const;
const BROKER_MAX_LENGTH = 60;
const NOTES_MAX_LENGTH = 500;

const INTEGER_DIGITS = DECIMAL_COLUMN.PRECISION - DECIMAL_COLUMN.SCALE;

const DECIMAL_PATTERN = new RegExp(
  `^(0|[1-9]\\d{0,${INTEGER_DIGITS - 1}})(\\.\\d{1,${DECIMAL_COLUMN.SCALE}})?$`
);

const NONZERO_DIGIT = /[1-9]/;

const MS_PER_MINUTE = 60_000;

const LOCAL_DATE_TIME_LENGTH = 'YYYY-MM-DDTHH:mm:ss'.length;

const SUBMIT_FAILURE_MESSAGE = 'The transaction could not be saved';

const decimalFormatMessage = (field: string) =>
  `${field} must use a dot for decimals, with at most ${INTEGER_DIGITS} integer digits and ${DECIMAL_COLUMN.SCALE} decimal places`;

const positiveDecimalField = (field: string) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required`)
    .regex(DECIMAL_PATTERN, decimalFormatMessage(field))
    .regex(NONZERO_DIGIT, `${field} must be greater than zero`);

const chargeField = (field: string) =>
  z
    .string()
    .trim()
    .transform((value) => (value === '' ? '0' : value))
    .pipe(z.string().regex(DECIMAL_PATTERN, decimalFormatMessage(field)));

const optionalTextField = (field: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `${field} must have at most ${maxLength} characters`)
    .transform((value) => (value === '' ? null : value));

const unitPriceIssueOf = (type: TransactionType, unitPrice: string) => {
  const label = TRANSACTION_UNIT_PRICE_LABELS[type];

  if (unitPrice === '') return `${label} is required`;
  if (!DECIMAL_PATTERN.test(unitPrice)) return decimalFormatMessage(label);
  if (type !== 'BONUS' && !NONZERO_DIGIT.test(unitPrice))
    return `${label} must be greater than zero`;

  return null;
};

const TransactionFormSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    quantity: positiveDecimalField('Quantity'),
    unitPrice: z.string().trim(),
    fees: chargeField('Fees'),
    taxes: chargeField('Taxes'),
    executedAt: z
      .string()
      .min(1, 'Execution date is required')
      .transform((value) => new Date(value))
      .pipe(z.date('Execution date must be a valid date'))
      .transform((date) => date.toISOString()),
    broker: optionalTextField('Broker', BROKER_MAX_LENGTH),
    notes: optionalTextField('Notes', NOTES_MAX_LENGTH)
  })
  .superRefine(({ type, unitPrice }, ctx) => {
    const message = unitPriceIssueOf(type, unitPrice);

    if (message !== null)
      ctx.addIssue({ code: 'custom', path: ['unitPrice'], message });
  });

const TRANSACTION_FORM_FIELDS = TransactionFormSchema.keyof().options;

const EMPTY_TRANSACTION_FORM: TransactionFormInput = {
  type: 'BUY',
  quantity: '',
  unitPrice: '',
  fees: '',
  taxes: '',
  executedAt: '',
  broker: '',
  notes: ''
};

const isTransactionFormField = (path: string): path is TransactionFormField =>
  TRANSACTION_FORM_FIELDS.some((field) => field === path);

const toLocalDateTime = (isoDateTime: string) => {
  const date = new Date(isoDateTime);

  return new Date(date.getTime() - date.getTimezoneOffset() * MS_PER_MINUTE)
    .toISOString()
    .slice(0, LOCAL_DATE_TIME_LENGTH);
};

const toTransactionFormValues = ({
  type,
  quantity,
  unitPrice,
  fees,
  taxes,
  executedAt,
  broker,
  notes
}: ListedTransaction): TransactionFormInput => ({
  type,
  quantity,
  unitPrice,
  fees,
  taxes,
  executedAt: toLocalDateTime(executedAt),
  broker: broker ?? '',
  notes: notes ?? ''
});

export const TransactionFormDialog: FC<TransactionFormDialogProps> = ({
  target,
  onCancel,
  onSubmit
}) => {
  const formId = useId();

  const { symbol, currency, defaultValues } =
    target.kind === 'create'
      ? {
          symbol: target.symbol,
          currency: target.currency,
          defaultValues: EMPTY_TRANSACTION_FORM
        }
      : {
          symbol: target.transaction.symbol,
          currency: target.transaction.currency,
          defaultValues: toTransactionFormValues(target.transaction)
        };

  const currencySymbol =
    Object.values(CURRENCIES).find(({ id }) => id === currency)?.symbol ??
    currency;

  const currencyAdornment = (
    <span aria-hidden className="text-sm text-muted-foreground">
      {currencySymbol}
    </span>
  );

  const {
    control: formControl,
    register,
    handleSubmit,
    setError,
    formState: { errors, dirtyFields, isSubmitting }
  } = useForm<TransactionFormInput, unknown, TransactionDraft>({
    mode: 'onTouched',
    resolver: zodResolver(TransactionFormSchema),
    defaultValues
  });

  const selectedType = useWatch({ control: formControl, name: 'type' });

  const submitDraft = async (draft: TransactionDraft) => {
    const isOriginalExecutionTime =
      target.kind === 'edit' && dirtyFields.executedAt !== true;

    try {
      await onSubmit({
        ...draft,
        executedAt: isOriginalExecutionTime
          ? target.transaction.executedAt
          : draft.executedAt
      });
    } catch (error) {
      presentSubmitError(error, {
        setError,
        fieldOf: (path) => (isTransactionFormField(path) ? path : undefined),
        fallbackMessage: SUBMIT_FAILURE_MESSAGE
      });
    }
  };

  return (
    <Dialog
      open
      onOpenChange={() => {
        if (!isSubmitting) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {target.kind === 'create'
              ? `Add ${symbol} transaction`
              : `Edit ${symbol} transaction`}
          </DialogTitle>

          <DialogDescription>
            {`Amounts in ${currency}. Fees and taxes left blank are recorded as zero.`}
          </DialogDescription>
        </DialogHeader>

        <form id={formId} noValidate onSubmit={handleSubmit(submitDraft)}>
          <div className="grid gap-4 sm:grid-cols-2">
            <ChoiceField
              legend="Type"
              error={errors.type?.message}
              className="sm:col-span-2"
            >
              <SegmentedControl className="grid grid-cols-3 sm:flex sm:w-fit">
                {TRANSACTION_TYPES.map((type) => (
                  <SegmentedControlItem
                    key={type}
                    value={type}
                    {...register('type')}
                  >
                    {TRANSACTION_TYPE_LABELS[type]}
                  </SegmentedControlItem>
                ))}
              </SegmentedControl>
            </ChoiceField>

            <FormField label="Quantity" error={errors.quantity?.message}>
              {(control) => (
                <Input
                  {...control}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  {...register('quantity')}
                />
              )}
            </FormField>

            <FormField
              label={`${TRANSACTION_UNIT_PRICE_LABELS[selectedType]} (${currency})`}
              error={errors.unitPrice?.message}
            >
              {(control) => (
                <Input
                  {...control}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  leftElement={currencyAdornment}
                  {...register('unitPrice')}
                />
              )}
            </FormField>

            <FormField
              isOptional
              label={`Fees (${currency})`}
              error={errors.fees?.message}
            >
              {(control) => (
                <Input
                  {...control}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  leftElement={currencyAdornment}
                  {...register('fees')}
                />
              )}
            </FormField>

            <FormField
              isOptional
              label={`Taxes (${currency})`}
              error={errors.taxes?.message}
            >
              {(control) => (
                <Input
                  {...control}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  leftElement={currencyAdornment}
                  {...register('taxes')}
                />
              )}
            </FormField>

            <FormField label="Executed at" error={errors.executedAt?.message}>
              {(control) => (
                <Input
                  {...control}
                  type="datetime-local"
                  step={1}
                  {...register('executedAt')}
                />
              )}
            </FormField>

            <FormField isOptional label="Broker" error={errors.broker?.message}>
              {(control) => (
                <Input
                  {...control}
                  type="text"
                  maxLength={BROKER_MAX_LENGTH}
                  {...register('broker')}
                />
              )}
            </FormField>

            <FormField
              isOptional
              label="Notes"
              error={errors.notes?.message}
              className="sm:col-span-2"
            >
              {(control) => (
                <textarea
                  {...control}
                  rows={3}
                  maxLength={NOTES_MAX_LENGTH}
                  className="flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-negative md:text-sm"
                  {...register('notes')}
                />
              )}
            </FormField>

            {errors.root?.server?.message !== undefined && (
              <p role="alert" className="text-sm text-negative sm:col-span-2">
                {errors.root.server.message}
              </p>
            )}
          </div>
        </form>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </Button>

          <SubmitButton form={formId} isPending={isSubmitting}>
            {target.kind === 'create' ? 'Add transaction' : 'Save changes'}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

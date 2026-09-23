import { useId, useState, type FC } from 'react';
import { flushSync } from 'react-dom';
import { useForm, useWatch } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
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

const DECIMAL_COMMA_PATTERN = /^\d+,\d+$/;

/**
 * A comma before exactly three digits, after a nonzero lead, is a thousands
 * separator in en-US and a decimal one in pt-BR, so it is refused, not guessed.
 */
const THOUSANDS_GROUP_PATTERN = /^[1-9]\d{0,2},\d{3}$/;

const MS_PER_MINUTE = 60_000;

const LOCAL_DATE_TIME_LENGTH = 'YYYY-MM-DDTHH:mm:ss'.length;

const SUBMIT_FAILURE_MESSAGE = 'The transaction could not be saved';

const TRANSACTION_TYPE_HINTS: Record<TransactionType, string> = {
  BUY: 'Adds units to the position. Price, fees and taxes go into its average cost.',
  SELL: 'Removes units from the position and realizes the profit against its average cost.',
  DIVIDEND:
    'Income on the units held: enter them and the gross amount per unit. The position does not change.',
  JCP: 'Interest on equity for the units held: enter them, the gross amount per unit and the tax withheld. The position does not change.',
  INTEREST:
    'Interest on the units held: enter them and the gross amount per unit. The position does not change.',
  BONUS:
    'Bonus units received, at the cost per unit the company attributed, which can be zero.'
};

const toDotDecimal = (value: string) =>
  DECIMAL_COMMA_PATTERN.test(value) && !THOUSANDS_GROUP_PATTERN.test(value)
    ? value.replace(',', '.')
    : value;

const decimalFormatIssueOf = (field: string, value: string) => {
  if (DECIMAL_PATTERN.test(value)) return null;

  return THOUSANDS_GROUP_PATTERN.test(value)
    ? `${field} is ambiguous: write ${value.replace(',', '.')} for decimals or ${value.replace(',', '')} for a whole number`
    : `${field} must be a number with at most ${INTEGER_DIGITS} integer digits and ${DECIMAL_COLUMN.SCALE} decimal places, after a dot or a comma`;
};

const positiveDecimalField = (field: string) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required`)
    .transform(toDotDecimal)
    .superRefine((value, ctx) => {
      const message =
        decimalFormatIssueOf(field, value) ??
        (NONZERO_DIGIT.test(value)
          ? null
          : `${field} must be greater than zero`);

      if (message !== null) ctx.addIssue({ code: 'custom', message });
    });

const chargeField = (field: string) =>
  z
    .string()
    .trim()
    .transform((value) => (value === '' ? '0' : toDotDecimal(value)))
    .superRefine((value, ctx) => {
      const message = decimalFormatIssueOf(field, value);

      if (message !== null) ctx.addIssue({ code: 'custom', message });
    });

const optionalTextField = (field: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `${field} must have at most ${maxLength} characters`)
    .transform((value) => (value === '' ? null : value));

const unitPriceIssueOf = (type: TransactionType, unitPrice: string) => {
  const label = TRANSACTION_UNIT_PRICE_LABELS[type];

  if (unitPrice === '') return `${label} is required`;
  if (!DECIMAL_PATTERN.test(unitPrice))
    return decimalFormatIssueOf(label, unitPrice);
  if (type !== 'BONUS' && !NONZERO_DIGIT.test(unitPrice))
    return `${label} must be greater than zero`;

  return null;
};

const TransactionFormSchema = z
  .object({
    type: z.enum(TRANSACTION_TYPES),
    quantity: positiveDecimalField('Quantity'),
    unitPrice: z.string().trim().transform(toDotDecimal),
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

  const defaultValues =
    target.kind === 'create'
      ? {
          ...EMPTY_TRANSACTION_FORM,
          executedAt: toLocalDateTime(new Date().toISOString())
        }
      : toTransactionFormValues(target.transaction);

  const [isDetailOpen, setIsDetailOpen] = useState(
    target.kind === 'edit' &&
      (target.transaction.broker !== null || target.transaction.notes !== null)
  );

  const { symbol, currency } =
    target.kind === 'create' ? target : target.transaction;

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
    setFocus,
    formState: { errors, dirtyFields, isSubmitting }
  } = useForm<TransactionFormInput, unknown, TransactionDraft>({
    mode: 'onTouched',
    resolver: zodResolver(TransactionFormSchema),
    defaultValues
  });

  const selectedType = useWatch({ control: formControl, name: 'type' });

  const openDetail = () => {
    flushSync(() => setIsDetailOpen(true));
    setFocus('broker');
  };

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
              hint={TRANSACTION_TYPE_HINTS[selectedType]}
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

            {isDetailOpen ? (
              <>
                <FormField
                  isOptional
                  label="Broker"
                  error={errors.broker?.message}
                >
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
              </>
            ) : (
              <Button
                type="button"
                variant="link"
                className="h-auto justify-self-start gap-1.5 p-0 sm:col-span-2"
                onClick={openDetail}
              >
                <Plus size={16} aria-hidden="true" />

                <span>Add broker or notes</span>
              </Button>
            )}

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

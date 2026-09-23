import { useId, useState, type FC } from 'react';
import { flushSync } from 'react-dom';
import {
  useController,
  useForm,
  useWatch,
  type Control
} from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { z } from 'zod';

import type { InstrumentType } from '@/app/api/v1/portfolio';
import type { Portfolio } from '@/app/api/v1/portfolios';
import type {
  ListedTransaction,
  TransactionType
} from '@/app/api/v1/transactions';
import {
  CURRENCIES,
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPES,
  TRANSACTION_UNIT_PRICE_LABELS,
  UNIT_PRICE_DECIMALS
} from '@/common/constants';
import { currencyFractionDigits } from '@/common/utils';
import { LoadingState } from '@/components/data-state';
import { DatePicker } from '@/components/date-picker';
import { ChoiceField, FormField } from '@/components/form-field';
import { MoneyInput, type RejectedAmount } from '@/components/money-input';
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
import { usePosition } from '@/hooks/use-portfolio';
import {
  calendarDayOf,
  currentInstant,
  instantOf,
  timeOfDayOf
} from '@/lib/dates';
import {
  DECIMAL_COLUMN,
  INTEGER_DIGITS,
  isNonzeroDecimal,
  isStorableDecimal,
  readDecimal
} from '@/lib/decimal';
import { presentSubmitError } from '@/lib/submit-error';
import type { Maybe } from '@/types';

export type TransactionFormTarget =
  | { kind: 'create'; symbol: string; currency: string }
  | { kind: 'edit'; transaction: ListedTransaction };

export type TransactionDraft = z.output<typeof TransactionFormSchema>;

type TransactionFormDialogProps = {
  portfolio: Portfolio;
  target: TransactionFormTarget;
  onCancel: VoidFunction;
  onSubmit: (draft: TransactionDraft) => Promise<unknown>;
};

type TransactionFormProps = Pick<
  TransactionFormDialogProps,
  'target' | 'onCancel' | 'onSubmit'
> &
  Record<'formId' | 'currency', string> &
  Record<'instrumentType', Maybe<InstrumentType>>;

type TransactionFormInput = z.input<typeof TransactionFormSchema>;

type TransactionFormField = keyof TransactionFormInput;

type AmountField = Extract<
  TransactionFormField,
  'unitPrice' | 'fees' | 'taxes'
>;

type AmountFieldProps = Record<'name', AmountField> &
  Record<'label' | 'currency', string> &
  Record<'decimals', number> &
  Partial<Record<'isOptional', boolean>> &
  Record<'control', Control<TransactionFormInput, unknown, TransactionDraft>>;

/** The API bounds broker and notes to these lengths. */
const BROKER_MAX_LENGTH = 60;
const NOTES_MAX_LENGTH = 500;

const DECIMAL_LIMITS = `at most ${INTEGER_DIGITS} integer digits and ${DECIMAL_COLUMN.SCALE} decimal places`;

const EXECUTION_TIME_ISSUE =
  'Execution time must be one your time zone shows on that day';

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

const typedDecimalIssueOf = (field: string, reading: RejectedAmount) =>
  reading.outcome === 'ambiguous'
    ? `${field} is ambiguous: write ${reading.asDecimal} for decimals or ${reading.asWhole} for a whole number`
    : `${field} must be a number with ${DECIMAL_LIMITS}`;

const pastedAmountIssueOf = (field: string, reading: RejectedAmount) =>
  reading.outcome === 'ambiguous'
    ? `The pasted ${field.toLowerCase()} may be ${reading.asDecimal} or ${reading.asWhole}: type its digits instead`
    : `The pasted ${field.toLowerCase()} is not a number with ${DECIMAL_LIMITS}`;

const quantityField = z
  .string()
  .trim()
  .min(1, 'Quantity is required')
  .transform((text, ctx) => {
    const reading = readDecimal(text);

    if (reading.outcome !== 'read') {
      ctx.addIssue({
        code: 'custom',
        message: typedDecimalIssueOf('Quantity', reading)
      });

      return z.NEVER;
    }

    if (!isNonzeroDecimal(reading.value)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Quantity must be greater than zero'
      });

      return z.NEVER;
    }

    return reading.value;
  });

const chargeField = (field: string) =>
  z
    .string()
    .transform((value) => (value === '' ? '0' : value))
    .refine(
      isStorableDecimal,
      `${field} must be a number with ${DECIMAL_LIMITS}`
    );

const optionalTextField = (field: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `${field} must have at most ${maxLength} characters`)
    .transform((value) => (value === '' ? null : value));

const unitPriceIssueOf = (type: TransactionType, unitPrice: string) => {
  const label = TRANSACTION_UNIT_PRICE_LABELS[type];

  if (unitPrice === '') return `${label} is required`;
  if (!isStorableDecimal(unitPrice))
    return `${label} must be a number with ${DECIMAL_LIMITS}`;
  if (type !== 'BONUS' && !isNonzeroDecimal(unitPrice))
    return `${label} must be greater than zero`;

  return null;
};

/** A class quoted finer than the currency's minor unit is typed with its own decimal places. */
const unitPriceDecimalsOf = (
  instrumentType: Maybe<InstrumentType>,
  currency: string
) =>
  Math.max(
    currencyFractionDigits(currency),
    (instrumentType && UNIT_PRICE_DECIMALS[instrumentType]) ?? 0
  );

const TransactionFormFields = z.object({
  type: z.enum(TRANSACTION_TYPES),
  quantity: quantityField,
  unitPrice: z.string(),
  fees: chargeField('Fees'),
  taxes: chargeField('Taxes'),
  executionDay: z.string().min(1, 'Execution date is required'),
  executionTime: z.string().min(1, 'Execution time is required'),
  broker: optionalTextField('Broker', BROKER_MAX_LENGTH),
  notes: optionalTextField('Notes', NOTES_MAX_LENGTH)
});

/** The day and the time are the browser's; the API receives the instant they name. */
const TransactionFormSchema = TransactionFormFields.superRefine(
  ({ type, unitPrice, executionDay, executionTime }, ctx) => {
    const message = unitPriceIssueOf(type, unitPrice);

    if (message !== null)
      ctx.addIssue({ code: 'custom', path: ['unitPrice'], message });

    if (
      executionDay !== '' &&
      executionTime !== '' &&
      instantOf(executionDay, executionTime) === null
    )
      ctx.addIssue({
        code: 'custom',
        path: ['executionTime'],
        message: EXECUTION_TIME_ISSUE
      });
  }
).transform(({ executionDay, executionTime, ...entry }, ctx) => {
  const executedAt = instantOf(executionDay, executionTime);

  if (executedAt === null) {
    ctx.addIssue({
      code: 'custom',
      path: ['executionTime'],
      message: EXECUTION_TIME_ISSUE
    });

    return z.NEVER;
  }

  return { ...entry, executedAt };
});

const TRANSACTION_FORM_FIELDS = TransactionFormFields.keyof().options;

const EMPTY_TRANSACTION_FORM: TransactionFormInput = {
  type: 'BUY',
  quantity: '',
  unitPrice: '',
  fees: '',
  taxes: '',
  executionDay: '',
  executionTime: '',
  broker: '',
  notes: ''
};

const isTransactionFormField = (path: string): path is TransactionFormField =>
  TRANSACTION_FORM_FIELDS.some((field) => field === path);

/** An error the API reports on the instant belongs to the day that names it. */
const formFieldOf = (path: string) => {
  if (path === 'executedAt') return 'executionDay';

  return isTransactionFormField(path) ? path : undefined;
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
  executionDay: calendarDayOf(executedAt),
  executionTime: timeOfDayOf(executedAt),
  broker: broker ?? '',
  notes: notes ?? ''
});

const AmountField: FC<AmountFieldProps> = ({
  name,
  label,
  currency,
  decimals,
  isOptional = false,
  control: formControl
}) => {
  const {
    field: { ref, value, onChange, onBlur },
    fieldState: { error }
  } = useController({ name, control: formControl });

  const { setError } = formControl;

  const currencySymbol =
    Object.values(CURRENCIES).find(({ id }) => id === currency)?.symbol ??
    currency;

  return (
    <FormField
      isOptional={isOptional}
      label={`${label} (${currency})`}
      error={error?.message}
    >
      {(control) => (
        <MoneyInput
          {...control}
          ref={ref}
          name={name}
          value={value}
          decimals={decimals}
          leftElement={
            <span aria-hidden className="text-sm text-muted-foreground">
              {currencySymbol}
            </span>
          }
          onValueChange={onChange}
          onBlur={onBlur}
          onRejectedPaste={(reading) =>
            setError(name, { message: pastedAmountIssueOf(label, reading) })
          }
        />
      )}
    </FormField>
  );
};

const TransactionForm: FC<TransactionFormProps> = ({
  formId,
  target,
  currency,
  instrumentType,
  onCancel,
  onSubmit
}) => {
  const openedAt = currentInstant();

  const defaultValues =
    target.kind === 'create'
      ? {
          ...EMPTY_TRANSACTION_FORM,
          executionDay: calendarDayOf(openedAt),
          executionTime: timeOfDayOf(openedAt)
        }
      : toTransactionFormValues(target.transaction);

  const [isDetailOpen, setIsDetailOpen] = useState(
    target.kind === 'edit' &&
      (target.transaction.broker !== null || target.transaction.notes !== null)
  );

  const {
    control: formControl,
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, dirtyFields, isSubmitting }
  } = useForm<TransactionFormInput, unknown, TransactionDraft>({
    mode: 'onChange',
    resolver: zodResolver(TransactionFormSchema),
    defaultValues
  });

  const selectedType = useWatch({ control: formControl, name: 'type' });

  const { field: executionDayField } = useController({
    name: 'executionDay',
    control: formControl
  });

  const amountDecimals = currencyFractionDigits(currency);

  const openDetail = () => {
    flushSync(() => setIsDetailOpen(true));
    setFocus('broker');
  };

  const submitDraft = async (draft: TransactionDraft) => {
    const isOriginalExecutionTime =
      target.kind === 'edit' &&
      dirtyFields.executionDay !== true &&
      dirtyFields.executionTime !== true;

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
        fieldOf: formFieldOf,
        fallbackMessage: SUBMIT_FAILURE_MESSAGE
      });
    }
  };

  return (
    <>
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

          <AmountField
            name="unitPrice"
            label={TRANSACTION_UNIT_PRICE_LABELS[selectedType]}
            currency={currency}
            decimals={unitPriceDecimalsOf(instrumentType, currency)}
            control={formControl}
          />

          <AmountField
            isOptional
            name="fees"
            label="Fees"
            currency={currency}
            decimals={amountDecimals}
            control={formControl}
          />

          <AmountField
            isOptional
            name="taxes"
            label="Taxes"
            currency={currency}
            decimals={amountDecimals}
            control={formControl}
          />

          <FormField label="Date" error={errors.executionDay?.message}>
            {(control) => (
              <DatePicker
                id={control.id}
                ref={executionDayField.ref}
                name={executionDayField.name}
                value={executionDayField.value}
                aria-invalid={control['aria-invalid']}
                aria-describedby={control['aria-describedby']}
                onValueChange={executionDayField.onChange}
                onBlur={executionDayField.onBlur}
              />
            )}
          </FormField>

          <FormField label="Time" error={errors.executionTime?.message}>
            {(control) => (
              <Input
                {...control}
                type="time"
                step={1}
                {...register('executionTime')}
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
    </>
  );
};

/**
 * The form waits for the position, whose class sets the decimal places a unit
 * price is typed with. When the position cannot be read, the form still opens,
 * with the currency's own decimal places.
 */
export const TransactionFormDialog: FC<TransactionFormDialogProps> = ({
  portfolio,
  target,
  onCancel,
  onSubmit
}) => {
  const formId = useId();

  const [isSaving, setIsSaving] = useState(false);

  const { symbol, currency } =
    target.kind === 'create' ? target : target.transaction;

  const positionQuery = usePosition(portfolio, symbol);

  const save = async (draft: TransactionDraft) => {
    setIsSaving(true);

    try {
      await onSubmit(draft);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={() => {
        if (!isSaving) onCancel();
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

        {positionQuery.isPending ? (
          <>
            <LoadingState label={`Loading ${symbol}`} className="h-72" />

            <DialogFooter>
              <Button variant="outline" onClick={onCancel}>
                Cancel
              </Button>
            </DialogFooter>
          </>
        ) : (
          <TransactionForm
            formId={formId}
            target={target}
            currency={currency}
            instrumentType={positionQuery.data?.type}
            onCancel={onCancel}
            onSubmit={save}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

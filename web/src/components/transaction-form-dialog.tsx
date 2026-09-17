import {
  useId,
  type FC,
  type InputHTMLAttributes,
  type ReactNode
} from 'react';
import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

import type { ListedTransaction } from '@/app/api/v1/transactions';
import {
  CURRENCIES,
  TRANSACTION_TYPE_LABELS,
  TRANSACTION_TYPES
} from '@/common/constants';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label
} from '@/components/ui';
import { ApiProxyError } from '@/lib/axios';
import { cn } from '@/lib/utils';

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

type FieldControlProps = Pick<
  InputHTMLAttributes<HTMLElement>,
  'id' | 'aria-invalid' | 'aria-describedby'
>;

type FormFieldProps = {
  label: string;
  error?: string;
  className?: string;
  children: (control: FieldControlProps) => ReactNode;
};

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

const TransactionFormSchema = z.object({
  type: z.enum(TRANSACTION_TYPES),
  quantity: positiveDecimalField('Quantity'),
  unitPrice: positiveDecimalField('Unit price'),
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

const FormField: FC<FormFieldProps> = ({
  label,
  error,
  className,
  children
}) => {
  const controlId = useId();
  const errorId = useId();
  const hasError = error !== undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={controlId}>{label}</Label>

      {children({
        id: controlId,
        'aria-invalid': hasError,
        'aria-describedby': hasError ? errorId : undefined
      })}

      {hasError && (
        <p id={errorId} className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  );
};

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
    register,
    handleSubmit,
    setError,
    formState: { errors, dirtyFields, isSubmitting }
  } = useForm<TransactionFormInput, unknown, TransactionDraft>({
    mode: 'onTouched',
    resolver: zodResolver(TransactionFormSchema),
    defaultValues
  });

  const presentSubmitError = (error: unknown) => {
    const issues =
      error instanceof ApiProxyError ? (error._error?.details ?? []) : [];
    const unplacedMessages: Array<string> = [];
    let hasFieldIssue = false;

    for (const { path, message } of issues) {
      if (!isTransactionFormField(path)) {
        unplacedMessages.push(message);
        continue;
      }

      setError(
        path,
        { type: 'server', message },
        { shouldFocus: !hasFieldIssue }
      );
      hasFieldIssue = true;
    }

    if (unplacedMessages.length > 0)
      setError('root.server', {
        type: 'server',
        message: unplacedMessages.join(', ')
      });
    else if (!hasFieldIssue)
      setError('root.server', {
        type: 'server',
        message: error instanceof Error ? error.message : SUBMIT_FAILURE_MESSAGE
      });
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
      presentSubmitError(error);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={() => {
        if (!isSubmitting) onCancel();
      }}
    >
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
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
          <fieldset
            disabled={isSubmitting}
            className="grid gap-4 sm:grid-cols-2"
          >
            <fieldset className="sm:col-span-2">
              <legend className="mb-1.5 text-sm font-medium leading-none">
                Type
              </legend>

              <div className="flex w-fit rounded-md border p-0.5">
                {TRANSACTION_TYPES.map((type) => (
                  <label key={type} className="cursor-pointer">
                    <input
                      type="radio"
                      value={type}
                      className="peer sr-only"
                      {...register('type')}
                    />

                    <span className="block rounded-sm px-3 py-1 text-sm font-medium text-muted-foreground ring-offset-background transition-colors hover:text-foreground peer-checked:bg-primary peer-checked:text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2">
                      {TRANSACTION_TYPE_LABELS[type]}
                    </span>
                  </label>
                ))}
              </div>

              {errors.type?.message !== undefined && (
                <p className="mt-1.5 text-sm text-destructive">
                  {errors.type.message}
                </p>
              )}
            </fieldset>

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
              label={`Unit price (${currency})`}
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

            <FormField label="Broker (optional)" error={errors.broker?.message}>
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
              label="Notes (optional)"
              error={errors.notes?.message}
              className="sm:col-span-2"
            >
              {(control) => (
                <textarea
                  {...control}
                  rows={3}
                  maxLength={NOTES_MAX_LENGTH}
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  {...register('notes')}
                />
              )}
            </FormField>

            {errors.root?.server?.message !== undefined && (
              <p
                role="alert"
                className="text-sm text-destructive sm:col-span-2"
              >
                {errors.root.server.message}
              </p>
            )}
          </fieldset>
        </form>

        <DialogFooter className="gap-2 sm:space-x-0">
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </Button>

          <Button
            type="submit"
            form={formId}
            disabled={isSubmitting}
            className="gap-2"
          >
            {isSubmitting && (
              <Loader2 aria-hidden className="size-4 animate-spin" />
            )}

            {target.kind === 'create' ? 'Add transaction' : 'Save changes'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

import { useId, useRef, useState, type FC, type ReactNode } from 'react';
import { flushSync } from 'react-dom';
import {
  useController,
  useForm,
  useWatch,
  type Control
} from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Minus, Plus } from 'lucide-react';
import { z } from 'zod';

import type { InstrumentType, PositionDetail } from '@/app/api/v1/portfolio';
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
import { currencyFractionDigits, formatQuantity } from '@/common/utils';
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
  formatQuoteTime,
  instantOfCalendarDay
} from '@/lib/dates';
import {
  DECIMAL_COLUMN,
  INTEGER_DIGITS,
  isNonzeroDecimal,
  isStorableDecimal,
  readDecimal,
  roundDecimal,
  shiftByWholeUnits
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
  Record<'position', Maybe<PositionDetail>>;

type TransactionFormInput = z.input<typeof TransactionFormSchema>;

type TransactionFormField = keyof TransactionFormInput;

type AmountField = Extract<
  TransactionFormField,
  'unitPrice' | 'fees' | 'taxes'
>;

type TransactionDetail = (typeof TRANSACTION_DETAILS)[number];

type AmountFieldProps = Record<'name', AmountField> &
  Record<'label' | 'currency', string> &
  Record<'decimals', number> &
  Partial<Record<'isOptional', boolean>> &
  Partial<Record<'hint' | 'className', string>> &
  Partial<Record<'action', ReactNode>> &
  Record<'control', Control<TransactionFormInput, unknown, TransactionDraft>>;

/** The API bounds broker and notes to these lengths. */
const BROKER_MAX_LENGTH = 60;
const NOTES_MAX_LENGTH = 500;

const DECIMAL_LIMITS = `at most ${INTEGER_DIGITS} integer digits and ${DECIMAL_COLUMN.SCALE} decimal places`;

const EXECUTION_DAY_ISSUE = 'Execution date must be a day of the calendar';

const SUBMIT_FAILURE_MESSAGE = 'The transaction could not be saved';

const MARKET_PRICE_HINT = 'Market price';

/** One whole unit, keeping the fraction, moves a quantity of any class. */
const QUANTITY_STEP = 1;

/** A new transaction starts at one unit, the stepper's own step. */
const INITIAL_QUANTITY = '1';

/** A quantity is never negative, so its sign is never typed. */
const NEGATIVE_SIGNS = /[-\u2212]/g;

/**
 * Side by side, the unit price and the quantity start their inputs at the same
 * height: a label row may hold an `xxs` action, so both rows take its height.
 */
const PAIRED_FIELD_CLASS =
  '[&>:first-child]:flex [&>:first-child]:min-h-6 [&>:first-child]:items-center';

/** Fields a transaction often goes without, added to the form one by one. */
const TRANSACTION_DETAILS = [
  'fees',
  'taxes',
  'broker',
  'notes'
] as const satisfies ReadonlyArray<TransactionFormField>;

const TRANSACTION_DETAIL_LABELS: Record<TransactionDetail, string> = {
  fees: 'Fees',
  taxes: 'Taxes',
  broker: 'Broker',
  notes: 'Notes'
};

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

const CREATE_SUBMIT_LABELS: Record<TransactionType, string> = {
  BUY: 'Add buy',
  SELL: 'Add sell',
  DIVIDEND: 'Add dividend',
  JCP: 'Add JCP',
  INTEREST: 'Add interest',
  BONUS: 'Add bonus'
};

/** A trade happens at the market, so its price is the one to start from. */
const isTradedAtMarket = (type: TransactionType) =>
  type === 'BUY' || type === 'SELL';

/** A sale and every income count the units already held; a buy and a bonus add new ones. */
const isQuantityOfHeldUnits = (type: TransactionType) =>
  type !== 'BUY' && type !== 'BONUS';

/** Interest on equity is paid net of a tax withheld at source. */
const hasWithheldTax = (type: TransactionType) => type === 'JCP';

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

/**
 * The position's market price, in the portfolio's base currency, at the places
 * a unit price is typed with, or exact when those places would round it to zero.
 */
const marketUnitPriceOf = (
  position: Maybe<PositionDetail>,
  currency: string,
  decimals: number
) => {
  const marketPrice =
    position?.baseCurrency === currency ? position.marketPrice : undefined;

  if (marketPrice === undefined || !isNonzeroDecimal(marketPrice)) return null;

  const rounded = roundDecimal(marketPrice, decimals);

  return isNonzeroDecimal(rounded) ? rounded : marketPrice;
};

const marketPriceHintOf = (quote: PositionDetail['quote']) =>
  quote === undefined
    ? MARKET_PRICE_HINT
    : `${MARKET_PRICE_HINT} as of ${formatQuoteTime(quote.timestamp)}`;

/** The quantity the stepper moves from, or null while the text is not a number. */
const steppableQuantityOf = (quantity: string) => {
  if (quantity.trim() === '') return '0';

  const reading = readDecimal(quantity);

  return reading.outcome === 'read' ? reading.value : null;
};

const TransactionFormFields = z.object({
  type: z.enum(TRANSACTION_TYPES),
  quantity: quantityField,
  unitPrice: z.string(),
  fees: chargeField('Fees'),
  taxes: chargeField('Taxes'),
  executionDay: z.string().min(1, 'Execution date is required'),
  broker: optionalTextField('Broker', BROKER_MAX_LENGTH),
  notes: optionalTextField('Notes', NOTES_MAX_LENGTH)
});

/** The day is the browser's; the API receives the instant `instantOfCalendarDay` anchors it to. */
const TransactionFormSchema = TransactionFormFields.superRefine(
  ({ type, unitPrice }, ctx) => {
    const message = unitPriceIssueOf(type, unitPrice);

    if (message !== null)
      ctx.addIssue({ code: 'custom', path: ['unitPrice'], message });
  }
).transform(({ executionDay, ...entry }, ctx) => {
  const executedAt = instantOfCalendarDay(executionDay);

  if (executedAt === null) {
    ctx.addIssue({
      code: 'custom',
      path: ['executionDay'],
      message: EXECUTION_DAY_ISSUE
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
  broker: '',
  notes: ''
};

const isTransactionFormField = (path: string): path is TransactionFormField =>
  TRANSACTION_FORM_FIELDS.some((field) => field === path);

/** An error the API reports on the instant belongs to the day it records. */
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
  fees: isNonzeroDecimal(fees) ? fees : '',
  taxes: isNonzeroDecimal(taxes) ? taxes : '',
  executionDay: calendarDayOf(executedAt),
  broker: broker ?? '',
  notes: notes ?? ''
});

const shownDetailsOf = (
  target: TransactionFormTarget
): ReadonlySet<TransactionDetail> => {
  if (target.kind === 'create') return new Set();

  const { type, fees, taxes, broker, notes } = target.transaction;

  const hasDetail: Record<TransactionDetail, boolean> = {
    fees: isNonzeroDecimal(fees),
    taxes: isNonzeroDecimal(taxes) || hasWithheldTax(type),
    broker: broker !== null,
    notes: notes !== null
  };

  return new Set(TRANSACTION_DETAILS.filter((detail) => hasDetail[detail]));
};

const AmountField: FC<AmountFieldProps> = ({
  name,
  label,
  currency,
  decimals,
  isOptional = false,
  hint,
  className,
  action,
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
      hint={hint}
      error={error?.message}
      action={action}
      className={className}
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
  position,
  onCancel,
  onSubmit
}) => {
  const openedAt = currentInstant();

  const unitPriceDecimals = unitPriceDecimalsOf(position?.type, currency);

  const marketUnitPrice =
    target.kind === 'create'
      ? marketUnitPriceOf(position, currency, unitPriceDecimals)
      : null;

  const defaultValues =
    target.kind === 'create'
      ? {
          ...EMPTY_TRANSACTION_FORM,
          quantity: INITIAL_QUANTITY,
          unitPrice: marketUnitPrice ?? '',
          executionDay: calendarDayOf(openedAt)
        }
      : toTransactionFormValues(target.transaction);

  const [shownDetails, setShownDetails] = useState(() =>
    shownDetailsOf(target)
  );

  const addDetailButtons = useRef<
    Partial<Record<TransactionDetail, HTMLButtonElement | null>>
  >({});

  const {
    control: formControl,
    register,
    handleSubmit,
    getValues,
    setValue,
    setError,
    setFocus,
    formState: { errors, dirtyFields, isSubmitting }
  } = useForm<TransactionFormInput, unknown, TransactionDraft>({
    mode: 'onChange',
    resolver: zodResolver(TransactionFormSchema),
    defaultValues
  });

  const selectedType = useWatch({ control: formControl, name: 'type' });
  const unitPrice = useWatch({ control: formControl, name: 'unitPrice' });
  const quantity = useWatch({ control: formControl, name: 'quantity' });

  const { field: executionDayField } = useController({
    name: 'executionDay',
    control: formControl
  });

  const { field: quantityInput } = useController({
    name: 'quantity',
    control: formControl
  });

  const amountDecimals = currencyFractionDigits(currency);

  const heldQuantity =
    target.kind === 'create' &&
    position !== undefined &&
    position !== null &&
    isNonzeroDecimal(position.quantity)
      ? position.quantity
      : null;

  const unitPriceHint =
    marketUnitPrice !== null &&
    unitPrice === marketUnitPrice &&
    isTradedAtMarket(selectedType)
      ? marketPriceHintOf(position?.quote)
      : undefined;

  const baseQuantity = steppableQuantityOf(quantity);

  const shiftedQuantityOf = (count: number) =>
    baseQuantity === null ? null : shiftByWholeUnits(baseQuantity, count);

  const decreasedQuantity = shiftedQuantityOf(-QUANTITY_STEP);
  const increasedQuantity = shiftedQuantityOf(QUANTITY_STEP);

  /**
   * A unit price still at the market price follows the type: a trade keeps it,
   * and income or a bonus, priced per unit by the payer, starts empty.
   */
  const followSelectedType = () => {
    const type = getValues('type');
    const currentUnitPrice = getValues('unitPrice');

    if (hasWithheldTax(type))
      setShownDetails((shown) =>
        shown.has('taxes') ? shown : new Set(shown).add('taxes')
      );

    if (
      marketUnitPrice === null ||
      (currentUnitPrice !== '' && currentUnitPrice !== marketUnitPrice)
    )
      return;

    const nextUnitPrice = isTradedAtMarket(type) ? marketUnitPrice : '';

    if (nextUnitPrice !== currentUnitPrice)
      setValue('unitPrice', nextUnitPrice, {
        shouldValidate: nextUnitPrice !== ''
      });
  };

  const stepQuantityTo = (nextQuantity: string | null) => {
    if (nextQuantity === null) return;

    setValue('quantity', nextQuantity, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: true
    });
  };

  const showDetail = (detail: TransactionDetail) => {
    flushSync(() => setShownDetails((shown) => new Set(shown).add(detail)));
    setFocus(detail);
  };

  const removeDetail = (detail: TransactionDetail) => {
    setValue(detail, '', { shouldDirty: true, shouldValidate: true });
    flushSync(() =>
      setShownDetails(
        (shown) =>
          new Set([...shown].filter((shownDetail) => shownDetail !== detail))
      )
    );
    addDetailButtons.current[detail]?.focus();
  };

  const removeDetailButton = (detail: TransactionDetail) => (
    <Button
      type="button"
      variant="ghost"
      size="xxs"
      className="text-muted-foreground"
      onClick={() => removeDetail(detail)}
    >
      Remove
      <span className="sr-only">
        {` ${TRANSACTION_DETAIL_LABELS[detail].toLowerCase()}`}
      </span>
    </Button>
  );

  const hiddenDetails = TRANSACTION_DETAILS.filter(
    (detail) => !shownDetails.has(detail)
  );

  const submitDraft = async (draft: TransactionDraft) => {
    const isOriginalExecutionDay =
      target.kind === 'edit' && dirtyFields.executionDay !== true;

    try {
      await onSubmit({
        ...draft,
        executedAt: isOriginalExecutionDay
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
                  {...register('type', { onChange: followSelectedType })}
                >
                  {TRANSACTION_TYPE_LABELS[type]}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </ChoiceField>

          <AmountField
            name="unitPrice"
            label={TRANSACTION_UNIT_PRICE_LABELS[selectedType]}
            currency={currency}
            decimals={unitPriceDecimals}
            hint={unitPriceHint}
            className={PAIRED_FIELD_CLASS}
            control={formControl}
          />

          <FormField
            label="Quantity"
            error={errors.quantity?.message}
            className={PAIRED_FIELD_CLASS}
            action={
              heldQuantity !== null && isQuantityOfHeldUnits(selectedType) ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xxs"
                  className="text-muted-foreground"
                  onClick={() => {
                    stepQuantityTo(heldQuantity);
                    setFocus('quantity');
                  }}
                >
                  {`Use ${formatQuantity(heldQuantity)} held`}
                </Button>
              ) : undefined
            }
          >
            {(control) => (
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <Input
                    {...control}
                    ref={quantityInput.ref}
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    className="tabular-nums"
                    name={quantityInput.name}
                    value={quantityInput.value}
                    onChange={(event) =>
                      quantityInput.onChange(
                        event.target.value.replace(NEGATIVE_SIGNS, '')
                      )
                    }
                    onBlur={quantityInput.onBlur}
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Decrease quantity by ${QUANTITY_STEP}`}
                  aria-controls={control.id}
                  aria-disabled={decreasedQuantity === null}
                  className="shrink-0"
                  onClick={() => stepQuantityTo(decreasedQuantity)}
                >
                  <Minus size={16} aria-hidden="true" />
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={`Increase quantity by ${QUANTITY_STEP}`}
                  aria-controls={control.id}
                  aria-disabled={increasedQuantity === null}
                  className="shrink-0"
                  onClick={() => stepQuantityTo(increasedQuantity)}
                >
                  <Plus size={16} aria-hidden="true" />
                </Button>
              </div>
            )}
          </FormField>

          <FormField
            label="Date"
            error={errors.executionDay?.message}
            className="sm:col-span-2"
          >
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

          {shownDetails.has('fees') && (
            <AmountField
              isOptional
              name="fees"
              label="Fees"
              currency={currency}
              decimals={amountDecimals}
              action={removeDetailButton('fees')}
              control={formControl}
            />
          )}

          {shownDetails.has('taxes') && (
            <AmountField
              isOptional
              name="taxes"
              label="Taxes"
              currency={currency}
              decimals={amountDecimals}
              action={removeDetailButton('taxes')}
              control={formControl}
            />
          )}

          {shownDetails.has('broker') && (
            <FormField
              isOptional
              label="Broker"
              error={errors.broker?.message}
              action={removeDetailButton('broker')}
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
          )}

          {shownDetails.has('notes') && (
            <FormField
              isOptional
              label="Notes"
              error={errors.notes?.message}
              action={removeDetailButton('notes')}
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
          )}

          {hiddenDetails.length > 0 && (
            <div
              role="group"
              aria-label="Optional details"
              className="flex flex-wrap gap-2 sm:col-span-2"
            >
              {hiddenDetails.map((detail) => (
                <Button
                  key={detail}
                  ref={(button) => {
                    addDetailButtons.current[detail] = button;
                  }}
                  type="button"
                  variant="outline"
                  size="xs"
                  className="gap-1.5"
                  onClick={() => showDetail(detail)}
                >
                  <Plus size={14} aria-hidden="true" />

                  <span>
                    <span className="sr-only">Add </span>

                    {TRANSACTION_DETAIL_LABELS[detail]}
                  </span>
                </Button>
              ))}
            </div>
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
          {target.kind === 'create'
            ? CREATE_SUBMIT_LABELS[selectedType]
            : 'Save changes'}
        </SubmitButton>
      </DialogFooter>
    </>
  );
};

/**
 * The form waits for the position, whose class sets the decimal places a unit
 * price is typed with and whose market price starts a new trade's unit price.
 * When the position cannot be read, the form still opens, with the currency's
 * own decimal places and no unit price.
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {target.kind === 'create'
              ? `Add ${symbol} transaction`
              : `Edit ${symbol} transaction`}
          </DialogTitle>

          <DialogDescription>
            {`Amounts in ${currency}. Fees and taxes left out are recorded as zero.`}
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
            position={positionQuery.data}
            onCancel={onCancel}
            onSubmit={save}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

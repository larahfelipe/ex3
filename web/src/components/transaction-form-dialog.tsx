import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type FC,
  type ReactNode
} from 'react';
import { flushSync } from 'react-dom';
import {
  useController,
  useForm,
  useWatch,
  type Control
} from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { Minus, Plus } from 'lucide-react';
import { useTranslations } from 'use-intl';
import { z } from 'zod';

import type { InstrumentType, PositionDetail } from '@/app/api/v1/portfolio';
import type { Portfolio } from '@/app/api/v1/portfolios';
import type {
  ListedTransaction,
  TransactionType
} from '@/app/api/v1/transactions';
import { TRANSACTION_TYPES, UNIT_PRICE_DECIMALS } from '@/common/constants';
import { currencyFractionDigits } from '@/common/utils';
import { LoadingState } from '@/components/data-state';
import { DatePicker } from '@/components/date-picker';
import { ChoiceField, FormField } from '@/components/form-field';
import { CurrencyAmountInput } from '@/components/money-input';
import { NumberInput } from '@/components/number-input';
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
import { useRevalidateOnLocaleChange } from '@/hooks/use-revalidate-on-locale-change';
import { useFormat, type Format } from '@/i18n/format';
import { srOnly } from '@/i18n/rich-text';
import type { Translator } from '@/i18n/translator';
import {
  decimalLimitsIssueOf,
  pastedAmountIssueOf,
  typedAmountIssueOf
} from '@/lib/amount-issues';
import {
  calendarDayOf,
  currentInstant,
  instantOfCalendarDay
} from '@/lib/dates';
import {
  isNonzeroDecimal,
  isStorableDecimal,
  roundDecimal,
  shiftByWholeUnits
} from '@/lib/decimal';
import { presentSubmitError } from '@/lib/submit-error';
import { isCostOf, transactionEffectOf } from '@/lib/transaction-effect';
import type { Maybe } from '@/types';

export type TransactionFormTarget =
  | { kind: 'create'; symbol: string; currency: string }
  | { kind: 'edit'; transaction: ListedTransaction };

export type TransactionDraft = z.output<
  ReturnType<typeof transactionFormSchemaFor>
>;

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
  Record<'position', Maybe<PositionDetail>> &
  Record<'onDirtyChange', (isDirty: boolean) => void>;

type TransactionFormInput = z.input<
  ReturnType<typeof transactionFormSchemaFor>
>;

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

/** One whole unit, keeping the fraction, moves a quantity of any class. */
const QUANTITY_STEP = 1;

/** A new transaction starts at one unit, the stepper's own step. */
const INITIAL_QUANTITY = '1';

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

/** A trade happens at the market, so its price is the one to start from. */
const isTradedAtMarket = (type: TransactionType) =>
  type === 'BUY' || type === 'SELL';

/** A sale and every income count the units already held; a buy and a bonus add new ones. */
const isQuantityOfHeldUnits = (type: TransactionType) =>
  type !== 'BUY' && type !== 'BONUS';

/** Interest on equity is paid net of a tax withheld at source. */
const hasWithheldTax = (type: TransactionType) => type === 'JCP';

const quantityFieldFor = (t: Translator<'validation'>, format: Format) =>
  z
    .string()
    .trim()
    .min(1, t('quantity.required'))
    .transform((text, ctx) => {
      const reading = format.readDecimal(text);

      if (reading.outcome !== 'read') {
        ctx.addIssue({
          code: 'custom',
          message: typedAmountIssueOf(reading, t, format)
        });

        return z.NEVER;
      }

      if (!isNonzeroDecimal(reading.value)) {
        ctx.addIssue({
          code: 'custom',
          message: t('quantity.notPositive')
        });

        return z.NEVER;
      }

      return reading.value;
    });

const chargeFieldFor = (t: Translator<'validation'>) =>
  z
    .string()
    .transform((value) => (value === '' ? '0' : value))
    .refine(isStorableDecimal, decimalLimitsIssueOf(t));

const optionalTextFieldFor = (t: Translator<'validation'>, max: number) =>
  z
    .string()
    .trim()
    .max(max, t('text.tooLong', { max }))
    .transform((value) => (value === '' ? null : value));

const unitPriceIssueOf = (
  type: TransactionType,
  unitPrice: string,
  t: Translator<'validation'>
) => {
  if (unitPrice === '') return t('amount.required');
  if (!isStorableDecimal(unitPrice)) return decimalLimitsIssueOf(t);
  if (type !== 'BONUS' && !isNonzeroDecimal(unitPrice))
    return t('amount.notPositive');

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

const marketPriceHintOf = (
  quote: PositionDetail['quote'],
  t: Translator<'transactions.form'>,
  { formatQuoteTime }: Format
) =>
  quote === undefined
    ? t('marketPrice')
    : t('marketPriceAsOf', { time: formatQuoteTime(quote.timestamp) });

/** The quantity the stepper moves from, or null while the text is not a number. */
const steppableQuantityOf = (quantity: string, { readDecimal }: Format) => {
  if (quantity.trim() === '') return '0';

  const reading = readDecimal(quantity);

  return reading.outcome === 'read' ? reading.value : null;
};

/** The day is the browser's; the API receives the instant `instantOfCalendarDay` anchors it to. */
const transactionFormSchemaFor = (
  t: Translator<'validation'>,
  format: Format
) =>
  z
    .object({
      type: z.enum(TRANSACTION_TYPES),
      quantity: quantityFieldFor(t, format),
      unitPrice: z.string(),
      fees: chargeFieldFor(t),
      taxes: chargeFieldFor(t),
      executionDay: z.string().min(1, t('day.required')),
      broker: optionalTextFieldFor(t, BROKER_MAX_LENGTH),
      notes: optionalTextFieldFor(t, NOTES_MAX_LENGTH)
    })
    .superRefine(({ type, unitPrice }, ctx) => {
      const message = unitPriceIssueOf(type, unitPrice, t);

      if (message !== null)
        ctx.addIssue({ code: 'custom', path: ['unitPrice'], message });
    })
    .transform(({ executionDay, ...entry }, ctx) => {
      const executedAt = instantOfCalendarDay(executionDay);

      if (executedAt === null) {
        ctx.addIssue({
          code: 'custom',
          path: ['executionDay'],
          message: t('day.invalid')
        });

        return z.NEVER;
      }

      return { ...entry, executedAt };
    });

const TRANSACTION_FORM_FIELDS = [
  'type',
  'quantity',
  'unitPrice',
  'fees',
  'taxes',
  'executionDay',
  'broker',
  'notes'
] as const satisfies ReadonlyArray<TransactionFormField>;

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

const toTransactionFormValues = (
  {
    type,
    quantity,
    unitPrice,
    fees,
    taxes,
    executedAt,
    broker,
    notes
  }: ListedTransaction,
  { decimalInputTextOf }: Format
): TransactionFormInput => ({
  type,
  quantity: decimalInputTextOf(quantity),
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
  const tForm = useTranslations('common.form');
  const tValidation = useTranslations('validation');
  const format = useFormat();
  const {
    field: { ref, value, onChange, onBlur },
    fieldState: { error }
  } = useController({ name, control: formControl });

  const { setError } = formControl;

  return (
    <FormField
      isOptional={isOptional}
      label={tForm.rich('labelInCurrency', {
        label,
        currency,
        hidden: srOnly
      })}
      hint={hint}
      error={error?.message}
      action={action}
      className={className}
    >
      {(control) => (
        <CurrencyAmountInput
          {...control}
          ref={ref}
          name={name}
          value={value}
          currency={currency}
          decimals={decimals}
          onValueChange={onChange}
          onBlur={onBlur}
          onRejectedPaste={(reading) =>
            setError(name, {
              message: pastedAmountIssueOf(reading, tValidation, format)
            })
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
  onSubmit,
  onDirtyChange
}) => {
  const t = useTranslations('transactions');
  const tForm = useTranslations('transactions.form');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const tActions = useTranslations('common.actions');
  const format = useFormat();
  const { decimalInputTextOf, formatMoney, formatPrice, formatQuantity } =
    format;
  const transactionFormSchema = useMemo(
    () => transactionFormSchemaFor(tValidation, format),
    [tValidation, format]
  );
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
      : toTransactionFormValues(target.transaction, format);

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
    trigger,
    formState: { errors, dirtyFields, isDirty, isSubmitting }
  } = useForm<TransactionFormInput, unknown, TransactionDraft>({
    mode: 'onChange',
    resolver: zodResolver(transactionFormSchema),
    defaultValues
  });

  useRevalidateOnLocaleChange(errors, trigger);

  useEffect(() => {
    onDirtyChange(isDirty);
  }, [isDirty, onDirtyChange]);

  const selectedType = useWatch({ control: formControl, name: 'type' });
  const unitPrice = useWatch({ control: formControl, name: 'unitPrice' });
  const quantity = useWatch({ control: formControl, name: 'quantity' });
  const fees = useWatch({ control: formControl, name: 'fees' });
  const taxes = useWatch({ control: formControl, name: 'taxes' });

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
      ? marketPriceHintOf(position?.quote, tForm, format)
      : undefined;

  const baseQuantity = steppableQuantityOf(quantity, format);

  const shiftedQuantityOf = (count: number) =>
    baseQuantity === null ? null : shiftByWholeUnits(baseQuantity, count);

  const decreasedQuantity = shiftedQuantityOf(-QUANTITY_STEP);
  const increasedQuantity = shiftedQuantityOf(QUANTITY_STEP);

  const quantityReading = format.readDecimal(quantity);
  const effect = transactionEffectOf(selectedType, {
    quantity: quantityReading.outcome === 'read' ? quantityReading.value : '',
    unitPrice,
    fees,
    taxes
  });

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

    setValue('quantity', decimalInputTextOf(nextQuantity), {
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
      {tForm.rich(`removeDetail.${detail}`, {
        hidden: (chunks) => <span className="sr-only">{chunks}</span>
      })}
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
        t: tErrors,
        fallbackMessage: tForm('failed')
      });
    }
  };

  return (
    <>
      <form id={formId} noValidate onSubmit={handleSubmit(submitDraft)}>
        <div className="grid gap-4 sm:grid-cols-2">
          <ChoiceField
            legend={t('fields.type')}
            hint={tForm(`typeHints.${selectedType}`)}
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
                  {t(`types.${type}`)}
                </SegmentedControlItem>
              ))}
            </SegmentedControl>
          </ChoiceField>

          <FormField
            label={t('fields.date')}
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

          <FormField
            label={t('fields.quantity')}
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
                  {tForm('useHeld', {
                    quantity: formatQuantity(heldQuantity)
                  })}
                </Button>
              ) : undefined
            }
          >
            {(control) => (
              <div className="flex gap-2">
                <div className="min-w-0 flex-1">
                  <NumberInput
                    {...control}
                    allowsDecimals
                    ref={quantityInput.ref}
                    className="tabular-nums"
                    name={quantityInput.name}
                    value={quantityInput.value}
                    onChange={({ target }) =>
                      quantityInput.onChange(target.value)
                    }
                    onBlur={quantityInput.onBlur}
                  />
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label={tForm('decrease', { step: QUANTITY_STEP })}
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
                  aria-label={tForm('increase', { step: QUANTITY_STEP })}
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

          <AmountField
            name="unitPrice"
            label={t(`unitPrice.${selectedType}`)}
            currency={currency}
            decimals={unitPriceDecimals}
            hint={unitPriceHint}
            className={PAIRED_FIELD_CLASS}
            control={formControl}
          />

          {shownDetails.has('fees') && (
            <AmountField
              isOptional
              name="fees"
              label={t('fields.fees')}
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
              label={t('fields.taxes')}
              currency={currency}
              decimals={amountDecimals}
              action={removeDetailButton('taxes')}
              control={formControl}
            />
          )}

          {shownDetails.has('broker') && (
            <FormField
              isOptional
              label={t('fields.broker')}
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
              label={t('fields.notes')}
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

          {effect !== null && (
            <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg bg-muted/50 px-3 py-2.5 text-sm sm:col-span-2">
              <span className="text-muted-foreground">
                {tForm(`effect.${selectedType}`)}
              </span>

              <span className="font-semibold tabular-nums">
                {formatMoney(effect.net, currency)}
              </span>

              <span className="w-full text-xs text-muted-foreground tabular-nums">
                {tForm(
                  !isNonzeroDecimal(effect.charges)
                    ? 'effectOf.units'
                    : isCostOf(selectedType)
                      ? 'effectOf.unitsPlusCharges'
                      : 'effectOf.unitsLessCharges',
                  {
                    quantity: formatQuantity(effect.quantity),
                    unitPrice: formatPrice(effect.unitPrice, currency),
                    charges: formatMoney(effect.charges, currency)
                  }
                )}
              </span>
            </div>
          )}

          {hiddenDetails.length > 0 && (
            <div
              role="group"
              aria-label={tForm('optionalDetails')}
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
                    {tForm.rich(`addDetail.${detail}`, {
                      hidden: (chunks) => (
                        <span className="sr-only">{chunks}</span>
                      )
                    })}
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
          {tActions('cancel')}
        </Button>

        <SubmitButton form={formId} isPending={isSubmitting}>
          {target.kind === 'create'
            ? tForm(`submit.${selectedType}`)
            : tActions('saveChanges')}
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
  const t = useTranslations('transactions.form');
  const tActions = useTranslations('common.actions');

  const [isSaving, setIsSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

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
      <DialogContent
        className="sm:max-w-xl"
        hasUnsavedChanges={hasUnsavedChanges}
      >
        <DialogHeader>
          <DialogTitle>
            {target.kind === 'create'
              ? t('newTitle', { symbol })
              : t('editTitle', { symbol })}
          </DialogTitle>

          <DialogDescription>
            {t('description', { currency })}
          </DialogDescription>
        </DialogHeader>

        {positionQuery.isPending ? (
          <>
            <LoadingState label={t('loading', { symbol })} className="h-72" />

            <DialogFooter>
              <Button variant="outline" onClick={onCancel}>
                {tActions('cancel')}
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
            onDirtyChange={setHasUnsavedChanges}
          />
        )}
      </DialogContent>
    </Dialog>
  );
};

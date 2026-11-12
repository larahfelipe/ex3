import { useId, useMemo, type FC, type ReactNode } from 'react';
import {
  FormProvider,
  useForm,
  useFormContext,
  useFormState,
  useWatch
} from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'use-intl';
import { z } from 'zod';

import type {
  CreateInstallmentPlanRequestPayload,
  InstallmentPlanDetail,
  RecurrenceFrequency,
  RescheduleInstallmentPlanRequestPayload,
  UpdateInstallmentPlanRequestPayload
} from '@/app/api/v1/finances';
import {
  DEFAULT_CURRENCY,
  FINANCE_LIMITS,
  RECURRENCE_FREQUENCIES
} from '@/common/constants';
import { currencyFractionDigits } from '@/common/utils';
import {
  ChoiceField,
  FormField,
  FormSection,
  OptionalFields
} from '@/components/form-field';
import { InfoNote } from '@/components/info-note';
import { NumberInput } from '@/components/number-input';
import {
  OptionalDetailButtons,
  RemoveDetailButton,
  useOptionalDetails
} from '@/components/optional-details';
import { SubmitButton } from '@/components/submit-button';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  SegmentedControl,
  SegmentedControlItem
} from '@/components/ui';
import { useReferenceDay } from '@/hooks/use-finances';
import { useRevalidateOnLocaleChange } from '@/hooks/use-revalidate-on-locale-change';
import { useFormat, type Format } from '@/i18n/format';
import { srOnly } from '@/i18n/rich-text';
import type { Translator } from '@/i18n/translator';
import {
  decimalOfUnits,
  decimalPlacesOf,
  isNonzeroDecimal,
  isStorableDecimal,
  unitsOf
} from '@/lib/decimal';
import { presentSubmitError } from '@/lib/submit-error';

import {
  DayField,
  DESCRIPTION_FORM_FIELDS,
  DescriptionFields,
  descriptionFormFieldsFor,
  EMPTY_DESCRIPTION_FORM,
  fieldOfPath,
  FormRootError,
  MoneyField,
  MoreDetailsFields,
  optionalPositiveMoneyFieldFor,
  positiveMoneyFieldFor,
  requiredDayFieldFor,
  requireMinorUnitsOf,
  toDescriptionFormValues,
  useSubmitter,
  type ValidationTranslator
} from './finance-form';
import { occurrenceDayAt } from './recurrence-fields';

type AmountMode = (typeof AMOUNT_MODES)[number];

type InstallmentSplit = Record<'first' | 'rest', bigint>;

type ScheduleTerms = Record<'currency' | 'amount' | 'firstDueDate', string> &
  Record<'amountMode', AmountMode> &
  Record<'frequency', RecurrenceFrequency> &
  Record<'installmentCount', string> &
  Partial<Record<'principalAmount', string>>;

type PlanDraft = z.output<ReturnType<typeof planFormSchemaFor>>;

type PlanFormInput = z.input<ReturnType<typeof planFormSchemaFor>>;

type PlanEditDraft = z.output<ReturnType<typeof planEditFieldsFor>>;

type PlanEditInput = z.input<ReturnType<typeof planEditFieldsFor>>;

type RescheduleDraft = z.output<ReturnType<typeof rescheduleFormFieldsFor>>;

type RescheduleFormInput = z.input<ReturnType<typeof rescheduleFormFieldsFor>>;

type SummaryTranslator = Translator<'installments.summary'>;

type FormDialogProps<Payload> = Record<'onCancel', VoidFunction> &
  Record<'onSubmit', (payload: Payload) => Promise<unknown>>;

type PlanDialogProps<Payload> = FormDialogProps<Payload> &
  Record<'plan', InstallmentPlanDetail>;

const AMOUNT_MODES = ['total', 'installment'] as const;

/** The API schedules a day past the 28th on the last day of a shorter month. */
const LAST_SHARED_DAY_OF_MONTH = 28;

const COUNT_MAX_LENGTH = String(FINANCE_LIMITS.InstallmentMaxCount).length;

const installmentCountFieldFor = (t: ValidationTranslator) =>
  z.coerce
    .number<string>(t('installments.countRequired'))
    .int(t('installments.countWhole'))
    .min(1, t('installments.countMin'))
    .max(
      FINANCE_LIMITS.InstallmentMaxCount,
      t('installments.countMax', { max: FINANCE_LIMITS.InstallmentMaxCount })
    );

const InstallmentCountHint: FC<Record<'frequency', RecurrenceFrequency>> = ({
  frequency
}) => {
  const t = useTranslations('installments.form');
  const tFinances = useTranslations('finances');

  return t('countHint', {
    max: FINANCE_LIMITS.InstallmentMaxCount,
    period: tFinances(`perPeriod.${frequency}`)
  });
};

/** A count the form would accept, or null while it is being typed. */
const installmentCountOf = (value: string | number) => {
  const count = Number(value);

  return Number.isInteger(count) &&
    count >= 1 &&
    count <= FINANCE_LIMITS.InstallmentMaxCount
    ? count
    : null;
};

/** In the currency's minor units, or null for what its own field refuses. */
const minorUnitsOf = (amount: string, currency: string) => {
  const places = currencyFractionDigits(currency);

  return isStorableDecimal(amount) && decimalPlacesOf(amount) <= places
    ? unitsOf(amount, places)
    : null;
};

/**
 * The API's split: each installment the total divided evenly and truncated to
 * the minor unit, the first one taking what is left. Null when an installment
 * would owe nothing.
 */
const splitOf = (total: bigint, count: number): InstallmentSplit | null => {
  const rest = total / BigInt(count);

  return rest === 0n
    ? null
    : { first: rest + (total - rest * BigInt(count)), rest };
};

const moneyOfUnits = (
  units: bigint,
  currency: string,
  { formatMoney }: Format
) =>
  formatMoney(
    decimalOfUnits(units, currencyFractionDigits(currency)),
    currency
  );

const tooSmallToSplitMessage = (
  count: number,
  currency: string,
  t: ValidationTranslator,
  format: Format
) =>
  t('installments.tooSmallToSplit', {
    count,
    amount: moneyOfUnits(1n, currency, format)
  });

const planFormSchemaFor = (t: ValidationTranslator, format: Format) => {
  const requirePlanMinorUnits = requireMinorUnitsOf(
    ['amount', 'principalAmount'],
    t
  );

  return descriptionFormFieldsFor(t)
    .extend({
      currency: z.string().min(1, t('currency.required')),
      amountMode: z.enum(AMOUNT_MODES),
      amount: positiveMoneyFieldFor(t),
      installmentCount: installmentCountFieldFor(t),
      frequency: z.enum(RECURRENCE_FREQUENCIES),
      firstDueDate: requiredDayFieldFor(t),
      principalAmount: optionalPositiveMoneyFieldFor(t)
    })
    .superRefine((plan, ctx) => {
      requirePlanMinorUnits(plan, ctx);

      const total = minorUnitsOf(plan.amount, plan.currency);
      const count = installmentCountOf(plan.installmentCount);

      if (
        plan.amountMode === 'total' &&
        total !== null &&
        count !== null &&
        splitOf(total, count) === null
      )
        ctx.addIssue({
          code: 'custom',
          path: ['amount'],
          message: tooSmallToSplitMessage(count, plan.currency, t, format)
        });
    });
};

const PLAN_FORM_FIELDS = [
  ...DESCRIPTION_FORM_FIELDS,
  'currency',
  'amountMode',
  'amount',
  'installmentCount',
  'frequency',
  'firstDueDate',
  'principalAmount'
] as const satisfies ReadonlyArray<keyof PlanFormInput>;

/** The API names the amount after its mode; the form has one field for both. */
const planFieldOf = (path: string) =>
  path === 'totalAmount' || path === 'installmentAmount'
    ? 'amount'
    : fieldOfPath(PLAN_FORM_FIELDS)(path);

const planPayloadOf = ({
  amountMode,
  amount,
  ...plan
}: PlanDraft): CreateInstallmentPlanRequestPayload =>
  amountMode === 'total'
    ? { ...plan, totalAmount: amount }
    : { ...plan, installmentAmount: amount };

const planEditFieldsFor = (t: ValidationTranslator) =>
  descriptionFormFieldsFor(t).extend({
    principalAmount: optionalPositiveMoneyFieldFor(t)
  });

const planEditSchemaFor = (t: ValidationTranslator, currency: string) => {
  const requirePrincipalMinorUnits = requireMinorUnitsOf(
    ['principalAmount'],
    t
  );

  return planEditFieldsFor(t).superRefine((draft, ctx) =>
    requirePrincipalMinorUnits({ ...draft, currency }, ctx)
  );
};

const planEditFieldOf = fieldOfPath([
  ...DESCRIPTION_FORM_FIELDS,
  'principalAmount'
] as const satisfies ReadonlyArray<keyof PlanEditInput>);

const rescheduleFormFieldsFor = (t: ValidationTranslator) =>
  z.object({
    remainingAmount: positiveMoneyFieldFor(t),
    remainingCount: installmentCountFieldFor(t),
    nextDueDate: requiredDayFieldFor(t)
  });

const rescheduleFieldOf = fieldOfPath([
  'remainingAmount',
  'remainingCount',
  'nextDueDate'
] as const satisfies ReadonlyArray<keyof RescheduleFormInput>);

/** The last installment a reschedule keeps, and the owed ones it replaces. */
const rescheduleSplitOf = ({
  installments,
  keptThroughInstallment
}: Pick<InstallmentPlanDetail, 'installments' | 'keptThroughInstallment'>) => {
  const keptThrough = keptThroughInstallment ?? 0;
  const isKept = ({
    installmentNumber
  }: {
    installmentNumber: number | null;
  }) => (installmentNumber ?? 0) <= keptThrough;

  return {
    lastKept: installments.filter(isKept).at(-1) ?? null,
    replaced: installments.filter(
      (installment) =>
        !isKept(installment) && installment.status !== 'CANCELLED'
    )
  };
};

/** The number of the last installment a reschedule keeps, or null when it keeps none. */
const lastKeptNumberOf = (plan: InstallmentPlanDetail) => {
  const { lastKept } = rescheduleSplitOf(plan);

  return lastKept === null
    ? null
    : (lastKept.installmentNumber ?? plan.keptThroughInstallment ?? 0);
};

const rescheduleSchemaFor = (
  plan: InstallmentPlanDetail,
  t: ValidationTranslator,
  format: Format
) => {
  const { lastKept } = rescheduleSplitOf(plan);
  const lastKeptNumber = lastKeptNumberOf(plan);
  const requireRescheduleMinorUnits = requireMinorUnitsOf(
    ['remainingAmount'],
    t
  );

  return rescheduleFormFieldsFor(t).superRefine((terms, ctx) => {
    requireRescheduleMinorUnits({ ...terms, currency: plan.currency }, ctx);

    const total = minorUnitsOf(terms.remainingAmount, plan.currency);
    const count = installmentCountOf(terms.remainingCount);

    if (total !== null && count !== null && splitOf(total, count) === null)
      ctx.addIssue({
        code: 'custom',
        path: ['remainingAmount'],
        message: tooSmallToSplitMessage(count, plan.currency, t, format)
      });

    if (
      lastKept !== null &&
      lastKeptNumber !== null &&
      terms.nextDueDate !== '' &&
      terms.nextDueDate < lastKept.dueDate
    )
      ctx.addIssue({
        code: 'custom',
        path: ['nextDueDate'],
        message: t('installments.afterKept', {
          day: format.formatCalendarDay(lastKept.dueDate) ?? lastKept.dueDate,
          number: lastKeptNumber
        })
      });
  });
};

const rescheduleDefaultsOf = (
  plan: InstallmentPlanDetail,
  today: string
): RescheduleFormInput => {
  const { lastKept, replaced } = rescheduleSplitOf(plan);
  const places = currencyFractionDigits(plan.currency);
  const owed = replaced.reduce(
    (sum, { amount }) => sum + (minorUnitsOf(amount, plan.currency) ?? 0n),
    0n
  );

  return {
    remainingAmount: owed === 0n ? '' : decimalOfUnits(owed, places),
    remainingCount: String(Math.max(replaced.length, 1)),
    nextDueDate:
      replaced.at(0)?.dueDate ??
      (lastKept === null
        ? today
        : (occurrenceDayAt(plan.frequency, lastKept.dueDate, 1) ?? today))
  };
};

/** How the API moves a day the later months or years lack. */
const shorterPeriodNoteOf = (
  frequency: RecurrenceFrequency,
  firstDueDate: string
) => {
  if (
    frequency === 'MONTHLY' &&
    Number(firstDueDate.slice(-2)) > LAST_SHARED_DAY_OF_MONTH
  )
    return 'lastDayOfMonth' as const;
  if (frequency === 'YEARLY' && firstDueDate.endsWith('-02-29'))
    return 'february28' as const;

  return null;
};

const dueSpanOf = (
  firstDueDate: string,
  count: number,
  frequency: RecurrenceFrequency,
  t: SummaryTranslator,
  { formatCalendarDay }: Format
) => {
  const first = formatCalendarDay(firstDueDate);
  const lastDueDate = occurrenceDayAt(frequency, firstDueDate, count - 1);
  const last = lastDueDate === null ? null : formatCalendarDay(lastDueDate);

  if (first === null || last === null) return null;

  return count === 1
    ? { label: t('dueOn'), value: first }
    : { label: t('dueSpan'), value: t('dueSpanValue', { first, last }) };
};

/** The cash price difference's share of the cash price, as a fraction of one. */
const PERCENT_SCALE = 6;

/** How much more or less than the cash price the installments total, or null when they are the same. */
const cashPriceDifferenceOf = (
  total: bigint,
  principal: bigint,
  currency: string,
  t: SummaryTranslator,
  format: Format
) => {
  if (total === principal) return null;

  const difference = total > principal ? total - principal : principal - total;
  const share = decimalOfUnits(
    (difference * 10n ** BigInt(PERCENT_SCALE)) / principal,
    PERCENT_SCALE
  );

  return t('difference', {
    amount: moneyOfUnits(difference, currency, format),
    direction: total > principal ? 'more' : 'less',
    percent: format.formatPercent(share)
  });
};

/** The cash price of a plan whose total is known, measured against that total once it is typed. */
const CashPriceHint: FC<
  Record<'total', bigint | null> &
    Record<'principalAmount' | 'currency', string>
> = ({ total, principalAmount, currency }) => {
  const t = useTranslations('installments.form');
  const tSummary = useTranslations('installments.summary');
  const format = useFormat();
  const principal = isNonzeroDecimal(principalAmount)
    ? minorUnitsOf(principalAmount, currency)
    : null;

  if (total === null || principal === null) return t('cashPriceHint');

  return t('cashPriceCompared', {
    total: moneyOfUnits(total, currency, format),
    difference:
      cashPriceDifferenceOf(total, principal, currency, tSummary, format) ??
      t('cashPriceSame')
  });
};

/** What the API will schedule from the terms as typed, or null while they are incomplete. */
const scheduleOf = (
  {
    currency,
    amountMode,
    amount,
    installmentCount,
    frequency,
    firstDueDate,
    principalAmount
  }: ScheduleTerms,
  t: SummaryTranslator,
  format: Format
) => {
  const count = installmentCountOf(installmentCount);
  const units = minorUnitsOf(amount, currency);

  if (count === null || units === null || units === 0n) return null;

  const split =
    amountMode === 'total'
      ? splitOf(units, count)
      : { first: units, rest: units };

  if (split === null) return null;

  const principal =
    principalAmount === undefined || !isNonzeroDecimal(principalAmount)
      ? null
      : minorUnitsOf(principalAmount, currency);

  return {
    count,
    split,
    total: amountMode === 'total' ? units : units * BigInt(count),
    principal,
    dueSpan: dueSpanOf(firstDueDate, count, frequency, t, format),
    note: shorterPeriodNoteOf(frequency, firstDueDate)
  };
};

const SummaryFigure: FC<Record<'label' | 'value', string>> = ({
  label,
  value
}) => (
  <div className="min-w-0 space-y-0.5">
    <dt className="text-xs text-muted-foreground">{label}</dt>

    <dd className="font-medium tabular-nums">{value}</dd>
  </div>
);

/** The installments, the total and the dates the terms as typed schedule, kept in step with the fields. */
const ScheduleSummary: FC<Record<'terms', ScheduleTerms>> = ({ terms }) => {
  const t = useTranslations('installments.summary');
  const tFinances = useTranslations('finances');
  const format = useFormat();
  const schedule = scheduleOf(terms, t, format);
  const { currency, frequency } = terms;

  return (
    <section
      aria-label={t('label')}
      aria-live="polite"
      className="rounded-lg border bg-muted/40 p-4 text-sm"
    >
      {schedule === null ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        <div className="space-y-3">
          <div className="space-y-0.5">
            <p className="text-lg font-semibold tabular-nums">
              {schedule.count > 1
                ? t.rich('installmentsPerPeriod', {
                    count: schedule.count,
                    amount: moneyOfUnits(schedule.split.rest, currency, format),
                    period: tFinances(`perPeriod.${frequency}`),
                    muted: (chunks) => (
                      <span className="text-sm font-normal text-muted-foreground">
                        {chunks}
                      </span>
                    )
                  })
                : t('installments', {
                    count: schedule.count,
                    amount: moneyOfUnits(schedule.split.rest, currency, format)
                  })}
            </p>

            {schedule.split.first !== schedule.split.rest && (
              <p className="text-muted-foreground tabular-nums">
                {t('firstDiffers', {
                  amount: moneyOfUnits(schedule.split.first, currency, format)
                })}
              </p>
            )}
          </div>

          <dl className="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-x-4 gap-y-3">
            <SummaryFigure
              label={t('total')}
              value={moneyOfUnits(schedule.total, currency, format)}
            />

            {schedule.dueSpan !== null && (
              <SummaryFigure {...schedule.dueSpan} />
            )}

            {schedule.principal !== null && (
              <SummaryFigure
                label={t('comparedWithCashPrice')}
                value={
                  cashPriceDifferenceOf(
                    schedule.total,
                    schedule.principal,
                    currency,
                    t,
                    format
                  ) ?? t('noDifference')
                }
              />
            )}
          </dl>

          {schedule.note !== null && (
            <p className="text-xs text-muted-foreground">
              {t(`notes.${schedule.note}`)}
            </p>
          )}
        </div>
      )}
    </section>
  );
};

const PlanScheduleSummary: FC = () => {
  const { control } = useFormContext<PlanFormInput>();
  const [
    currency,
    amountMode,
    amount,
    installmentCount,
    frequency,
    firstDueDate,
    principalAmount
  ] = useWatch({
    control,
    name: [
      'currency',
      'amountMode',
      'amount',
      'installmentCount',
      'frequency',
      'firstDueDate',
      'principalAmount'
    ]
  });

  return (
    <ScheduleSummary
      terms={{
        currency,
        amountMode,
        amount,
        installmentCount,
        frequency,
        firstDueDate,
        principalAmount
      }}
    />
  );
};

export const CreatePlanDialog: FC<
  FormDialogProps<CreateInstallmentPlanRequestPayload>
> = ({ onCancel, onSubmit }) => {
  const t = useTranslations('installments.form');
  const tFinances = useTranslations('finances');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const tActions = useTranslations('common.actions');
  const formId = useId();
  const today = useReferenceDay();
  const format = useFormat();
  const schema = useMemo(
    () => planFormSchemaFor(tValidation, format),
    [tValidation, format]
  );

  const methods = useForm<PlanFormInput, unknown, PlanDraft>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: {
      ...EMPTY_DESCRIPTION_FORM,
      currency: DEFAULT_CURRENCY,
      amountMode: 'total',
      amount: '',
      installmentCount: '',
      frequency: 'MONTHLY',
      firstDueDate: today,
      principalAmount: ''
    }
  });

  useRevalidateOnLocaleChange(methods.formState.errors, methods.trigger);

  const {
    control,
    register,
    getValues,
    trigger,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting }
  } = methods;

  const [currency, amountMode, frequency] = useWatch({
    control,
    name: ['currency', 'amountMode', 'frequency']
  });

  const revalidateAmount = () => {
    if (getValues('amount') !== '') void trigger('amount');
  };

  const { isSaving, submit } = useSubmitter(onSubmit, planPayloadOf, (error) =>
    presentSubmitError(error, {
      setError,
      fieldOf: planFieldOf,
      t: tErrors,
      fallbackMessage: t('failed')
    })
  );

  return (
    <Dialog
      open
      onOpenChange={() => {
        if (!isSaving) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-2xl" hasUnsavedChanges={isDirty}>
        <DialogHeader>
          <DialogTitle>{t('addTitle')}</DialogTitle>

          <DialogDescription>{t('addDescription')}</DialogDescription>
        </DialogHeader>

        <DialogBody>
          <FormProvider {...methods}>
            <form
              id={formId}
              noValidate
              className="grid gap-6"
              onSubmit={handleSubmit(submit)}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <DescriptionFields />
              </div>

              <FormSection
                title={t('scheduleSection')}
                action={
                  <fieldset>
                    <legend className="sr-only">{t('amountMode')}</legend>

                    <SegmentedControl>
                      {AMOUNT_MODES.map((mode) => (
                        <SegmentedControlItem
                          key={mode}
                          value={mode}
                          {...register('amountMode', {
                            onChange: revalidateAmount
                          })}
                        >
                          {t(`amountModes.${mode}`)}
                        </SegmentedControlItem>
                      ))}
                    </SegmentedControl>
                  </fieldset>
                }
              >
                <div className="grid gap-4 sm:grid-cols-2">
                  <MoneyField
                    name="amount"
                    currencyName="currency"
                    label={t(`amounts.${amountMode}`)}
                    currency={currency}
                    hint={t(`amountHints.${amountMode}`)}
                  />

                  <FormField
                    label={t('count')}
                    hint={<InstallmentCountHint frequency={frequency} />}
                    error={errors.installmentCount?.message}
                  >
                    {(fieldControl) => (
                      <NumberInput
                        {...fieldControl}
                        maxLength={COUNT_MAX_LENGTH}
                        className="tabular-nums"
                        {...register('installmentCount', {
                          onChange: revalidateAmount
                        })}
                      />
                    )}
                  </FormField>

                  <ChoiceField
                    legend={t('frequency')}
                    error={errors.frequency?.message}
                  >
                    <SegmentedControl className="grid min-h-(--field-height) grid-cols-3">
                      {RECURRENCE_FREQUENCIES.map((option) => (
                        <SegmentedControlItem
                          key={option}
                          value={option}
                          {...register('frequency')}
                        >
                          {tFinances(`frequencies.${option}`)}
                        </SegmentedControlItem>
                      ))}
                    </SegmentedControl>
                  </ChoiceField>

                  <DayField name="firstDueDate" label={t('firstDueDate')} />
                </div>

                <CashPriceDetail
                  currency={currency}
                  hint={t('cashPriceHint')}
                />

                <PlanScheduleSummary />
              </FormSection>

              <MoreDetailsFields />

              <FormRootError />
            </form>
          </FormProvider>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            {tActions('cancel')}
          </Button>

          <SubmitButton form={formId} isPending={isSubmitting}>
            {t('submitAdd')}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

type CashPriceInput = Record<'principalAmount', string>;

const CASH_PRICE = ['principalAmount'] as const;

/** A plan's cash price, optional and kept out of the way until it is asked for. */
const CashPriceDetail: FC<
  Record<'currency', string> & Record<'hint', ReactNode>
> = ({ currency, hint }) => {
  const t = useTranslations('installments.form');
  const { control, getValues, setFocus, setValue } =
    useFormContext<CashPriceInput>();
  const { errors } = useFormState({ control, name: 'principalAmount' });
  const details = useOptionalDetails({
    details: CASH_PRICE,
    initiallyShown: () =>
      getValues('principalAmount') === '' ? [] : CASH_PRICE,
    required: errors.principalAmount === undefined ? [] : CASH_PRICE,
    focus: setFocus,
    clear: (detail) =>
      setValue(detail, '', { shouldDirty: true, shouldValidate: true })
  });

  return details.isShown('principalAmount') ? (
    <OptionalFields>
      <MoneyField
        isOptional
        name="principalAmount"
        label={t('cashPrice')}
        currency={currency}
        hint={hint}
        action={
          <RemoveDetailButton onClick={() => details.remove('principalAmount')}>
            {t.rich('removeCashPrice', { hidden: srOnly })}
          </RemoveDetailButton>
        }
      />
    </OptionalFields>
  ) : (
    <OptionalDetailButtons
      label={t('optionalDetails')}
      details={details.hidden}
      labelOf={() => t.rich('addCashPrice', { hidden: srOnly })}
      onShow={details.show}
      buttonRefOf={details.addButtonRef}
    />
  );
};

const PlanCashPriceDetail: FC<Record<'plan', InstallmentPlanDetail>> = ({
  plan
}) => {
  const { control } = useFormContext<PlanEditInput>();
  const principalAmount = useWatch({ control, name: 'principalAmount' });

  return (
    <CashPriceDetail
      currency={plan.currency}
      hint={
        <CashPriceHint
          total={minorUnitsOf(plan.totalAmount, plan.currency)}
          principalAmount={principalAmount}
          currency={plan.currency}
        />
      }
    />
  );
};

export const EditPlanDialog: FC<
  PlanDialogProps<UpdateInstallmentPlanRequestPayload>
> = ({ plan, onCancel, onSubmit }) => {
  const t = useTranslations('installments.form');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const tActions = useTranslations('common.actions');
  const formId = useId();
  const schema = useMemo(
    () => planEditSchemaFor(tValidation, plan.currency),
    [tValidation, plan.currency]
  );

  const methods = useForm<PlanEditInput, unknown, PlanEditDraft>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: {
      ...toDescriptionFormValues(plan),
      principalAmount: plan.principalAmount ?? ''
    }
  });

  useRevalidateOnLocaleChange(methods.formState.errors, methods.trigger);

  const {
    handleSubmit,
    setError,
    formState: { isDirty, isSubmitting }
  } = methods;

  const { isSaving, submit } = useSubmitter(
    onSubmit,
    (draft: PlanEditDraft) => draft,
    (error) =>
      presentSubmitError(error, {
        setError,
        fieldOf: planEditFieldOf,
        t: tErrors,
        fallbackMessage: t('failed')
      })
  );

  return (
    <Dialog
      open
      onOpenChange={() => {
        if (!isSaving) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-xl" hasUnsavedChanges={isDirty}>
        <DialogHeader>
          <DialogTitle>{t('editTitle')}</DialogTitle>

          <DialogDescription>
            {t('editDescription', { currency: plan.currency })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <FormProvider {...methods}>
            <form
              id={formId}
              noValidate
              className="grid gap-6"
              onSubmit={handleSubmit(submit)}
            >
              <InfoNote>{t('editNote')}</InfoNote>

              <div className="grid gap-4 sm:grid-cols-2">
                <DescriptionFields />
              </div>

              <PlanCashPriceDetail plan={plan} />

              <MoreDetailsFields />

              <FormRootError />
            </form>
          </FormProvider>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            {tActions('cancel')}
          </Button>

          <SubmitButton form={formId} isPending={isSubmitting}>
            {tActions('saveChanges')}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const RescheduleScheduleSummary: FC<
  Record<'currency', string> & Record<'frequency', RecurrenceFrequency>
> = ({ currency, frequency }) => {
  const { control } = useFormContext<RescheduleFormInput>();
  const [amount, installmentCount, firstDueDate] = useWatch({
    control,
    name: ['remainingAmount', 'remainingCount', 'nextDueDate']
  });

  return (
    <ScheduleSummary
      terms={{
        currency,
        amountMode: 'total',
        amount,
        installmentCount,
        frequency,
        firstDueDate
      }}
    />
  );
};

const keptTextOf = (
  plan: InstallmentPlanDetail,
  t: Translator<'installments.reschedule'>
) => {
  const { replaced } = rescheduleSplitOf(plan);
  const lastKeptNumber = lastKeptNumberOf(plan);
  const replacedText = t('replaced', { count: replaced.length });

  if (lastKeptNumber === null)
    return replaced.length === 0
      ? t('noneOwed')
      : t('noPayments', { replaced: replacedText });

  const kept = t('kept', { number: lastKeptNumber });

  return replaced.length === 0
    ? t('keptThenAdded', { kept })
    : t('keptThenReplaced', { kept, replaced: replacedText });
};

export const ReschedulePlanDialog: FC<
  PlanDialogProps<RescheduleInstallmentPlanRequestPayload>
> = ({ plan, onCancel, onSubmit }) => {
  const t = useTranslations('installments.reschedule');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const tActions = useTranslations('common.actions');
  const formId = useId();
  const today = useReferenceDay();
  const format = useFormat();
  const schema = useMemo(
    () => rescheduleSchemaFor(plan, tValidation, format),
    [plan, tValidation, format]
  );

  const methods = useForm<RescheduleFormInput, unknown, RescheduleDraft>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: rescheduleDefaultsOf(plan, today)
  });

  useRevalidateOnLocaleChange(methods.formState.errors, methods.trigger);

  const {
    register,
    getValues,
    trigger,
    handleSubmit,
    setError,
    formState: { errors, isDirty, isSubmitting }
  } = methods;

  const revalidateAmount = () => {
    if (getValues('remainingAmount') !== '') void trigger('remainingAmount');
  };

  const { isSaving, submit } = useSubmitter(
    onSubmit,
    (draft: RescheduleDraft) => draft,
    (error) =>
      presentSubmitError(error, {
        setError,
        fieldOf: rescheduleFieldOf,
        t: tErrors,
        fallbackMessage: t('failed')
      })
  );

  return (
    <Dialog
      open
      onOpenChange={() => {
        if (!isSaving) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-xl" hasUnsavedChanges={isDirty}>
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">
            {t('title', { description: plan.description })}
          </DialogTitle>

          <DialogDescription>
            {t('description', { frequency: plan.frequency })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <FormProvider {...methods}>
            <form
              id={formId}
              noValidate
              className="grid gap-4"
              onSubmit={handleSubmit(submit)}
            >
              <InfoNote>{keptTextOf(plan, t)}</InfoNote>

              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyField
                  name="remainingAmount"
                  label={t('amount')}
                  currency={plan.currency}
                  hint={t('amountHint')}
                  className="sm:col-span-2"
                />

                <FormField
                  label={t('count')}
                  hint={<InstallmentCountHint frequency={plan.frequency} />}
                  error={errors.remainingCount?.message}
                >
                  {(fieldControl) => (
                    <NumberInput
                      {...fieldControl}
                      maxLength={COUNT_MAX_LENGTH}
                      className="tabular-nums"
                      {...register('remainingCount', {
                        onChange: revalidateAmount
                      })}
                    />
                  )}
                </FormField>

                <DayField name="nextDueDate" label={t('nextDueDate')} />
              </div>

              <RescheduleScheduleSummary
                currency={plan.currency}
                frequency={plan.frequency}
              />

              <FormRootError />
            </form>
          </FormProvider>
        </DialogBody>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            {tActions('cancel')}
          </Button>

          <SubmitButton form={formId} isPending={isSubmitting}>
            {t('submit')}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

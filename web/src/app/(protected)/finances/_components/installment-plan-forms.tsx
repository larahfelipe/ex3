import { useId, type FC } from 'react';
import {
  FormProvider,
  useForm,
  useFormContext,
  useWatch
} from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
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
  RECURRENCE_FREQUENCIES,
  RECURRENCE_FREQUENCY_LABELS,
  RECURRENCE_FREQUENCY_UNITS
} from '@/common/constants';
import { currencyFractionDigits, formatMoney } from '@/common/utils';
import { ChoiceField, FormField } from '@/components/form-field';
import { InfoNote } from '@/components/info-note';
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
import { useReferenceDay } from '@/hooks/use-finances';
import { formatCalendarDay } from '@/lib/dates';
import {
  decimalOfUnits,
  decimalPlacesOf,
  isNonzeroDecimal,
  isStorableDecimal,
  unitsOf
} from '@/lib/decimal';
import { presentSubmitError } from '@/lib/submit-error';

import {
  CurrencyField,
  DayField,
  DescriptionFields,
  DescriptionFormFields,
  EMPTY_DESCRIPTION_FORM,
  fieldOfPath,
  FormRootError,
  MoneyField,
  optionalPositiveMoneyField,
  positiveMoneyField,
  requiredDayField,
  requireMinorUnitsOf,
  toDescriptionFormValues,
  useSubmitter
} from './finance-form';
import { occurrenceDayAt } from './recurring-expense-forms';

type AmountMode = (typeof AMOUNT_MODES)[number];

type InstallmentSplit = Record<'first' | 'rest', bigint>;

type ScheduleTerms = Record<'currency' | 'amount' | 'firstDueDate', string> &
  Record<'amountMode', AmountMode> &
  Record<'frequency', RecurrenceFrequency> &
  Record<'installmentCount', string> &
  Partial<Record<'principalAmount', string>>;

type PlanDraft = z.output<typeof PlanFormSchema>;

type PlanFormInput = z.input<typeof PlanFormSchema>;

type PlanEditDraft = z.output<typeof PlanEditFields>;

type PlanEditInput = z.input<typeof PlanEditFields>;

type RescheduleDraft = z.output<typeof RescheduleFormFields>;

type RescheduleFormInput = z.input<typeof RescheduleFormFields>;

type FormDialogProps<Payload> = Record<'onCancel', VoidFunction> &
  Record<'onSubmit', (payload: Payload) => Promise<unknown>>;

type PlanDialogProps<Payload> = FormDialogProps<Payload> &
  Record<'plan', InstallmentPlanDetail>;

const AMOUNT_MODES = ['total', 'installment'] as const;

const AMOUNT_MODE_LABELS: Record<AmountMode, string> = {
  total: 'Total',
  installment: 'Each installment'
};

const AMOUNT_LABELS: Record<AmountMode, string> = {
  total: 'Total amount',
  installment: 'Installment amount'
};

const AMOUNT_HINTS: Record<AmountMode, string> = {
  total:
    'Split evenly; the first installment takes the cents that do not divide',
  installment: 'Every installment owes this amount'
};

/** The API schedules a day past the 28th on the last day of a shorter month. */
const LAST_SHARED_DAY_OF_MONTH = 28;

const installmentCountHint = (frequency: RecurrenceFrequency) =>
  `1 to ${FINANCE_LIMITS.InstallmentMaxCount}, one a ${RECURRENCE_FREQUENCY_UNITS[frequency]}`;

const installmentCountField = (field: string) =>
  z.coerce
    .number<string>(`Enter the number of ${field}`)
    .int(`Enter a whole number of ${field}`)
    .min(1, `At least 1 of the ${field}`)
    .max(
      FINANCE_LIMITS.InstallmentMaxCount,
      `At most ${FINANCE_LIMITS.InstallmentMaxCount} ${field}`
    );

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

const moneyOfUnits = (units: bigint, currency: string) =>
  formatMoney(
    decimalOfUnits(units, currencyFractionDigits(currency)),
    currency
  );

const tooSmallToSplitMessage = (count: number, currency: string) =>
  `Too small to give each of the ${count} installments at least ${moneyOfUnits(1n, currency)}`;

const PlanFormFields = DescriptionFormFields.extend({
  currency: z.string().min(1, 'Currency is required'),
  amountMode: z.enum(AMOUNT_MODES),
  amount: positiveMoneyField('Amount'),
  installmentCount: installmentCountField('installments'),
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  firstDueDate: requiredDayField('First due date'),
  principalAmount: optionalPositiveMoneyField('Cash price')
});

const requirePlanMinorUnits = requireMinorUnitsOf([
  'amount',
  'principalAmount'
]);

const PlanFormSchema = PlanFormFields.superRefine((plan, ctx) => {
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
      message: tooSmallToSplitMessage(count, plan.currency)
    });
});

const PLAN_FORM_FIELDS = PlanFormFields.keyof().options;

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

const PlanEditFields = DescriptionFormFields.extend({
  principalAmount: optionalPositiveMoneyField('Cash price')
});

const planEditFieldOf = fieldOfPath(PlanEditFields.keyof().options);

const RescheduleFormFields = z.object({
  remainingAmount: positiveMoneyField('Amount left'),
  remainingCount: installmentCountField('installments'),
  nextDueDate: requiredDayField('Next due date')
});

const rescheduleFieldOf = fieldOfPath(RescheduleFormFields.keyof().options);

const requireRescheduleMinorUnits = requireMinorUnitsOf(['remainingAmount']);

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

const rescheduleSchemaFor = (plan: InstallmentPlanDetail) => {
  const { lastKept } = rescheduleSplitOf(plan);

  return RescheduleFormFields.superRefine((terms, ctx) => {
    requireRescheduleMinorUnits({ ...terms, currency: plan.currency }, ctx);

    const total = minorUnitsOf(terms.remainingAmount, plan.currency);
    const count = installmentCountOf(terms.remainingCount);

    if (total !== null && count !== null && splitOf(total, count) === null)
      ctx.addIssue({
        code: 'custom',
        path: ['remainingAmount'],
        message: tooSmallToSplitMessage(count, plan.currency)
      });

    if (
      lastKept !== null &&
      terms.nextDueDate !== '' &&
      terms.nextDueDate < lastKept.dueDate
    )
      ctx.addIssue({
        code: 'custom',
        path: ['nextDueDate'],
        message: `On or after ${formatCalendarDay(lastKept.dueDate) ?? lastKept.dueDate}, when installment ${lastKept.installmentNumber} is due`
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

/** How the API moves a day the later months or years lack, in words. */
const shorterPeriodTextOf = (
  frequency: RecurrenceFrequency,
  firstDueDate: string
) => {
  if (
    frequency === 'MONTHLY' &&
    Number(firstDueDate.slice(-2)) > LAST_SHARED_DAY_OF_MONTH
  )
    return ', on the last day of shorter months';
  if (frequency === 'YEARLY' && firstDueDate.endsWith('-02-29'))
    return ', on 28 February outside leap years';

  return '';
};

const dueSpanText = (
  firstDueDate: string,
  count: number,
  frequency: RecurrenceFrequency
) => {
  const first = formatCalendarDay(firstDueDate);
  const lastDueDate = occurrenceDayAt(frequency, firstDueDate, count - 1);
  const last = lastDueDate === null ? null : formatCalendarDay(lastDueDate);

  if (first === null || last === null) return null;

  return count === 1
    ? `Due on ${first}`
    : `Due ${RECURRENCE_FREQUENCY_LABELS[frequency].toLowerCase()} from ${first} to ${last}${shorterPeriodTextOf(frequency, firstDueDate)}`;
};

const cashPriceText = (total: bigint, principal: bigint, currency: string) => {
  if (total === principal) return 'The same as the cash price';

  return total > principal
    ? `${moneyOfUnits(total - principal, currency)} more than the cash price`
    : `${moneyOfUnits(principal - total, currency)} less than the cash price`;
};

/** What the API will schedule from the terms as typed, line by line. */
const scheduleLinesOf = ({
  currency,
  amountMode,
  amount,
  installmentCount,
  frequency,
  firstDueDate,
  principalAmount
}: ScheduleTerms) => {
  const count = installmentCountOf(installmentCount);
  const units = minorUnitsOf(amount, currency);

  if (count === null || units === null || units === 0n) return null;

  const total = amountMode === 'total' ? units : units * BigInt(count);
  const split =
    amountMode === 'total'
      ? splitOf(units, count)
      : { first: units, rest: units };

  if (split === null) return null;

  const principal =
    principalAmount === undefined || !isNonzeroDecimal(principalAmount)
      ? null
      : minorUnitsOf(principalAmount, currency);

  const shares =
    count === 1
      ? `1 installment of ${moneyOfUnits(split.first, currency)}`
      : split.first === split.rest
        ? `${count} installments of ${moneyOfUnits(split.rest, currency)}`
        : `${count} installments: the first of ${moneyOfUnits(split.first, currency)}, then ${count - 1} of ${moneyOfUnits(split.rest, currency)}`;

  return [
    `${shares}, ${moneyOfUnits(total, currency)} in all`,
    dueSpanText(firstDueDate, count, frequency),
    principal === null ? null : cashPriceText(total, principal, currency)
  ].filter((line) => line !== null);
};

const SchedulePreview: FC<Record<'terms', ScheduleTerms>> = ({ terms }) => {
  const lines = scheduleLinesOf(terms);

  return (
    <div
      aria-live="polite"
      className="space-y-1 rounded-md border bg-muted/40 px-3 py-2.5 text-sm"
    >
      {lines === null ? (
        <p className="text-muted-foreground">
          The schedule appears here once the amount and the number of
          installments are filled in.
        </p>
      ) : (
        lines.map((line, index) => (
          <p
            key={line}
            className={index === 0 ? 'font-medium' : 'text-muted-foreground'}
          >
            {line}
          </p>
        ))
      )}
    </div>
  );
};

const PlanSchedulePreview: FC = () => {
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
    <SchedulePreview
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
  const formId = useId();
  const today = useReferenceDay();

  const methods = useForm<PlanFormInput, unknown, PlanDraft>({
    mode: 'onChange',
    resolver: zodResolver(PlanFormSchema),
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

  const {
    control,
    register,
    getValues,
    trigger,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
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
      fallbackMessage: 'The plan could not be saved'
    })
  );

  return (
    <Dialog
      open
      onOpenChange={() => {
        if (!isSaving) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add an installment plan</DialogTitle>

          <DialogDescription>
            Each installment becomes a bill, owed until you record its payment.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form
            id={formId}
            noValidate
            className="grid gap-4"
            onSubmit={handleSubmit(submit)}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <ChoiceField
                legend="Amount entered"
                error={errors.amountMode?.message}
                className="sm:col-span-2"
              >
                <SegmentedControl className="grid grid-cols-2 sm:flex sm:w-fit">
                  {AMOUNT_MODES.map((mode) => (
                    <SegmentedControlItem
                      key={mode}
                      value={mode}
                      {...register('amountMode', {
                        onChange: revalidateAmount
                      })}
                    >
                      {AMOUNT_MODE_LABELS[mode]}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
              </ChoiceField>

              <MoneyField
                name="amount"
                label={AMOUNT_LABELS[amountMode]}
                currency={currency}
                hint={AMOUNT_HINTS[amountMode]}
              />

              <CurrencyField name="currency" />

              <ChoiceField
                legend="Installments due"
                error={errors.frequency?.message}
                className="sm:col-span-2"
              >
                <SegmentedControl className="grid grid-cols-3 sm:flex sm:w-fit">
                  {RECURRENCE_FREQUENCIES.map((option) => (
                    <SegmentedControlItem
                      key={option}
                      value={option}
                      {...register('frequency')}
                    >
                      {RECURRENCE_FREQUENCY_LABELS[option]}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
              </ChoiceField>

              <FormField
                label="Installments"
                hint={installmentCountHint(frequency)}
                error={errors.installmentCount?.message}
              >
                {(fieldControl) => (
                  <Input
                    {...fieldControl}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={FINANCE_LIMITS.InstallmentMaxCount}
                    step={1}
                    {...register('installmentCount', {
                      onChange: revalidateAmount
                    })}
                  />
                )}
              </FormField>

              <DayField name="firstDueDate" label="First due date" />

              <MoneyField
                isOptional
                name="principalAmount"
                label="Cash price"
                currency={currency}
                hint="What paying at once would cost, to show what the installments add"
                className="sm:col-span-2"
              />
            </div>

            <PlanSchedulePreview />

            <DescriptionFields />

            <FormRootError />
          </form>
        </FormProvider>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </Button>

          <SubmitButton form={formId} isPending={isSubmitting}>
            Add plan
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const EditPlanDialog: FC<
  PlanDialogProps<UpdateInstallmentPlanRequestPayload>
> = ({ plan, onCancel, onSubmit }) => {
  const formId = useId();

  const methods = useForm<PlanEditInput, unknown, PlanEditDraft>({
    mode: 'onChange',
    resolver: zodResolver(
      PlanEditFields.superRefine((draft, ctx) =>
        requireMinorUnitsOf(['principalAmount'])(
          { ...draft, currency: plan.currency },
          ctx
        )
      )
    ),
    defaultValues: {
      ...toDescriptionFormValues(plan),
      principalAmount: plan.principalAmount ?? ''
    }
  });

  const {
    handleSubmit,
    setError,
    formState: { isSubmitting }
  } = methods;

  const { isSaving, submit } = useSubmitter(
    onSubmit,
    (draft: PlanEditDraft) => draft,
    (error) =>
      presentSubmitError(error, {
        setError,
        fieldOf: planEditFieldOf,
        fallbackMessage: 'The plan could not be saved'
      })
  );

  return (
    <Dialog
      open
      onOpenChange={() => {
        if (!isSaving) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit plan</DialogTitle>

          <DialogDescription>
            {`Amounts in ${plan.currency}. To change what is still owed, reschedule the plan instead.`}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form
            id={formId}
            noValidate
            className="grid gap-4"
            onSubmit={handleSubmit(submit)}
          >
            <InfoNote>
              The description reaches the installments still owed, except those
              you edited on their own. Paid installments keep theirs.
            </InfoNote>

            <MoneyField
              isOptional
              name="principalAmount"
              label="Cash price"
              currency={plan.currency}
              hint="What paying at once would cost, to show what the installments add"
            />

            <DescriptionFields />

            <FormRootError />
          </form>
        </FormProvider>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </Button>

          <SubmitButton form={formId} isPending={isSubmitting}>
            Save changes
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const RescheduleSchedulePreview: FC<
  Record<'currency', string> & Record<'frequency', RecurrenceFrequency>
> = ({ currency, frequency }) => {
  const { control } = useFormContext<RescheduleFormInput>();
  const [amount, installmentCount, firstDueDate] = useWatch({
    control,
    name: ['remainingAmount', 'remainingCount', 'nextDueDate']
  });

  return (
    <SchedulePreview
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

const owedText = (count: number) =>
  count === 1
    ? 'the 1 installment still owed is'
    : `the ${count} still owed are`;

const keptTextOf = (plan: InstallmentPlanDetail) => {
  const { lastKept, replaced } = rescheduleSplitOf(plan);

  if (lastKept === null)
    return replaced.length === 0
      ? 'No installment is owed: the new ones are all the plan will owe.'
      : `No installment has a payment yet, so ${owedText(replaced.length)} replaced.`;

  const kept =
    lastKept.installmentNumber === 1
      ? 'Installment 1 has a payment and stays as it is'
      : `Installments 1 to ${lastKept.installmentNumber} stay as they are, up to the last one with a payment`;

  return replaced.length === 0
    ? `${kept}; the new installments are added after it.`
    : `${kept}. After it, ${owedText(replaced.length)} replaced.`;
};

export const ReschedulePlanDialog: FC<
  PlanDialogProps<RescheduleInstallmentPlanRequestPayload>
> = ({ plan, onCancel, onSubmit }) => {
  const formId = useId();
  const today = useReferenceDay();

  const methods = useForm<RescheduleFormInput, unknown, RescheduleDraft>({
    mode: 'onChange',
    resolver: zodResolver(rescheduleSchemaFor(plan)),
    defaultValues: rescheduleDefaultsOf(plan, today)
  });

  const {
    register,
    getValues,
    trigger,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
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
        fallbackMessage: 'The plan could not be rescheduled'
      })
  );

  return (
    <Dialog
      open
      onOpenChange={() => {
        if (!isSaving) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">{`Reschedule ${plan.description}`}</DialogTitle>

          <DialogDescription>
            {`Replaces what is left to pay with new ${RECURRENCE_FREQUENCY_LABELS[plan.frequency].toLowerCase()} installments. Paid installments, and their history, are kept.`}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form
            id={formId}
            noValidate
            className="grid gap-4"
            onSubmit={handleSubmit(submit)}
          >
            <InfoNote>{keptTextOf(plan)}</InfoNote>

            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyField
                name="remainingAmount"
                label="Amount left"
                currency={plan.currency}
                hint="Split evenly; the first new installment takes the cents that do not divide"
                className="sm:col-span-2"
              />

              <FormField
                label="Installments"
                hint={installmentCountHint(plan.frequency)}
                error={errors.remainingCount?.message}
              >
                {(fieldControl) => (
                  <Input
                    {...fieldControl}
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={FINANCE_LIMITS.InstallmentMaxCount}
                    step={1}
                    {...register('remainingCount', {
                      onChange: revalidateAmount
                    })}
                  />
                )}
              </FormField>

              <DayField name="nextDueDate" label="Next due date" />
            </div>

            <RescheduleSchedulePreview
              currency={plan.currency}
              frequency={plan.frequency}
            />

            <FormRootError />
          </form>
        </FormProvider>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </Button>

          <SubmitButton form={formId} isPending={isSubmitting}>
            Reschedule
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

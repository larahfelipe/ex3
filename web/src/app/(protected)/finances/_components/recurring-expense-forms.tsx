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
  CancelRecurringExpenseRequestPayload,
  CreateRecurringExpenseRequestPayload,
  RecurrenceFrequency,
  RecurringExpenseDetail,
  UpdateRecurringExpenseRequestPayload
} from '@/app/api/v1/finances';
import {
  DEFAULT_CURRENCY,
  FINANCE_LIMITS,
  RECURRENCE_FREQUENCIES,
  RECURRENCE_FREQUENCY_LABELS,
  RECURRENCE_FREQUENCY_UNITS
} from '@/common/constants';
import { ChoiceField } from '@/components/form-field';
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
  SegmentedControl,
  SegmentedControlItem
} from '@/components/ui';
import { useReferenceDay } from '@/hooks/use-finances';
import {
  formatCalendarDay,
  shiftCalendarDay,
  shiftCalendarDayByMonths
} from '@/lib/dates';
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
  positiveMoneyField,
  requiredDayField,
  requireMinorUnitsOf,
  toDescriptionFormValues,
  useSubmitter
} from './finance-form';

type AmountKind = (typeof AMOUNT_KINDS)[number];

type EndMode = (typeof END_MODES)[number];

type SeriesTerms = Record<'amountKind', AmountKind> &
  Record<'endMode', EndMode> &
  Record<'endDate', string>;

type CreateSeriesInput = z.input<typeof CreateSeriesFields>;

type CreateSeriesDraft = z.output<typeof CreateSeriesFields>;

type EditSeriesInput = z.input<typeof EditSeriesFields>;

type EditSeriesDraft = z.output<typeof EditSeriesFields>;

type StopSeriesInput = z.input<typeof StopSeriesFields>;

type StopSeriesDraft = z.output<typeof StopSeriesFields>;

type FormDialogProps<Payload> = Record<'onCancel', VoidFunction> &
  Record<'onSubmit', (payload: Payload) => Promise<unknown>>;

type SeriesDialogProps<Payload> = FormDialogProps<Payload> &
  Record<'series', RecurringExpenseDetail>;

const AMOUNT_KINDS = ['fixed', 'variable'] as const;

const AMOUNT_KIND_LABELS: Record<AmountKind, string> = {
  fixed: 'Fixed',
  variable: 'Variable'
};

const AMOUNT_KIND_HINTS: Record<AmountKind, string> = {
  fixed: 'Every bill owes this amount',
  variable: 'An estimate: correct each bill once its amount is known'
};

const END_MODES = ['never', 'date'] as const;

const END_MODE_LABELS: Record<EndMode, string> = {
  never: 'No end date',
  date: 'On a date'
};

const PREVIEWED_OCCURRENCES = 3;

const SeriesTermsFields = DescriptionFormFields.extend({
  amount: positiveMoneyField('Amount'),
  amountKind: z.enum(AMOUNT_KINDS),
  endMode: z.enum(END_MODES),
  endDate: z.string()
});

const CreateSeriesFields = SeriesTermsFields.extend({
  currency: z.string().min(1, 'Currency is required'),
  frequency: z.enum(RECURRENCE_FREQUENCIES),
  startDate: requiredDayField('Start date')
});

const EditSeriesFields = SeriesTermsFields.extend({
  effectiveFrom: requiredDayField('Apply from')
});

const StopSeriesFields = z.object({
  effectiveFrom: requiredDayField('Stop from')
});

const requireSeriesMinorUnits = requireMinorUnitsOf(['amount']);

/** The API names the amount's kind `isVariable`; the form has a choice for it. */
const seriesFieldOf =
  <Field extends string>(fields: ReadonlyArray<Field>) =>
  (path: string) =>
    path === 'isVariable' ? 'amountKind' : fieldOfPath(fields)(path);

const createSeriesFieldOf = seriesFieldOf(CreateSeriesFields.keyof().options);

const editSeriesFieldOf = seriesFieldOf(EditSeriesFields.keyof().options);

const stopSeriesFieldOf = fieldOfPath(StopSeriesFields.keyof().options);

const requireEndOf = (
  { endMode, endDate }: SeriesTerms,
  startDate: string,
  ctx: z.RefinementCtx
) => {
  if (endMode !== 'date') return;

  if (endDate === '')
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'End date is required'
    });
  else if (startDate !== '' && endDate < startDate)
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: 'End date must not be before the start date'
    });
};

const createSeriesSchemaFor = (today: string) => {
  const earliestStart = shiftCalendarDayByMonths(
    today,
    -FINANCE_LIMITS.OccurrenceHorizonMonths
  );

  return CreateSeriesFields.superRefine((series, ctx) => {
    requireSeriesMinorUnits(series, ctx);
    requireEndOf(series, series.startDate, ctx);

    if (
      earliestStart !== null &&
      series.startDate !== '' &&
      series.startDate < earliestStart
    )
      ctx.addIssue({
        code: 'custom',
        path: ['startDate'],
        message: `Start date must be within the last ${FINANCE_LIMITS.OccurrenceHorizonMonths} months`
      });
  });
};

/**
 * The API creates bills `OccurrenceHorizonMonths` ahead and refuses a change
 * from after the day following them, unless the series starts later still.
 */
const latestEffectiveFromOf = (today: string, startDate: string) => {
  const horizon = shiftCalendarDayByMonths(
    today,
    FINANCE_LIMITS.OccurrenceHorizonMonths
  );
  const dayAfter = horizon === null ? null : shiftCalendarDay(horizon, 1);

  return dayAfter === null || startDate > dayAfter ? startDate : dayAfter;
};

const requireEffectiveFromBy = (
  { effectiveFrom }: Record<'effectiveFrom', string>,
  latest: string,
  field: string,
  ctx: z.RefinementCtx
) => {
  if (effectiveFrom !== '' && effectiveFrom > latest)
    ctx.addIssue({
      code: 'custom',
      path: ['effectiveFrom'],
      message: `${field} must be on or before ${formatCalendarDay(latest) ?? latest}`
    });
};

const editSeriesSchemaFor = (
  { currency, startDate }: RecurringExpenseDetail,
  today: string
) => {
  const latest = latestEffectiveFromOf(today, startDate);

  return EditSeriesFields.superRefine((series, ctx) => {
    requireSeriesMinorUnits({ ...series, currency }, ctx);
    requireEndOf(series, startDate, ctx);
    requireEffectiveFromBy(series, latest, 'Apply from', ctx);
  });
};

const stopSeriesSchemaFor = (
  { startDate }: RecurringExpenseDetail,
  today: string
) => {
  const latest = latestEffectiveFromOf(today, startDate);

  return StopSeriesFields.superRefine((stop, ctx) => {
    requireEffectiveFromBy(stop, latest, 'Stop from', ctx);
  });
};

const endDateOf = ({ endMode, endDate }: SeriesTerms) =>
  endMode === 'date' ? endDate : null;

const createPayloadOf = ({
  amountKind,
  endMode,
  endDate,
  ...series
}: CreateSeriesDraft): CreateRecurringExpenseRequestPayload => ({
  ...series,
  isVariable: amountKind === 'variable',
  endDate: endDateOf({ amountKind, endMode, endDate })
});

const editPayloadOf = ({
  amountKind,
  endMode,
  endDate,
  ...changes
}: EditSeriesDraft): UpdateRecurringExpenseRequestPayload => ({
  ...changes,
  isVariable: amountKind === 'variable',
  endDate: endDateOf({ amountKind, endMode, endDate })
});

/** The `index`-th day of the series, counted from its start as the API does. */
export const occurrenceDayAt = (
  frequency: RecurrenceFrequency,
  startDate: string,
  index: number
) =>
  frequency === 'WEEKLY'
    ? shiftCalendarDay(startDate, index * 7)
    : shiftCalendarDayByMonths(
        startDate,
        frequency === 'MONTHLY' ? index : index * 12
      );

const listText = (items: ReadonlyArray<string>) =>
  items.length <= 1
    ? (items[0] ?? '')
    : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`;

const SeriesPreview: FC = () => {
  const { control } = useFormContext<CreateSeriesInput>();
  const [frequency, startDate, endMode, endDate] = useWatch({
    control,
    name: ['frequency', 'startDate', 'endMode', 'endDate']
  });

  const end = endMode === 'date' && endDate !== '' ? endDate : null;
  const days = Array.from({ length: PREVIEWED_OCCURRENCES }, (_, index) =>
    occurrenceDayAt(frequency, startDate, index)
  ).filter(
    (day): day is string => day !== null && (end === null || day <= end)
  );
  const shownDays = days.map((day) => formatCalendarDay(day) ?? day);
  const unit = RECURRENCE_FREQUENCY_UNITS[frequency];
  const shownEnd = end === null ? null : (formatCalendarDay(end) ?? end);

  return (
    <div
      aria-live="polite"
      className="space-y-1 rounded-md border bg-muted/40 px-3 py-2.5 text-sm"
    >
      {days.length === 0 ? (
        <p className="text-muted-foreground">
          The first bills appear here once the start date is filled in.
        </p>
      ) : (
        <>
          <p className="font-medium">
            {days.length === 1
              ? `First bill due on ${shownDays[0]}`
              : `First bills due on ${listText(shownDays)}`}
          </p>

          <p className="text-muted-foreground">
            {shownEnd === null
              ? `Then one every ${unit}, with no end date`
              : `Then one every ${unit} through ${shownEnd}`}
          </p>
        </>
      )}
    </div>
  );
};

const AmountKindChoice: FC = () => {
  const { control, register } = useFormContext<SeriesTerms>();
  const amountKind = useWatch({ control, name: 'amountKind' });

  return (
    <ChoiceField legend="Amount" hint={AMOUNT_KIND_HINTS[amountKind]}>
      <SegmentedControl className="grid grid-cols-2 sm:flex sm:w-fit">
        {AMOUNT_KINDS.map((kind) => (
          <SegmentedControlItem
            key={kind}
            value={kind}
            {...register('amountKind')}
          >
            {AMOUNT_KIND_LABELS[kind]}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </ChoiceField>
  );
};

const EndChoice: FC = () => {
  const { control, register } = useFormContext<SeriesTerms>();
  const endMode = useWatch({ control, name: 'endMode' });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChoiceField legend="Ends">
        <SegmentedControl className="grid grid-cols-2 sm:flex sm:w-fit">
          {END_MODES.map((mode) => (
            <SegmentedControlItem
              key={mode}
              value={mode}
              {...register('endMode')}
            >
              {END_MODE_LABELS[mode]}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </ChoiceField>

      {endMode === 'date' && (
        <DayField
          name="endDate"
          label="End date"
          hint="The last bill is due on or before this day"
        />
      )}
    </div>
  );
};

export const CreateSeriesDialog: FC<
  FormDialogProps<CreateRecurringExpenseRequestPayload>
> = ({ onCancel, onSubmit }) => {
  const formId = useId();
  const today = useReferenceDay();

  const methods = useForm<CreateSeriesInput, unknown, CreateSeriesDraft>({
    mode: 'onChange',
    resolver: zodResolver(createSeriesSchemaFor(today)),
    defaultValues: {
      ...EMPTY_DESCRIPTION_FORM,
      amount: '',
      currency: DEFAULT_CURRENCY,
      amountKind: 'fixed',
      frequency: 'MONTHLY',
      startDate: today,
      endMode: 'never',
      endDate: ''
    }
  });

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { isSubmitting }
  } = methods;

  const currency = useWatch({ control, name: 'currency' });

  const { isSaving, submit } = useSubmitter(
    onSubmit,
    createPayloadOf,
    (error) =>
      presentSubmitError(error, {
        setError,
        fieldOf: createSeriesFieldOf,
        fallbackMessage: 'The recurring expense could not be saved'
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
          <DialogTitle>Add a recurring expense</DialogTitle>

          <DialogDescription>
            {`Each occurrence becomes a bill, owed until you record its payment. Bills are kept up to ${FINANCE_LIMITS.OccurrenceHorizonMonths} months ahead.`}
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
              <MoneyField name="amount" label="Amount" currency={currency} />

              <CurrencyField name="currency" />

              <div className="sm:col-span-2">
                <AmountKindChoice />
              </div>

              <ChoiceField
                legend="Repeats"
                hint="Frequency and start date cannot change once the series exists"
                className="sm:col-span-2"
              >
                <SegmentedControl className="grid grid-cols-3 sm:flex sm:w-fit">
                  {RECURRENCE_FREQUENCIES.map((frequency) => (
                    <SegmentedControlItem
                      key={frequency}
                      value={frequency}
                      {...register('frequency')}
                    >
                      {RECURRENCE_FREQUENCY_LABELS[frequency]}
                    </SegmentedControlItem>
                  ))}
                </SegmentedControl>
              </ChoiceField>

              <DayField
                name="startDate"
                label="First due date"
                hint={`Within the last ${FINANCE_LIMITS.OccurrenceHorizonMonths} months, or later`}
                className="sm:col-span-2"
              />
            </div>

            <EndChoice />

            <SeriesPreview />

            <DescriptionFields />

            <FormRootError />
          </form>
        </FormProvider>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </Button>

          <SubmitButton form={formId} isPending={isSubmitting}>
            Add recurring expense
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export const EditSeriesDialog: FC<
  SeriesDialogProps<UpdateRecurringExpenseRequestPayload>
> = ({ series, onCancel, onSubmit }) => {
  const formId = useId();
  const today = useReferenceDay();

  const methods = useForm<EditSeriesInput, unknown, EditSeriesDraft>({
    mode: 'onChange',
    resolver: zodResolver(editSeriesSchemaFor(series, today)),
    defaultValues: {
      ...toDescriptionFormValues(series),
      amount: series.amount,
      amountKind: series.isVariable ? 'variable' : 'fixed',
      endMode: series.endDate === null ? 'never' : 'date',
      endDate: series.endDate ?? '',
      effectiveFrom: series.startDate > today ? series.startDate : today
    }
  });

  const {
    handleSubmit,
    setError,
    formState: { isSubmitting }
  } = methods;

  const { isSaving, submit } = useSubmitter(onSubmit, editPayloadOf, (error) =>
    presentSubmitError(error, {
      setError,
      fieldOf: editSeriesFieldOf,
      fallbackMessage: 'The recurring expense could not be saved'
    })
  );

  const repeats = `${RECURRENCE_FREQUENCY_LABELS[series.frequency]} from ${formatCalendarDay(series.startDate) ?? series.startDate}`;

  return (
    <Dialog
      open
      onOpenChange={() => {
        if (!isSaving) onCancel();
      }}
    >
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Edit recurring expense</DialogTitle>

          <DialogDescription>
            {`${repeats}, in ${series.currency}. To change how often it repeats or when it starts, stop it and add a new one.`}
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
              Changes reach the bills due from the day below on that have no
              payment and were not edited on their own. Earlier bills keep what
              they owe.
            </InfoNote>

            <div className="grid gap-4 sm:grid-cols-2">
              <DayField name="effectiveFrom" label="Apply from" />

              <MoneyField
                name="amount"
                label="Amount"
                currency={series.currency}
              />

              <div className="sm:col-span-2">
                <AmountKindChoice />
              </div>
            </div>

            <EndChoice />

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

export const StopSeriesDialog: FC<
  SeriesDialogProps<CancelRecurringExpenseRequestPayload>
> = ({ series, onCancel, onSubmit }) => {
  const formId = useId();
  const today = useReferenceDay();

  const methods = useForm<StopSeriesInput, unknown, StopSeriesDraft>({
    mode: 'onChange',
    resolver: zodResolver(stopSeriesSchemaFor(series, today)),
    defaultValues: { effectiveFrom: today }
  });

  const {
    handleSubmit,
    setError,
    formState: { isSubmitting }
  } = methods;

  const { isSaving, submit } = useSubmitter(
    onSubmit,
    (draft: StopSeriesDraft) => draft,
    (error) =>
      presentSubmitError(error, {
        setError,
        fieldOf: stopSeriesFieldOf,
        fallbackMessage: 'The recurring expense could not be stopped'
      })
  );

  return (
    <Dialog
      open
      onOpenChange={() => {
        if (!isSaving) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">{`Stop ${series.description}?`}</DialogTitle>

          <DialogDescription>
            From the day below on, bills with no payment are dropped. Earlier
            bills and partly paid ones stay owed. The series and its history are
            kept, and a stopped series cannot be resumed.
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form
            id={formId}
            noValidate
            className="grid gap-4"
            onSubmit={handleSubmit(submit)}
          >
            <DayField name="effectiveFrom" label="Stop from" />

            <FormRootError />
          </form>
        </FormProvider>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Keep it
          </Button>

          <SubmitButton
            form={formId}
            isPending={isSubmitting}
            variant="destructive"
          >
            Stop series
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

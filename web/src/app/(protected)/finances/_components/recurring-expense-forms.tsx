import { useId, useMemo, type FC } from 'react';
import {
  FormProvider,
  useForm,
  useFormContext,
  useWatch
} from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'use-intl';
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
  RECURRENCE_FREQUENCIES
} from '@/common/constants';
import { ChoiceField, FormSection } from '@/components/form-field';
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
import { useRevalidateOnLocaleChange } from '@/hooks/use-revalidate-on-locale-change';
import { useFormat, type Format } from '@/i18n/format';
import { shiftCalendarDay, shiftCalendarDayByMonths } from '@/lib/dates';
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
  PaymentDetailsFields,
  positiveMoneyFieldFor,
  requiredDayFieldFor,
  requireMinorUnitsOf,
  toDescriptionFormValues,
  useSubmitter,
  type ValidationTranslator
} from './finance-form';

type AmountKind = (typeof AMOUNT_KINDS)[number];

type EndMode = (typeof END_MODES)[number];

type SeriesTerms = Record<'amountKind', AmountKind> &
  Record<'endMode', EndMode> &
  Record<'endDate', string>;

type CreateSeriesInput = z.input<ReturnType<typeof createSeriesFieldsFor>>;

type CreateSeriesDraft = z.output<ReturnType<typeof createSeriesFieldsFor>>;

type EditSeriesInput = z.input<ReturnType<typeof editSeriesFieldsFor>>;

type EditSeriesDraft = z.output<ReturnType<typeof editSeriesFieldsFor>>;

type StopSeriesInput = z.input<ReturnType<typeof stopSeriesFieldsFor>>;

type StopSeriesDraft = z.output<ReturnType<typeof stopSeriesFieldsFor>>;

type FormDialogProps<Payload> = Record<'onCancel', VoidFunction> &
  Record<'onSubmit', (payload: Payload) => Promise<unknown>>;

type SeriesDialogProps<Payload> = FormDialogProps<Payload> &
  Record<'series', RecurringExpenseDetail>;

const AMOUNT_KINDS = ['fixed', 'variable'] as const;

const END_MODES = ['never', 'date'] as const;

const PREVIEWED_OCCURRENCES = 3;

const seriesTermsFieldsFor = (t: ValidationTranslator) =>
  descriptionFormFieldsFor(t).extend({
    amount: positiveMoneyFieldFor(t),
    amountKind: z.enum(AMOUNT_KINDS),
    endMode: z.enum(END_MODES),
    endDate: z.string()
  });

const createSeriesFieldsFor = (t: ValidationTranslator) =>
  seriesTermsFieldsFor(t).extend({
    currency: z.string().min(1, t('currency.required')),
    frequency: z.enum(RECURRENCE_FREQUENCIES),
    startDate: requiredDayFieldFor(t)
  });

const editSeriesFieldsFor = (t: ValidationTranslator) =>
  seriesTermsFieldsFor(t).extend({
    effectiveFrom: requiredDayFieldFor(t)
  });

const stopSeriesFieldsFor = (t: ValidationTranslator) =>
  z.object({
    effectiveFrom: requiredDayFieldFor(t)
  });

const SERIES_TERMS_FIELDS = [
  ...DESCRIPTION_FORM_FIELDS,
  'amount',
  'amountKind',
  'endMode',
  'endDate'
] as const satisfies ReadonlyArray<
  keyof EditSeriesInput & keyof CreateSeriesInput
>;

/** The API names the amount's kind `isVariable`; the form has a choice for it. */
const seriesFieldOf =
  <Field extends string>(fields: ReadonlyArray<Field>) =>
  (path: string) =>
    path === 'isVariable' ? 'amountKind' : fieldOfPath(fields)(path);

const createSeriesFieldOf = seriesFieldOf([
  ...SERIES_TERMS_FIELDS,
  'currency',
  'frequency',
  'startDate'
] as const satisfies ReadonlyArray<keyof CreateSeriesInput>);

const editSeriesFieldOf = seriesFieldOf([
  ...SERIES_TERMS_FIELDS,
  'effectiveFrom'
] as const satisfies ReadonlyArray<keyof EditSeriesInput>);

const stopSeriesFieldOf = fieldOfPath([
  'effectiveFrom'
] as const satisfies ReadonlyArray<keyof StopSeriesInput>);

const requireEndOf = (
  { endMode, endDate }: SeriesTerms,
  startDate: string,
  ctx: z.RefinementCtx,
  t: ValidationTranslator
) => {
  if (endMode !== 'date') return;

  if (endDate === '')
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: t('day.required')
    });
  else if (startDate !== '' && endDate < startDate)
    ctx.addIssue({
      code: 'custom',
      path: ['endDate'],
      message: t('recurring.endBeforeStart')
    });
};

const createSeriesSchemaFor = (today: string, t: ValidationTranslator) => {
  const earliestStart = shiftCalendarDayByMonths(
    today,
    -FINANCE_LIMITS.OccurrenceHorizonMonths
  );
  const requireSeriesMinorUnits = requireMinorUnitsOf(['amount'], t);

  return createSeriesFieldsFor(t).superRefine((series, ctx) => {
    requireSeriesMinorUnits(series, ctx);
    requireEndOf(series, series.startDate, ctx, t);

    if (
      earliestStart !== null &&
      series.startDate !== '' &&
      series.startDate < earliestStart
    )
      ctx.addIssue({
        code: 'custom',
        path: ['startDate'],
        message: t('recurring.startTooEarly', {
          months: FINANCE_LIMITS.OccurrenceHorizonMonths
        })
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
  ctx: z.RefinementCtx,
  t: ValidationTranslator,
  { formatCalendarDay }: Format
) => {
  if (effectiveFrom !== '' && effectiveFrom > latest)
    ctx.addIssue({
      code: 'custom',
      path: ['effectiveFrom'],
      message: t('recurring.effectiveFromTooLate', {
        day: formatCalendarDay(latest) ?? latest
      })
    });
};

const editSeriesSchemaFor = (
  { currency, startDate }: RecurringExpenseDetail,
  today: string,
  t: ValidationTranslator,
  format: Format
) => {
  const latest = latestEffectiveFromOf(today, startDate);
  const requireSeriesMinorUnits = requireMinorUnitsOf(['amount'], t);

  return editSeriesFieldsFor(t).superRefine((series, ctx) => {
    requireSeriesMinorUnits({ ...series, currency }, ctx);
    requireEndOf(series, startDate, ctx, t);
    requireEffectiveFromBy(series, latest, ctx, t, format);
  });
};

const stopSeriesSchemaFor = (
  { startDate }: RecurringExpenseDetail,
  today: string,
  t: ValidationTranslator,
  format: Format
) => {
  const latest = latestEffectiveFromOf(today, startDate);

  return stopSeriesFieldsFor(t).superRefine((stop, ctx) => {
    requireEffectiveFromBy(stop, latest, ctx, t, format);
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

const SeriesPreview: FC = () => {
  const t = useTranslations('recurring.preview');
  const tFinances = useTranslations('finances');
  const { formatCalendarDay, formatList } = useFormat();
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
  const period = tFinances(`perPeriod.${frequency}`);
  const shownEnd = end === null ? null : (formatCalendarDay(end) ?? end);

  return (
    <div
      aria-live="polite"
      className="space-y-1 rounded-lg border bg-muted/40 p-4 text-sm"
    >
      {days.length === 0 ? (
        <p className="text-muted-foreground">{t('empty')}</p>
      ) : (
        <>
          <p className="font-medium">
            {t('first', { count: days.length, days: formatList(shownDays) })}
          </p>

          <p className="text-muted-foreground">
            {shownEnd === null
              ? t('then', { period })
              : t('thenUntil', { period, day: shownEnd })}
          </p>
        </>
      )}
    </div>
  );
};

const AmountKindChoice: FC = () => {
  const t = useTranslations('recurring.form');
  const { control, register } = useFormContext<SeriesTerms>();
  const amountKind = useWatch({ control, name: 'amountKind' });

  return (
    <ChoiceField
      legend={t('amountKind')}
      hint={t(`amountKindHints.${amountKind}`)}
    >
      <SegmentedControl className="grid h-10 grid-cols-2">
        {AMOUNT_KINDS.map((kind) => (
          <SegmentedControlItem
            key={kind}
            value={kind}
            {...register('amountKind')}
          >
            {t(`amountKinds.${kind}`)}
          </SegmentedControlItem>
        ))}
      </SegmentedControl>
    </ChoiceField>
  );
};

const EndChoice: FC = () => {
  const t = useTranslations('recurring.form');
  const { control, register } = useFormContext<SeriesTerms>();
  const endMode = useWatch({ control, name: 'endMode' });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <ChoiceField legend={t('ends')}>
        <SegmentedControl className="grid h-10 grid-cols-2">
          {END_MODES.map((mode) => (
            <SegmentedControlItem
              key={mode}
              value={mode}
              {...register('endMode')}
            >
              {t(`endModes.${mode}`)}
            </SegmentedControlItem>
          ))}
        </SegmentedControl>
      </ChoiceField>

      {endMode === 'date' && (
        <DayField name="endDate" label={t('endDate')} hint={t('endDateHint')} />
      )}
    </div>
  );
};

export const CreateSeriesDialog: FC<
  FormDialogProps<CreateRecurringExpenseRequestPayload>
> = ({ onCancel, onSubmit }) => {
  const t = useTranslations('recurring.form');
  const tFinances = useTranslations('finances');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const tActions = useTranslations('common.actions');
  const formId = useId();
  const today = useReferenceDay();
  const schema = useMemo(
    () => createSeriesSchemaFor(today, tValidation),
    [today, tValidation]
  );

  const methods = useForm<CreateSeriesInput, unknown, CreateSeriesDraft>({
    mode: 'onChange',
    resolver: zodResolver(schema),
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

  useRevalidateOnLocaleChange(methods.formState.errors, methods.trigger);

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { isDirty, isSubmitting }
  } = methods;

  const currency = useWatch({ control, name: 'currency' });

  const { isSaving, submit } = useSubmitter(
    onSubmit,
    createPayloadOf,
    (error) =>
      presentSubmitError(error, {
        setError,
        fieldOf: createSeriesFieldOf,
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
          <DialogTitle>{t('addTitle')}</DialogTitle>

          <DialogDescription>
            {t('addDescription', {
              months: FINANCE_LIMITS.OccurrenceHorizonMonths
            })}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form
            id={formId}
            noValidate
            className="grid gap-6"
            onSubmit={handleSubmit(submit)}
          >
            <FormSection title={t('scheduleSection')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyField
                  name="amount"
                  currencyName="currency"
                  label={t('amount')}
                  currency={currency}
                />

                <AmountKindChoice />

                <ChoiceField legend={t('frequency')} hint={t('frequencyHint')}>
                  <SegmentedControl className="grid h-10 grid-cols-3">
                    {RECURRENCE_FREQUENCIES.map((frequency) => (
                      <SegmentedControlItem
                        key={frequency}
                        value={frequency}
                        {...register('frequency')}
                      >
                        {tFinances(`frequencies.${frequency}`)}
                      </SegmentedControlItem>
                    ))}
                  </SegmentedControl>
                </ChoiceField>

                <DayField
                  name="startDate"
                  label={t('startDate')}
                  hint={t('startDateHint', {
                    months: FINANCE_LIMITS.OccurrenceHorizonMonths
                  })}
                />
              </div>

              <EndChoice />

              <SeriesPreview />
            </FormSection>

            <DescriptionFields />

            <PaymentDetailsFields />

            <FormRootError />
          </form>
        </FormProvider>

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

export const EditSeriesDialog: FC<
  SeriesDialogProps<UpdateRecurringExpenseRequestPayload>
> = ({ series, onCancel, onSubmit }) => {
  const t = useTranslations('recurring.form');
  const tFinances = useTranslations('finances');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const tActions = useTranslations('common.actions');
  const formId = useId();
  const today = useReferenceDay();
  const format = useFormat();
  const schema = useMemo(
    () => editSeriesSchemaFor(series, today, tValidation, format),
    [series, today, tValidation, format]
  );

  const methods = useForm<EditSeriesInput, unknown, EditSeriesDraft>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: {
      ...toDescriptionFormValues(series),
      amount: series.amount,
      amountKind: series.isVariable ? 'variable' : 'fixed',
      endMode: series.endDate === null ? 'never' : 'date',
      endDate: series.endDate ?? '',
      effectiveFrom: series.startDate > today ? series.startDate : today
    }
  });

  useRevalidateOnLocaleChange(methods.formState.errors, methods.trigger);

  const {
    handleSubmit,
    setError,
    formState: { isDirty, isSubmitting }
  } = methods;

  const { isSaving, submit } = useSubmitter(onSubmit, editPayloadOf, (error) =>
    presentSubmitError(error, {
      setError,
      fieldOf: editSeriesFieldOf,
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
            {t('editDescription', {
              frequency: tFinances(`frequencies.${series.frequency}`),
              day:
                format.formatCalendarDay(series.startDate) ?? series.startDate,
              currency: series.currency
            })}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form
            id={formId}
            noValidate
            className="grid gap-6"
            onSubmit={handleSubmit(submit)}
          >
            <InfoNote>{t('editNote')}</InfoNote>

            <div className="grid gap-4 sm:grid-cols-2">
              <DayField name="effectiveFrom" label={t('effectiveFrom')} />
            </div>

            <FormSection title={t('scheduleSection')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyField
                  name="amount"
                  label={t('amount')}
                  currency={series.currency}
                />

                <AmountKindChoice />
              </div>

              <EndChoice />
            </FormSection>

            <DescriptionFields />

            <PaymentDetailsFields />

            <FormRootError />
          </form>
        </FormProvider>

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

export const StopSeriesDialog: FC<
  SeriesDialogProps<CancelRecurringExpenseRequestPayload>
> = ({ series, onCancel, onSubmit }) => {
  const t = useTranslations('recurring.stop');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const formId = useId();
  const today = useReferenceDay();
  const format = useFormat();
  const schema = useMemo(
    () => stopSeriesSchemaFor(series, today, tValidation, format),
    [series, today, tValidation, format]
  );

  const methods = useForm<StopSeriesInput, unknown, StopSeriesDraft>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: { effectiveFrom: today }
  });

  useRevalidateOnLocaleChange(methods.formState.errors, methods.trigger);

  const {
    handleSubmit,
    setError,
    formState: { isDirty, isSubmitting }
  } = methods;

  const { isSaving, submit } = useSubmitter(
    onSubmit,
    (draft: StopSeriesDraft) => draft,
    (error) =>
      presentSubmitError(error, {
        setError,
        fieldOf: stopSeriesFieldOf,
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
      <DialogContent hasUnsavedChanges={isDirty}>
        <DialogHeader>
          <DialogTitle className="wrap-anywhere">
            {t('title', { description: series.description })}
          </DialogTitle>

          <DialogDescription>{t('description')}</DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form
            id={formId}
            noValidate
            className="grid gap-4"
            onSubmit={handleSubmit(submit)}
          >
            <DayField name="effectiveFrom" label={t('effectiveFrom')} />

            <FormRootError />
          </form>
        </FormProvider>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            {t('keep')}
          </Button>

          <SubmitButton
            form={formId}
            isPending={isSubmitting}
            variant="destructive"
          >
            {t('submit')}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

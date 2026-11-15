import { useId, useMemo, type FC } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'use-intl';
import { z } from 'zod';

import type {
  CancelRecurringExpenseRequestPayload,
  CreateRecurringExpenseRequestPayload,
  RecurringExpenseDetail,
  UpdateRecurringExpenseRequestPayload
} from '@/app/api/v1/finances';
import {
  DEFAULT_CURRENCY,
  FINANCE_LIMITS,
  RECURRENCE_FREQUENCIES
} from '@/common/constants';
import { FormSection } from '@/components/form-field';
import { InfoNote } from '@/components/info-note';
import { SubmitButton } from '@/components/submit-button';
import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
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
  MoreDetailsFields,
  positiveMoneyFieldFor,
  requiredDayFieldFor,
  requireMinorUnitsOf,
  toDescriptionFormValues,
  useSubmitter,
  type ValidationTranslator
} from './finance-form';
import {
  AMOUNT_KINDS,
  AmountKindChoice,
  END_MODES,
  EndChoice,
  endDateOf,
  RecurrenceFields,
  requireEndOf,
  requireRecentStartOf
} from './recurrence-fields';

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

const createSeriesSchemaFor = (today: string, t: ValidationTranslator) => {
  const requireSeriesMinorUnits = requireMinorUnitsOf(['amount'], t);
  const requireRecentStart = requireRecentStartOf(today, t);

  return createSeriesFieldsFor(t).superRefine((series, ctx) => {
    requireSeriesMinorUnits(series, ctx);
    requireEndOf(series, series.startDate, ctx, t);
    requireRecentStart(series.startDate, 'startDate', ctx);
  });
};

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

const createPayloadOf = ({
  amountKind,
  endMode,
  endDate,
  ...series
}: CreateSeriesDraft): CreateRecurringExpenseRequestPayload => ({
  ...series,
  isVariable: amountKind === 'variable',
  endDate: endDateOf({ endMode, endDate })
});

const editPayloadOf = ({
  amountKind,
  endMode,
  endDate,
  ...changes
}: EditSeriesDraft): UpdateRecurringExpenseRequestPayload => ({
  ...changes,
  isVariable: amountKind === 'variable',
  endDate: endDateOf({ endMode, endDate })
});

export const CreateSeriesDialog: FC<
  FormDialogProps<CreateRecurringExpenseRequestPayload>
> = ({ onCancel, onSubmit }) => {
  const t = useTranslations('recurring.form');
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

                <MoneyField
                  name="amount"
                  currencyName="currency"
                  label={t('amount')}
                  currency={currency}
                />

                <DayField
                  name="startDate"
                  label={t('startDate')}
                  hint={t('startDateHint', {
                    months: FINANCE_LIMITS.OccurrenceHorizonMonths
                  })}
                />
              </div>

              <FormSection title={t('recurrenceSection')}>
                <RecurrenceFields startName="startDate" />
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

                <MoneyField
                  name="amount"
                  label={t('amount')}
                  currency={series.currency}
                />

                <DayField name="effectiveFrom" label={t('effectiveFrom')} />
              </div>

              <FormSection title={t('recurrenceSection')}>
                <div className="grid gap-4 sm:grid-cols-2">
                  <AmountKindChoice />
                </div>

                <EndChoice />
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

        <DialogBody>
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
        </DialogBody>

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

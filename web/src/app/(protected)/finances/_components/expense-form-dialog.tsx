import { useId, useMemo, useState, type FC } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'use-intl';
import { z } from 'zod';

import type {
  CreateExpenseRequestPayload,
  CreateRecurringExpenseRequestPayload,
  Expense,
  UpdateExpenseRequestPayload
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
import {
  useCreateExpense,
  useCreateRecurringExpense,
  useReferenceDay
} from '@/hooks/use-finances';
import { useRevalidateOnLocaleChange } from '@/hooks/use-revalidate-on-locale-change';
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
  type ValidationTranslator
} from './finance-form';
import {
  AMOUNT_KINDS,
  END_MODES,
  endDateOf,
  RecurrenceFields,
  requireEndOf,
  requireRecentStartOf
} from './recurrence-fields';

export type ExpenseFormTarget =
  | Record<'kind', 'create'>
  | (Record<'kind', 'edit'> & Record<'expense', Expense>);

export type ExpenseDraft = z.output<ReturnType<typeof expenseFormSchemaFor>>;

type ExpenseFormInput = z.input<ReturnType<typeof expenseFormSchemaFor>>;

/** What a new bill's form adds: the bill, or the recurring expense whose first bill it is. */
export type NewBill =
  | (Record<'kind', 'bill'> & Record<'bill', CreateExpenseRequestPayload>)
  | (Record<'kind', 'series'> &
      Record<'series', CreateRecurringExpenseRequestPayload>);

type ExpenseFormDialogProps = Record<'target', ExpenseFormTarget> &
  Record<'onCancel', VoidFunction> &
  Record<'onSubmit', (draft: ExpenseDraft) => Promise<unknown>>;

const expenseFormFieldsFor = (t: ValidationTranslator) =>
  descriptionFormFieldsFor(t).extend({
    amount: positiveMoneyFieldFor(t),
    currency: z.string().min(1, t('currency.required')),
    dueDate: requiredDayFieldFor(t),
    repeats: z.boolean(),
    frequency: z.enum(RECURRENCE_FREQUENCIES),
    amountKind: z.enum(AMOUNT_KINDS),
    endMode: z.enum(END_MODES),
    endDate: z.string()
  });

/** The recurrence is checked only while the bill repeats: hidden, it keeps what was chosen and asks nothing of it. */
export const expenseFormSchemaFor = (
  today: string,
  t: ValidationTranslator
) => {
  const requireBillMinorUnits = requireMinorUnitsOf(['amount'], t);
  const requireRecentStart = requireRecentStartOf(today, t);

  return expenseFormFieldsFor(t).superRefine((bill, ctx) => {
    requireBillMinorUnits(bill, ctx);

    if (!bill.repeats) return;

    requireEndOf(bill, bill.dueDate, ctx, t);
    requireRecentStart(bill.dueDate, 'dueDate', ctx);
  });
};

const EXPENSE_FORM_FIELDS = [
  ...DESCRIPTION_FORM_FIELDS,
  'amount',
  'currency',
  'dueDate',
  'frequency',
  'amountKind',
  'endDate'
] as const satisfies ReadonlyArray<keyof ExpenseFormInput>;

/** A recurring expense starts on the bill's due date, and the API names its amount's kind `isVariable`. */
const expenseFieldOf = (path: string) => {
  if (path === 'startDate') return 'dueDate';
  if (path === 'isVariable') return 'amountKind';

  return fieldOfPath(EXPENSE_FORM_FIELDS)(path);
};

/** A bill's currency is fixed once it exists, so an edit sends everything else. */
export const expenseChangesOf = ({
  amount,
  dueDate,
  description,
  category,
  subcategory,
  paymentMethod,
  account,
  notes
}: ExpenseDraft): UpdateExpenseRequestPayload => ({
  amount,
  dueDate,
  description,
  category,
  subcategory,
  paymentMethod,
  account,
  notes
});

export const newBillOf = ({
  repeats,
  frequency,
  amountKind,
  endMode,
  endDate,
  dueDate,
  ...bill
}: ExpenseDraft): NewBill =>
  repeats
    ? {
        kind: 'series',
        series: {
          ...bill,
          frequency,
          startDate: dueDate,
          isVariable: amountKind === 'variable',
          endDate: endDateOf({ endMode, endDate })
        }
      }
    : { kind: 'bill', bill: { ...bill, dueDate } };

const NO_RECURRENCE = {
  repeats: false,
  frequency: 'MONTHLY',
  amountKind: 'fixed',
  endMode: 'never',
  endDate: ''
} as const satisfies Partial<ExpenseFormInput>;

const defaultValuesOf = (
  target: ExpenseFormTarget,
  today: string
): ExpenseFormInput =>
  target.kind === 'create'
    ? {
        ...EMPTY_DESCRIPTION_FORM,
        ...NO_RECURRENCE,
        amount: '',
        currency: DEFAULT_CURRENCY,
        dueDate: today
      }
    : {
        ...toDescriptionFormValues(target.expense),
        ...NO_RECURRENCE,
        amount: target.expense.amount,
        currency: target.expense.currency,
        dueDate: target.expense.dueDate
      };

/**
 * A new bill can repeat: the switch below its essential fields turns it into a
 * recurring expense whose first bill is due on its due date, and shows how it
 * repeats in place. Turning it off again keeps what was chosen.
 */
export const ExpenseFormDialog: FC<ExpenseFormDialogProps> = ({
  target,
  onCancel,
  onSubmit
}) => {
  const t = useTranslations('bills.form');
  const tRecurring = useTranslations('recurring.form');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const tActions = useTranslations('common.actions');
  const formId = useId();
  const repeatsHintId = useId();
  const today = useReferenceDay();
  const [isSaving, setIsSaving] = useState(false);
  const schema = useMemo(
    () => expenseFormSchemaFor(today, tValidation),
    [today, tValidation]
  );

  const methods = useForm<ExpenseFormInput, unknown, ExpenseDraft>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: defaultValuesOf(target, today)
  });

  useRevalidateOnLocaleChange(methods.formState.errors, methods.trigger);

  const {
    control,
    register,
    handleSubmit,
    setError,
    trigger,
    formState: { isDirty, isSubmitting }
  } = methods;

  const [currency, repeats] = useWatch({
    control,
    name: ['currency', 'repeats']
  });
  const originKind =
    target.kind === 'edit' && target.expense.kind !== 'ONE_TIME'
      ? target.expense.kind
      : null;

  const submitDraft = async (draft: ExpenseDraft) => {
    setIsSaving(true);

    try {
      await onSubmit(draft);
    } catch (error) {
      presentSubmitError(error, {
        setError,
        fieldOf: expenseFieldOf,
        t: tErrors,
        fallbackMessage: repeats ? tRecurring('failed') : t('failed')
      });
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
      <DialogContent className="sm:max-w-xl" hasUnsavedChanges={isDirty}>
        <DialogHeader>
          <DialogTitle>
            {target.kind === 'create' ? t('addTitle') : t('editTitle')}
          </DialogTitle>

          <DialogDescription>
            {target.kind === 'create'
              ? t('addDescription')
              : t('editDescription', { currency: target.expense.currency })}
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <FormProvider {...methods}>
            <form
              id={formId}
              noValidate
              className="grid gap-6"
              onSubmit={handleSubmit(submitDraft)}
            >
              {originKind !== null && (
                <InfoNote>{t(`originHints.${originKind}`)}</InfoNote>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <DescriptionFields />

                <MoneyField
                  name="amount"
                  label={t('amount')}
                  currency={currency}
                  currencyName={
                    target.kind === 'create' ? 'currency' : undefined
                  }
                />

                <DayField
                  name="dueDate"
                  label={repeats ? tRecurring('startDate') : t('dueDate')}
                  hint={
                    repeats
                      ? tRecurring('startDateHint', {
                          months: FINANCE_LIMITS.OccurrenceHorizonMonths
                        })
                      : undefined
                  }
                />
              </div>

              {target.kind === 'create' && (
                <div className="grid gap-4">
                  <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm hover:bg-muted/50 has-checked:bg-muted/40">
                    <input
                      type="checkbox"
                      aria-describedby={repeatsHintId}
                      className="mt-0.5 size-4 shrink-0 accent-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
                      {...register('repeats', {
                        onChange: () => void trigger(['dueDate', 'endDate'])
                      })}
                    />

                    <span className="grid gap-0.5">
                      <span className="font-medium">{t('repeats')}</span>

                      <span
                        id={repeatsHintId}
                        className="text-muted-foreground"
                      >
                        {t('repeatsHint')}
                      </span>
                    </span>
                  </label>

                  {repeats && (
                    <FormSection title={tRecurring('recurrenceSection')}>
                      <RecurrenceFields startName="dueDate" />
                    </FormSection>
                  )}
                </div>
              )}

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
            {target.kind === 'edit'
              ? tActions('saveChanges')
              : repeats
                ? tRecurring('submitAdd')
                : t('submitAdd')}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

/** Adds a bill, or the recurring expense the form was asked to repeat it as. */
export const AddBillDialog: FC<Record<'onClose', VoidFunction>> = ({
  onClose
}) => {
  const { mutateAsync: createExpense } = useCreateExpense();
  const { mutateAsync: createSeries } = useCreateRecurringExpense();

  return (
    <ExpenseFormDialog
      target={{ kind: 'create' }}
      onCancel={onClose}
      onSubmit={async (draft) => {
        const newBill = newBillOf(draft);

        await (newBill.kind === 'series'
          ? createSeries(newBill.series)
          : createExpense(newBill.bill));
        onClose();
      }}
    />
  );
};

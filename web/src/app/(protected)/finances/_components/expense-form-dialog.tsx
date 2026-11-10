import { useId, useMemo, useState, type FC } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'use-intl';
import { z } from 'zod';

import type {
  Expense,
  UpdateExpenseRequestPayload
} from '@/app/api/v1/finances';
import { DEFAULT_CURRENCY } from '@/common/constants';
import { FormSection } from '@/components/form-field';
import { InfoNote } from '@/components/info-note';
import { SubmitButton } from '@/components/submit-button';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui';
import { useReferenceDay } from '@/hooks/use-finances';
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
  PaymentDetailsFields,
  positiveMoneyFieldFor,
  requiredDayFieldFor,
  requireMinorUnitsOf,
  toDescriptionFormValues,
  type ValidationTranslator
} from './finance-form';

export type ExpenseFormTarget =
  | Record<'kind', 'create'>
  | (Record<'kind', 'edit'> & Record<'expense', Expense>);

export type ExpenseDraft = z.output<ReturnType<typeof expenseFormSchemaFor>>;

type ExpenseFormInput = z.input<ReturnType<typeof expenseFormSchemaFor>>;

type ExpenseFormDialogProps = Record<'target', ExpenseFormTarget> &
  Record<'onCancel', VoidFunction> &
  Record<'onSubmit', (draft: ExpenseDraft) => Promise<unknown>>;

const expenseFormSchemaFor = (t: ValidationTranslator) =>
  descriptionFormFieldsFor(t)
    .extend({
      amount: positiveMoneyFieldFor(t),
      currency: z.string().min(1, t('currency.required')),
      dueDate: requiredDayFieldFor(t)
    })
    .superRefine(requireMinorUnitsOf(['amount'], t));

const EXPENSE_FORM_FIELDS = [
  ...DESCRIPTION_FORM_FIELDS,
  'amount',
  'currency',
  'dueDate'
] as const satisfies ReadonlyArray<keyof ExpenseFormInput>;

const expenseFieldOf = fieldOfPath(EXPENSE_FORM_FIELDS);

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

const defaultValuesOf = (
  target: ExpenseFormTarget,
  today: string
): ExpenseFormInput =>
  target.kind === 'create'
    ? {
        ...EMPTY_DESCRIPTION_FORM,
        amount: '',
        currency: DEFAULT_CURRENCY,
        dueDate: today
      }
    : {
        ...toDescriptionFormValues(target.expense),
        amount: target.expense.amount,
        currency: target.expense.currency,
        dueDate: target.expense.dueDate
      };

export const ExpenseFormDialog: FC<ExpenseFormDialogProps> = ({
  target,
  onCancel,
  onSubmit
}) => {
  const t = useTranslations('bills.form');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const tActions = useTranslations('common.actions');
  const formId = useId();
  const today = useReferenceDay();
  const [isSaving, setIsSaving] = useState(false);
  const schema = useMemo(
    () => expenseFormSchemaFor(tValidation),
    [tValidation]
  );

  const methods = useForm<ExpenseFormInput, unknown, ExpenseDraft>({
    mode: 'onChange',
    resolver: zodResolver(schema),
    defaultValues: defaultValuesOf(target, today)
  });

  useRevalidateOnLocaleChange(methods.formState.errors, methods.trigger);

  const {
    control,
    handleSubmit,
    setError,
    formState: { isDirty, isSubmitting }
  } = methods;

  const currency = useWatch({ control, name: 'currency' });
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
        fallbackMessage: t('failed')
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

            <FormSection title={t('amountSection')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyField
                  name="amount"
                  label={t('amount')}
                  currency={currency}
                  currencyName={
                    target.kind === 'create' ? 'currency' : undefined
                  }
                />

                <DayField name="dueDate" label={t('dueDate')} />
              </div>
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
            {target.kind === 'create'
              ? t('submitAdd')
              : tActions('saveChanges')}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

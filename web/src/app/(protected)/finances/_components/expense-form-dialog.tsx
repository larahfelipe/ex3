import { useId, useState, type FC } from 'react';
import { FormProvider, useForm, useWatch } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type {
  Expense,
  UpdateExpenseRequestPayload
} from '@/app/api/v1/finances';
import { DEFAULT_CURRENCY } from '@/common/constants';
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
  toDescriptionFormValues
} from './finance-form';

export type ExpenseFormTarget =
  | Record<'kind', 'create'>
  | (Record<'kind', 'edit'> & Record<'expense', Expense>);

export type ExpenseDraft = z.output<typeof ExpenseFormSchema>;

type ExpenseFormInput = z.input<typeof ExpenseFormSchema>;

type ExpenseFormDialogProps = Record<'target', ExpenseFormTarget> &
  Record<'onCancel', VoidFunction> &
  Record<'onSubmit', (draft: ExpenseDraft) => Promise<unknown>>;

const SUBMIT_FAILURE_MESSAGE = 'The bill could not be saved';

const ExpenseFormFields = DescriptionFormFields.extend({
  amount: positiveMoneyField('Amount'),
  currency: z.string().min(1, 'Currency is required'),
  dueDate: requiredDayField('Due date')
});

const ExpenseFormSchema = ExpenseFormFields.superRefine(
  requireMinorUnitsOf(['amount'])
);

const expenseFieldOf = fieldOfPath(ExpenseFormFields.keyof().options);

const ORIGIN_HINTS: Partial<Record<Expense['kind'], string>> = {
  INSTALLMENT:
    'Changes apply to this installment only. To change what is left of the plan, reschedule it from the installments page.',
  RECURRING:
    'Changes apply to this occurrence only, and later edits to the series leave it as it is.'
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
  const formId = useId();
  const today = useReferenceDay();
  const [isSaving, setIsSaving] = useState(false);

  const methods = useForm<ExpenseFormInput, unknown, ExpenseDraft>({
    mode: 'onChange',
    resolver: zodResolver(ExpenseFormSchema),
    defaultValues: defaultValuesOf(target, today)
  });

  const {
    control,
    handleSubmit,
    setError,
    formState: { isSubmitting }
  } = methods;

  const currency = useWatch({ control, name: 'currency' });
  const originHint =
    target.kind === 'edit' ? ORIGIN_HINTS[target.expense.kind] : undefined;

  const submitDraft = async (draft: ExpenseDraft) => {
    setIsSaving(true);

    try {
      await onSubmit(draft);
    } catch (error) {
      presentSubmitError(error, {
        setError,
        fieldOf: expenseFieldOf,
        fallbackMessage: SUBMIT_FAILURE_MESSAGE
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
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {target.kind === 'create' ? 'Add a bill' : 'Edit bill'}
          </DialogTitle>

          <DialogDescription>
            {target.kind === 'create'
              ? 'A bill is owed until you record its payment.'
              : `Amounts in ${target.expense.currency}.`}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form
            id={formId}
            noValidate
            className="grid gap-4"
            onSubmit={handleSubmit(submitDraft)}
          >
            {originHint !== undefined && <InfoNote>{originHint}</InfoNote>}

            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyField name="amount" label="Amount" currency={currency} />

              <CurrencyField name="currency" isFixed={target.kind === 'edit'} />

              <DayField
                name="dueDate"
                label="Due date"
                className="sm:col-span-2"
              />
            </div>

            <DescriptionFields />

            <FormRootError />
          </form>
        </FormProvider>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </Button>

          <SubmitButton form={formId} isPending={isSubmitting}>
            {target.kind === 'create' ? 'Add bill' : 'Save changes'}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

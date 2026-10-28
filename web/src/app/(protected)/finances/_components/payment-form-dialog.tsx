import { useId, useState, type FC } from 'react';
import { FormProvider, useController, useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type {
  Expense,
  ExpensePayment,
  PaymentEntryPayload
} from '@/app/api/v1/finances';
import {
  FINANCE_LIMITS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS
} from '@/common/constants';
import { formatMoney } from '@/common/utils';
import { FormField } from '@/components/form-field';
import { SubmitButton } from '@/components/submit-button';
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui';
import { useReferenceDay } from '@/hooks/use-finances';
import { daysBetween } from '@/lib/dates';
import {
  DECIMAL_COLUMN,
  isNonzeroDecimal,
  isStorableDecimal,
  unitsOf
} from '@/lib/decimal';
import { presentSubmitError } from '@/lib/submit-error';

import {
  DayField,
  fieldOfPath,
  FormRootError,
  MoneyField,
  NO_PAYMENT_METHOD,
  optionalMoneyField,
  optionalTextField,
  requiredDayField,
  requireMinorUnitsOf,
  TEXTAREA_CLASS,
  triggerPropsOf
} from './finance-form';

export type PaymentFormTarget =
  | (Record<'kind', 'record'> & Record<'expense', Expense>)
  | (Record<'kind', 'correct'> &
      Record<'expense', Expense> &
      Record<'payment', ExpensePayment>);

type PaymentFormInput = z.input<typeof PaymentFormFields>;

type PaymentFormDialogProps = Record<'target', PaymentFormTarget> &
  Record<'onCancel', VoidFunction> &
  Record<'onSubmit', (payment: PaymentEntryPayload) => Promise<unknown>>;

const SUBMIT_FAILURE_MESSAGE = 'The payment could not be saved';

const PaymentFormFields = z.object({
  amount: optionalMoneyField('Amount paid'),
  discount: optionalMoneyField('Discount'),
  fees: optionalMoneyField('Interest and fees'),
  paidOn: requiredDayField('Payment date'),
  method: z
    .union([z.enum(PAYMENT_METHODS), z.literal(NO_PAYMENT_METHOD)])
    .transform((method) => (method === NO_PAYMENT_METHOD ? null : method)),
  notes: optionalTextField('Notes', FINANCE_LIMITS.NotesMaxLength)
});

const paymentFieldOf = fieldOfPath(PaymentFormFields.keyof().options);

/** Exact for any storable amount; anything else has already failed its own field. */
const unitsOfAmount = (value: string) =>
  isStorableDecimal(value) ? unitsOf(value, DECIMAL_COLUMN.SCALE) : 0n;

/** What the payment may settle: the outstanding amount, plus what the payment being corrected settles. */
const settleableAmountOf = (target: PaymentFormTarget) => {
  const outstanding = unitsOfAmount(target.expense.outstandingAmount);

  if (target.kind === 'record') return outstanding;

  const { amount, discount } = target.payment;

  return outstanding + unitsOfAmount(amount) + unitsOfAmount(discount);
};

const requirePaymentMinorUnits = requireMinorUnitsOf([
  'amount',
  'discount',
  'fees'
]);

const paymentSchemaFor = (target: PaymentFormTarget, today: string) =>
  PaymentFormFields.superRefine((payment, ctx) => {
    requirePaymentMinorUnits(
      { ...payment, currency: target.expense.currency },
      ctx
    );

    const { amount, discount, paidOn } = payment;

    if (!isNonzeroDecimal(amount) && !isNonzeroDecimal(discount))
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message: 'Enter the amount paid, a discount, or both'
      });
    else if (
      unitsOfAmount(amount) + unitsOfAmount(discount) >
      settleableAmountOf(target)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message:
          'The amount paid and the discount settle more than the bill still owes'
      });

    const daysAhead = daysBetween(today, paidOn);

    if (daysAhead !== null && daysAhead > 0)
      ctx.addIssue({
        code: 'custom',
        path: ['paidOn'],
        message: 'Payment date cannot be in the future'
      });
  });

const defaultValuesOf = (
  target: PaymentFormTarget,
  today: string
): PaymentFormInput => {
  if (target.kind === 'record')
    return {
      amount: target.expense.outstandingAmount,
      discount: '',
      fees: '',
      paidOn: today,
      method: target.expense.paymentMethod ?? NO_PAYMENT_METHOD,
      notes: ''
    };

  const { amount, discount, fees, paidOn, method, notes } = target.payment;

  return {
    amount,
    discount: isNonzeroDecimal(discount) ? discount : '',
    fees: isNonzeroDecimal(fees) ? fees : '',
    paidOn,
    method: method ?? NO_PAYMENT_METHOD,
    notes: notes ?? ''
  };
};

export const PaymentFormDialog: FC<PaymentFormDialogProps> = ({
  target,
  onCancel,
  onSubmit
}) => {
  const formId = useId();
  const today = useReferenceDay();
  const [isSaving, setIsSaving] = useState(false);
  const { expense } = target;
  const { currency } = expense;

  const methods = useForm<PaymentFormInput, unknown, PaymentEntryPayload>({
    mode: 'onChange',
    resolver: zodResolver(paymentSchemaFor(target, today)),
    defaultValues: defaultValuesOf(target, today)
  });

  const {
    control,
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = methods;

  const { field: methodField } = useController({ name: 'method', control });

  const submitPayment = async (payment: PaymentEntryPayload) => {
    setIsSaving(true);

    try {
      await onSubmit(payment);
    } catch (error) {
      presentSubmitError(error, {
        setError,
        fieldOf: paymentFieldOf,
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
          <DialogTitle className="wrap-anywhere">
            {target.kind === 'record'
              ? `Pay ${expense.description}`
              : `Correct payment for ${expense.description}`}
          </DialogTitle>

          <DialogDescription>
            {`${formatMoney(expense.outstandingAmount, currency)} outstanding of ${formatMoney(expense.amount, currency)}. A partial payment leaves the rest owed.`}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form
            id={formId}
            noValidate
            className="grid gap-4 sm:grid-cols-2"
            onSubmit={handleSubmit(submitPayment)}
          >
            <MoneyField name="amount" label="Amount paid" currency={currency} />

            <DayField
              name="paidOn"
              label="Payment date"
              hint="The day the money left, today at the latest"
            />

            <MoneyField
              isOptional
              name="discount"
              label="Discount"
              currency={currency}
              hint="Settles part of the bill without being paid"
            />

            <MoneyField
              isOptional
              name="fees"
              label="Interest and fees"
              currency={currency}
              hint="Paid on top: they never settle the bill"
            />

            <FormField
              isOptional
              label="Payment method"
              error={errors.method?.message}
            >
              {(fieldControl) => (
                <Select
                  name={methodField.name}
                  value={methodField.value}
                  onValueChange={methodField.onChange}
                >
                  <SelectTrigger
                    {...triggerPropsOf(fieldControl)}
                    ref={methodField.ref}
                    onBlur={methodField.onBlur}
                  >
                    <SelectValue />
                  </SelectTrigger>

                  <SelectContent>
                    <SelectItem value={NO_PAYMENT_METHOD}>
                      Not specified
                    </SelectItem>

                    {PAYMENT_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {PAYMENT_METHOD_LABELS[method]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </FormField>

            <FormField
              isOptional
              label="Notes"
              error={errors.notes?.message}
              className="sm:col-span-2"
            >
              {(fieldControl) => (
                <textarea
                  {...fieldControl}
                  rows={2}
                  maxLength={FINANCE_LIMITS.NotesMaxLength}
                  className={TEXTAREA_CLASS}
                  {...register('notes')}
                />
              )}
            </FormField>

            <div className="sm:col-span-2">
              <FormRootError />
            </div>
          </form>
        </FormProvider>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            Cancel
          </Button>

          <SubmitButton form={formId} isPending={isSubmitting}>
            {target.kind === 'record' ? 'Record payment' : 'Save correction'}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

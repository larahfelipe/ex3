import { useId, useState, type FC } from 'react';
import {
  FormProvider,
  useController,
  useForm,
  useFormContext,
  useWatch
} from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'use-intl';
import { z } from 'zod';

import type {
  Expense,
  ExpensePayment,
  PaymentEntryPayload
} from '@/app/api/v1/finances';
import { FINANCE_LIMITS, PAYMENT_METHODS } from '@/common/constants';
import {
  DeferredSection,
  FormField,
  FormSection
} from '@/components/form-field';
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
import { useRevalidateOnLocaleChange } from '@/hooks/use-revalidate-on-locale-change';
import { useFormat } from '@/i18n/format';
import type { Translator } from '@/i18n/translator';
import { daysBetween } from '@/lib/dates';
import {
  DECIMAL_COLUMN,
  decimalOfUnits,
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
  optionalMoneyFieldFor,
  optionalTextFieldFor,
  requiredDayFieldFor,
  requireMinorUnitsOf,
  TEXTAREA_CLASS,
  triggerPropsOf,
  type ValidationTranslator
} from './finance-form';

export type PaymentFormTarget =
  | (Record<'kind', 'record'> & Record<'expense', Expense>)
  | (Record<'kind', 'correct'> &
      Record<'expense', Expense> &
      Record<'payment', ExpensePayment>);

type PaymentFormInput = z.input<ReturnType<typeof paymentFormFieldsFor>>;

type PaymentFormDialogProps = Record<'target', PaymentFormTarget> &
  Record<'onCancel', VoidFunction> &
  Record<'onSubmit', (payment: PaymentEntryPayload) => Promise<unknown>>;

const paymentFormFieldsFor = (t: ValidationTranslator) =>
  z.object({
    amount: optionalMoneyFieldFor(t),
    discount: optionalMoneyFieldFor(t),
    fees: optionalMoneyFieldFor(t),
    paidOn: requiredDayFieldFor(t),
    method: z
      .union([z.enum(PAYMENT_METHODS), z.literal(NO_PAYMENT_METHOD)])
      .transform((method) => (method === NO_PAYMENT_METHOD ? null : method)),
    notes: optionalTextFieldFor(t, FINANCE_LIMITS.NotesMaxLength)
  });

const PAYMENT_FORM_FIELDS = [
  'amount',
  'discount',
  'fees',
  'paidOn',
  'method',
  'notes'
] as const satisfies ReadonlyArray<keyof PaymentFormInput>;

const paymentFieldOf = fieldOfPath(PAYMENT_FORM_FIELDS);

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

const paymentSchemaFor = (
  target: PaymentFormTarget,
  today: string,
  t: ValidationTranslator,
  tIssues: Translator<'bills.paymentForm.issues'>
) =>
  paymentFormFieldsFor(t).superRefine((payment, ctx) => {
    requireMinorUnitsOf(['amount', 'discount', 'fees'], t)(
      { ...payment, currency: target.expense.currency },
      ctx
    );

    const { amount, discount, paidOn } = payment;

    if (!isNonzeroDecimal(amount) && !isNonzeroDecimal(discount))
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message: tIssues('empty')
      });
    else if (
      unitsOfAmount(amount) + unitsOfAmount(discount) >
      settleableAmountOf(target)
    )
      ctx.addIssue({
        code: 'custom',
        path: ['amount'],
        message: tIssues('exceeds')
      });

    const daysAhead = daysBetween(today, paidOn);

    if (daysAhead !== null && daysAhead > 0)
      ctx.addIssue({
        code: 'custom',
        path: ['paidOn'],
        message: tIssues('future')
      });
  });

/** What the bill still owes once the payment is saved, kept in step with the amounts as typed. */
const SettlementNote: FC<Record<'target', PaymentFormTarget>> = ({
  target
}) => {
  const t = useTranslations('bills.paymentForm');
  const { formatMoney } = useFormat();
  const { control } = useFormContext<PaymentFormInput>();
  const [amount, discount] = useWatch({
    control,
    name: ['amount', 'discount']
  });
  const left =
    settleableAmountOf(target) -
    unitsOfAmount(amount) -
    unitsOfAmount(discount);

  const text =
    left === 0n
      ? t('settlesInFull')
      : left > 0n
        ? t('leaves', {
            amount: formatMoney(
              decimalOfUnits(left, DECIMAL_COLUMN.SCALE),
              target.expense.currency
            )
          })
        : t('settlesMore');

  return (
    <p
      aria-live="polite"
      className="rounded-lg border bg-muted/40 px-4 py-3 text-sm font-medium tabular-nums"
    >
      {text}
    </p>
  );
};

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
  const t = useTranslations('bills.paymentForm');
  const tValidation = useTranslations('validation');
  const tIssues = useTranslations('bills.paymentForm.issues');
  const tFinances = useTranslations('finances');
  const tErrors = useTranslations('errors');
  const tActions = useTranslations('common.actions');
  const { formatMoney } = useFormat();
  const formId = useId();
  const today = useReferenceDay();
  const [isSaving, setIsSaving] = useState(false);
  const { expense } = target;
  const { currency } = expense;
  const defaultValues = defaultValuesOf(target, today);

  const methods = useForm<PaymentFormInput, unknown, PaymentEntryPayload>({
    mode: 'onChange',
    resolver: zodResolver(
      paymentSchemaFor(target, today, tValidation, tIssues)
    ),
    defaultValues
  });

  useRevalidateOnLocaleChange(methods.formState.errors, methods.trigger);

  const {
    control,
    register,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors, isDirty, isSubmitting }
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
          <DialogTitle className="wrap-anywhere">
            {target.kind === 'record'
              ? t('payTitle', { description: expense.description })
              : t('correctTitle', { description: expense.description })}
          </DialogTitle>

          <DialogDescription>
            {t('description', {
              outstanding: formatMoney(expense.outstandingAmount, currency),
              amount: formatMoney(expense.amount, currency)
            })}
          </DialogDescription>
        </DialogHeader>

        <FormProvider {...methods}>
          <form
            id={formId}
            noValidate
            className="grid gap-6"
            onSubmit={handleSubmit(submitPayment)}
          >
            <FormSection title={t('section')}>
              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyField
                  name="amount"
                  label={t('amount')}
                  currency={currency}
                />

                <DayField
                  name="paidOn"
                  label={t('paidOn')}
                  hint={t('paidOnHint')}
                />

                <MoneyField
                  isOptional
                  name="discount"
                  label={t('discount')}
                  currency={currency}
                  hint={t('discountHint')}
                />

                <MoneyField
                  isOptional
                  name="fees"
                  label={t('fees')}
                  currency={currency}
                  hint={t('feesHint')}
                />
              </div>

              <SettlementNote target={target} />
            </FormSection>

            <DeferredSection
              title={t('detailsSection')}
              revealLabel={t('addDetails')}
              isInitiallyRevealed={
                defaultValues.method !== NO_PAYMENT_METHOD ||
                defaultValues.notes !== ''
              }
              hasError={
                errors.method !== undefined || errors.notes !== undefined
              }
              onReveal={() => setFocus('method')}
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  isOptional
                  label={t('method')}
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
                          {tFinances('form.noPaymentMethod')}
                        </SelectItem>

                        {PAYMENT_METHODS.map((method) => (
                          <SelectItem key={method} value={method}>
                            {tFinances(`paymentMethods.${method}`)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </FormField>

                <FormField
                  isOptional
                  label={t('notes')}
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
              </div>
            </DeferredSection>

            <FormRootError />
          </form>
        </FormProvider>

        <DialogFooter>
          <Button variant="outline" disabled={isSubmitting} onClick={onCancel}>
            {tActions('cancel')}
          </Button>

          <SubmitButton form={formId} isPending={isSubmitting}>
            {target.kind === 'record' ? t('submitRecord') : t('submitCorrect')}
          </SubmitButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

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
import { FormField, OptionalFields } from '@/components/form-field';
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TEXTAREA_CLASS
} from '@/components/ui';
import { useReferenceDay } from '@/hooks/use-finances';
import { useRevalidateOnLocaleChange } from '@/hooks/use-revalidate-on-locale-change';
import { useFormat } from '@/i18n/format';
import { srOnly } from '@/i18n/rich-text';
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

const PAYMENT_DETAILS = ['discount', 'fees', 'method', 'notes'] as const;

type PaymentDetail = (typeof PAYMENT_DETAILS)[number];

const EMPTY_PAYMENT_DETAILS = {
  discount: '',
  fees: '',
  method: NO_PAYMENT_METHOD,
  notes: ''
} as const satisfies Record<PaymentDetail, string>;

const unitsOfAmount = (value: string) =>
  isStorableDecimal(value) ? unitsOf(value, DECIMAL_COLUMN.SCALE) : 0n;

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

export const PaidOnShortcuts: FC<Record<'dueDate' | 'today', string>> = ({
  dueDate,
  today
}) => {
  const t = useTranslations('bills.paymentForm');
  const { formatCalendarDay } = useFormat();
  const { control, setValue } = useFormContext<PaymentFormInput>();
  const paidOn = useWatch({ control, name: 'paidOn' });
  const shortcuts = [
    { day: today, label: t('paidToday') },
    ...(dueDate < today
      ? [
          {
            day: dueDate,
            label: t('paidOnDueDate', {
              day: formatCalendarDay(dueDate) ?? dueDate
            })
          }
        ]
      : [])
  ];

  return (
    <div
      role="group"
      aria-label={t('paidOnShortcuts')}
      className="flex flex-wrap gap-2"
    >
      {shortcuts.map(({ day, label }) => (
        <Button
          key={day}
          type="button"
          variant="outline"
          size="xs"
          aria-pressed={paidOn === day}
          className="aria-pressed:border-primary aria-pressed:bg-primary/10"
          onClick={() =>
            setValue('paidOn', day, {
              shouldDirty: true,
              shouldTouch: true,
              shouldValidate: true
            })
          }
        >
          {label}
        </Button>
      ))}
    </div>
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

  const methods = useForm<PaymentFormInput, unknown, PaymentEntryPayload>({
    mode: 'onChange',
    resolver: zodResolver(
      paymentSchemaFor(target, today, tValidation, tIssues)
    ),
    defaultValues: defaultValuesOf(target, today)
  });

  useRevalidateOnLocaleChange(methods.formState.errors, methods.trigger);

  const {
    control,
    register,
    getValues,
    handleSubmit,
    setError,
    setFocus,
    setValue,
    trigger,
    formState: { errors, isDirty, isSubmitting }
  } = methods;

  const { field: methodField } = useController({ name: 'method', control });

  const details = useOptionalDetails({
    details: PAYMENT_DETAILS,
    initiallyShown: () =>
      PAYMENT_DETAILS.filter(
        (detail) => getValues(detail) !== EMPTY_PAYMENT_DETAILS[detail]
      ),
    required: PAYMENT_DETAILS.filter((detail) => errors[detail] !== undefined),
    focus: setFocus,
    clear: (detail) => {
      setValue(detail, EMPTY_PAYMENT_DETAILS[detail], { shouldDirty: true });
      void trigger(detail === 'discount' ? ['discount', 'amount'] : detail);
    }
  });

  const removeDetailButton = (detail: PaymentDetail) => (
    <RemoveDetailButton onClick={() => details.remove(detail)}>
      {t.rich(`removeDetail.${detail}`, { hidden: srOnly })}
    </RemoveDetailButton>
  );

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

        <DialogBody>
          <FormProvider {...methods}>
            <form
              id={formId}
              noValidate
              className="grid gap-6"
              onSubmit={handleSubmit(submitPayment)}
            >
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
                  shortcuts={
                    <PaidOnShortcuts dueDate={expense.dueDate} today={today} />
                  }
                />

                <OptionalFields>
                  {details.isShown('discount') && (
                    <MoneyField
                      isOptional
                      name="discount"
                      label={t('discount')}
                      currency={currency}
                      hint={t('discountHint')}
                      action={removeDetailButton('discount')}
                      deps={['amount']}
                    />
                  )}

                  {details.isShown('fees') && (
                    <MoneyField
                      isOptional
                      name="fees"
                      label={t('fees')}
                      currency={currency}
                      hint={t('feesHint')}
                      action={removeDetailButton('fees')}
                    />
                  )}

                  {details.isShown('method') && (
                    <FormField
                      isOptional
                      label={t('method')}
                      error={errors.method?.message}
                      action={removeDetailButton('method')}
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
                  )}

                  {details.isShown('notes') && (
                    <FormField
                      isOptional
                      label={t('notes')}
                      error={errors.notes?.message}
                      action={removeDetailButton('notes')}
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
                  )}
                </OptionalFields>

                <OptionalDetailButtons
                  label={t('optionalDetails')}
                  details={details.hidden}
                  labelOf={(detail) =>
                    t.rich(`addDetail.${detail}`, { hidden: srOnly })
                  }
                  onShow={details.show}
                  buttonRefOf={details.addButtonRef}
                  className="sm:col-span-2"
                />
              </div>

              <SettlementNote target={target} />

              <FormRootError />
            </form>
          </FormProvider>
        </DialogBody>

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

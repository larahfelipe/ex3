import { useState, type FC, type ReactNode } from 'react';
import { useController, useFormContext, useFormState } from 'react-hook-form';

import { z } from 'zod';

import type {
  ExpenseCategory,
  ExpenseDescription,
  PaymentMethod
} from '@/app/api/v1/finances';
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  FINANCE_LIMITS,
  OFFERED_CURRENCIES,
  PAYMENT_METHOD_LABELS,
  PAYMENT_METHODS
} from '@/common/constants';
import { currencyFractionDigits, currencySymbolOf } from '@/common/utils';
import { DatePicker } from '@/components/date-picker';
import { FormField, type FieldControlProps } from '@/components/form-field';
import { MoneyInput, type RejectedAmount } from '@/components/money-input';
import {
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui';
import {
  DECIMAL_COLUMN,
  decimalPlacesOf,
  INTEGER_DIGITS,
  isNonzeroDecimal,
  isStorableDecimal
} from '@/lib/decimal';
import { cn } from '@/lib/utils';

export type DescriptionFormInput = Record<
  'description' | 'subcategory' | 'account' | 'notes',
  string
> &
  Record<'category', ExpenseCategory> &
  Record<'paymentMethod', PaymentMethodChoice>;

type PaymentMethodChoice = PaymentMethod | typeof NO_PAYMENT_METHOD;

type MoneyFieldProps = Record<'name' | 'label' | 'currency', string> &
  Partial<Record<'isOptional', boolean>> &
  Partial<Record<'hint', ReactNode>> &
  Partial<Record<'className', string>> &
  Partial<Record<'action', ReactNode>>;

type DayFieldProps = Record<'name' | 'label', string> &
  Partial<Record<'hint', ReactNode>> &
  Partial<Record<'className', string>> &
  Partial<Record<'isOptional', boolean>>;

type CurrencyFieldProps = Record<'name', string> &
  Partial<Record<'isFixed', boolean>> &
  Partial<Record<'className', string>>;

/** A Radix select item cannot carry an empty value, so "not specified" has its own. */
export const NO_PAYMENT_METHOD = 'NONE';

const DECIMAL_LIMITS = `at most ${INTEGER_DIGITS} integer digits and ${DECIMAL_COLUMN.SCALE} decimal places`;

export const TEXTAREA_CLASS =
  'flex w-full rounded-md border border-input bg-transparent px-3 py-2 text-base ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-negative md:text-sm';

/** A button takes no `required`: a select's trigger keeps only what names and describes it. */
export const triggerPropsOf = ({
  id,
  'aria-invalid': isInvalid,
  'aria-describedby': describedBy
}: FieldControlProps) => ({
  id,
  'aria-invalid': isInvalid,
  'aria-describedby': describedBy
});

const pastedAmountIssueOf = (field: string, reading: RejectedAmount) =>
  reading.outcome === 'ambiguous'
    ? `The pasted ${field.toLowerCase()} may be ${reading.asDecimal} or ${reading.asWhole}: type its digits instead`
    : `The pasted ${field.toLowerCase()} is not a number with ${DECIMAL_LIMITS}`;

export const requiredTextField = (field: string, maxLength: number) =>
  z
    .string()
    .trim()
    .min(1, `${field} is required`)
    .max(maxLength, `${field} must have at most ${maxLength} characters`);

export const optionalTextField = (field: string, maxLength: number) =>
  z
    .string()
    .trim()
    .max(maxLength, `${field} must have at most ${maxLength} characters`)
    .transform((value) => (value === '' ? null : value));

/** An amount above zero, as the money input writes it. */
export const positiveMoneyField = (field: string) =>
  z
    .string()
    .min(1, `${field} is required`)
    .refine(
      isStorableDecimal,
      `${field} must be a number with ${DECIMAL_LIMITS}`
    )
    .refine(isNonzeroDecimal, `${field} must be greater than zero`);

/** An amount that may be left out, recorded as zero. */
export const optionalMoneyField = (field: string) =>
  z
    .string()
    .transform((value) => (value === '' ? '0' : value))
    .refine(
      isStorableDecimal,
      `${field} must be a number with ${DECIMAL_LIMITS}`
    );

/** An amount that may be left out, recorded as none; when given, above zero. */
export const optionalPositiveMoneyField = (field: string) =>
  z
    .string()
    .transform((value) => (value === '' ? null : value))
    .refine(
      (value) => value === null || isStorableDecimal(value),
      `${field} must be a number with ${DECIMAL_LIMITS}`
    )
    .refine(
      (value) => value === null || isNonzeroDecimal(value),
      `${field} must be greater than zero`
    );

export const requiredDayField = (field: string) =>
  z.string().min(1, `${field} is required`);

/** The API refuses an amount finer than the currency's minor unit: say so before it does. */
export const requireMinorUnitsOf =
  <Field extends string>(fields: ReadonlyArray<Field>) =>
  (
    values: Partial<Record<Field, string | null>> & Record<'currency', string>,
    ctx: z.RefinementCtx
  ) => {
    const places = currencyFractionDigits(values.currency);

    for (const field of fields) {
      const amount = values[field];

      if (typeof amount === 'string' && decimalPlacesOf(amount) > places)
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message:
            places === 0
              ? `${values.currency} amounts have no decimal places`
              : `${values.currency} amounts have at most ${places} decimal places`
        });
    }
  };

export const DescriptionFormFields = z.object({
  description: requiredTextField(
    'Description',
    FINANCE_LIMITS.DescriptionMaxLength
  ),
  category: z.enum(EXPENSE_CATEGORIES),
  subcategory: optionalTextField(
    'Subcategory',
    FINANCE_LIMITS.SubcategoryMaxLength
  ),
  paymentMethod: z
    .union([z.enum(PAYMENT_METHODS), z.literal(NO_PAYMENT_METHOD)])
    .transform((method) => (method === NO_PAYMENT_METHOD ? null : method)),
  account: optionalTextField('Account', FINANCE_LIMITS.AccountMaxLength),
  notes: optionalTextField('Notes', FINANCE_LIMITS.NotesMaxLength)
});

export const DESCRIPTION_FORM_FIELDS = DescriptionFormFields.keyof().options;

export const EMPTY_DESCRIPTION_FORM: DescriptionFormInput = {
  description: '',
  category: 'OTHER',
  subcategory: '',
  paymentMethod: NO_PAYMENT_METHOD,
  account: '',
  notes: ''
};

export const toDescriptionFormValues = ({
  description,
  category,
  subcategory,
  paymentMethod,
  account,
  notes
}: ExpenseDescription): DescriptionFormInput => ({
  description,
  category,
  subcategory: subcategory ?? '',
  paymentMethod: paymentMethod ?? NO_PAYMENT_METHOD,
  account: account ?? '',
  notes: notes ?? ''
});

/** The form field an issue the API reports on `path` belongs to, if the form has it. */
export const fieldOfPath =
  <Field extends string>(fields: ReadonlyArray<Field>) =>
  (path: string) =>
    fields.find((field) => field === path);

/** A dialog cannot be dismissed while its save is on its way, so a refusal always has a form to show in. */
export const useSubmitter = <Draft, Payload>(
  onSubmit: (payload: Payload) => Promise<unknown>,
  payloadOf: (draft: Draft) => Payload,
  present: (error: unknown) => void
) => {
  const [isSaving, setIsSaving] = useState(false);

  const submit = async (draft: Draft) => {
    setIsSaving(true);

    try {
      await onSubmit(payloadOf(draft));
    } catch (error) {
      present(error);
    } finally {
      setIsSaving(false);
    }
  };

  return { isSaving, submit };
};

export const MoneyField: FC<MoneyFieldProps> = ({
  name,
  label,
  currency,
  isOptional = false,
  hint,
  className,
  action
}) => {
  const { control, setError } = useFormContext<Record<string, string>>();
  const {
    field: { ref, value, onChange, onBlur },
    fieldState: { error }
  } = useController({ name, control });

  return (
    <FormField
      isOptional={isOptional}
      label={`${label} (${currency})`}
      hint={hint}
      error={error?.message}
      action={action}
      className={className}
    >
      {(fieldControl) => (
        <MoneyInput
          {...fieldControl}
          ref={ref}
          name={name}
          value={value}
          decimals={currencyFractionDigits(currency)}
          leftElement={
            <span aria-hidden className="text-sm text-muted-foreground">
              {currencySymbolOf(currency)}
            </span>
          }
          onValueChange={onChange}
          onBlur={onBlur}
          onRejectedPaste={(reading) =>
            setError(name, { message: pastedAmountIssueOf(label, reading) })
          }
        />
      )}
    </FormField>
  );
};

export const DayField: FC<DayFieldProps> = ({
  name,
  label,
  hint,
  className,
  isOptional
}) => {
  const { control } = useFormContext<Record<string, string>>();
  const {
    field,
    fieldState: { error }
  } = useController({ name, control });

  return (
    <FormField
      label={label}
      hint={hint}
      error={error?.message}
      className={className}
      isOptional={isOptional}
    >
      {(fieldControl) => (
        <DatePicker
          id={fieldControl.id}
          ref={field.ref}
          name={field.name}
          value={field.value}
          aria-invalid={fieldControl['aria-invalid']}
          aria-describedby={fieldControl['aria-describedby']}
          onValueChange={field.onChange}
          onBlur={field.onBlur}
        />
      )}
    </FormField>
  );
};

export const CurrencyField: FC<CurrencyFieldProps> = ({
  name,
  isFixed = false,
  className
}) => {
  const { control } = useFormContext<Record<string, string>>();
  const {
    field,
    fieldState: { error }
  } = useController({ name, control });

  const currencies: ReadonlyArray<string> = OFFERED_CURRENCIES.some(
    (currency) => currency === field.value
  )
    ? OFFERED_CURRENCIES
    : [...OFFERED_CURRENCIES, field.value];

  return (
    <FormField
      label="Currency"
      error={error?.message}
      hint={isFixed ? 'Fixed when the record was created' : undefined}
      className={className}
    >
      {(fieldControl) => (
        <Select
          name={field.name}
          value={field.value}
          disabled={isFixed}
          onValueChange={field.onChange}
        >
          <SelectTrigger
            {...triggerPropsOf(fieldControl)}
            ref={field.ref}
            onBlur={field.onBlur}
          >
            <SelectValue />
          </SelectTrigger>

          <SelectContent>
            {currencies.map((currency) => (
              <SelectItem key={currency} value={currency}>
                {currency}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </FormField>
  );
};

/**
 * The fields every bill, plan and series is described with. The form that
 * renders them provides its methods through `FormProvider`.
 */
export const DescriptionFields: FC<Partial<Record<'className', string>>> = ({
  className
}) => {
  const { control, register } = useFormContext<DescriptionFormInput>();
  const { errors } = useFormState({ control });

  const { field: categoryField } = useController({
    name: 'category',
    control
  });
  const { field: methodField } = useController({
    name: 'paymentMethod',
    control
  });

  return (
    <div className={cn('grid gap-4 sm:grid-cols-2', className)}>
      <FormField
        label="Description"
        error={errors.description?.message}
        className="sm:col-span-2"
      >
        {(fieldControl) => (
          <Input
            {...fieldControl}
            type="text"
            autoComplete="off"
            maxLength={FINANCE_LIMITS.DescriptionMaxLength}
            {...register('description')}
          />
        )}
      </FormField>

      <FormField label="Category" error={errors.category?.message}>
        {(fieldControl) => (
          <Select
            name={categoryField.name}
            value={categoryField.value}
            onValueChange={categoryField.onChange}
          >
            <SelectTrigger
              {...triggerPropsOf(fieldControl)}
              ref={categoryField.ref}
              onBlur={categoryField.onBlur}
            >
              <SelectValue />
            </SelectTrigger>

            <SelectContent>
              {EXPENSE_CATEGORIES.map((category) => (
                <SelectItem key={category} value={category}>
                  {EXPENSE_CATEGORY_LABELS[category]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </FormField>

      <FormField
        isOptional
        label="Subcategory"
        error={errors.subcategory?.message}
      >
        {(fieldControl) => (
          <Input
            {...fieldControl}
            type="text"
            autoComplete="off"
            maxLength={FINANCE_LIMITS.SubcategoryMaxLength}
            {...register('subcategory')}
          />
        )}
      </FormField>

      <FormField
        isOptional
        label="Payment method"
        error={errors.paymentMethod?.message}
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
              <SelectItem value={NO_PAYMENT_METHOD}>Not specified</SelectItem>

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
        label="Account or card"
        error={errors.account?.message}
      >
        {(fieldControl) => (
          <Input
            {...fieldControl}
            type="text"
            autoComplete="off"
            maxLength={FINANCE_LIMITS.AccountMaxLength}
            {...register('account')}
          />
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
    </div>
  );
};

export const FormRootError: FC = () => {
  const { control } = useFormContext();
  const { errors } = useFormState({ control });
  const message = errors.root?.server?.message;

  return message === undefined ? null : (
    <p role="alert" className="text-sm text-negative">
      {message}
    </p>
  );
};

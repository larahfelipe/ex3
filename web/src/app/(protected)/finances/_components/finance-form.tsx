import { useState, type FC, type ReactNode } from 'react';
import { useController, useFormContext, useFormState } from 'react-hook-form';

import { useTranslations } from 'use-intl';
import { z } from 'zod';

import type {
  ExpenseCategory,
  ExpenseDescription,
  PaymentMethod
} from '@/app/api/v1/finances';
import {
  EXPENSE_CATEGORIES,
  FINANCE_LIMITS,
  PAYMENT_METHODS
} from '@/common/constants';
import { currencyFractionDigits } from '@/common/utils';
import { DatePicker } from '@/components/date-picker';
import {
  DeferredSection,
  FormField,
  type FieldControlProps
} from '@/components/form-field';
import { CurrencyAmountInput, CurrencySelect } from '@/components/money-input';
import {
  Input,
  SearchableSelect,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  TEXTAREA_CLASS
} from '@/components/ui';
import { useFormat } from '@/i18n/format';
import { srOnly } from '@/i18n/rich-text';
import type { Translator } from '@/i18n/translator';
import { decimalLimitsIssueOf, pastedAmountIssueOf } from '@/lib/amount-issues';
import {
  decimalPlacesOf,
  isNonzeroDecimal,
  isStorableDecimal
} from '@/lib/decimal';

export type DescriptionFormInput = Record<
  'description' | 'subcategory' | 'account' | 'notes',
  string
> &
  Record<'category', ExpenseCategory> &
  Record<'paymentMethod', PaymentMethodChoice>;

type PaymentMethodChoice = PaymentMethod | typeof NO_PAYMENT_METHOD;

export type ValidationTranslator = Translator<'validation'>;

type MoneyFieldProps = Record<'name' | 'label' | 'currency', string> &
  Partial<Record<'currencyName', string>> &
  Partial<Record<'isOptional', boolean>> &
  Partial<Record<'hint', ReactNode>> &
  Partial<Record<'className', string>> &
  Partial<Record<'action', ReactNode>> &
  /** Fields whose checks read this one, revalidated as it changes. */
  Partial<Record<'deps', ReadonlyArray<string>>>;

type DayFieldProps = Record<'name' | 'label', string> &
  Partial<Record<'hint', ReactNode>> &
  Partial<Record<'className', string>> &
  Partial<Record<'isOptional', boolean>> &
  /** Quick picks shown under the picker, above its hint. */
  Partial<Record<'shortcuts', ReactNode>>;

/** A Radix select item cannot carry an empty value, so "not specified" has its own. */
export const NO_PAYMENT_METHOD = 'NONE';

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

/**
 * Every message below is about the field it sits under, which its label
 * already names, so none repeats the label: a message never has to agree with
 * a field's name in gender or number.
 */
export const requiredTextFieldFor = (
  t: ValidationTranslator,
  maxLength: number
) =>
  z
    .string()
    .trim()
    .min(1, t('text.required'))
    .max(maxLength, t('text.tooLong', { max: maxLength }));

export const optionalTextFieldFor = (
  t: ValidationTranslator,
  maxLength: number
) =>
  z
    .string()
    .trim()
    .max(maxLength, t('text.tooLong', { max: maxLength }))
    .transform((value) => (value === '' ? null : value));

/** An amount above zero, as the money input writes it. */
export const positiveMoneyFieldFor = (t: ValidationTranslator) =>
  z
    .string()
    .min(1, t('amount.required'))
    .refine(isStorableDecimal, decimalLimitsIssueOf(t))
    .refine(isNonzeroDecimal, t('amount.notPositive'));

/** An amount that may be left out, recorded as zero. */
export const optionalMoneyFieldFor = (t: ValidationTranslator) =>
  z
    .string()
    .transform((value) => (value === '' ? '0' : value))
    .refine(isStorableDecimal, decimalLimitsIssueOf(t));

/** An amount that may be left out, recorded as none; when given, above zero. */
export const optionalPositiveMoneyFieldFor = (t: ValidationTranslator) =>
  z
    .string()
    .transform((value) => (value === '' ? null : value))
    .refine(
      (value) => value === null || isStorableDecimal(value),
      decimalLimitsIssueOf(t)
    )
    .refine(
      (value) => value === null || isNonzeroDecimal(value),
      t('amount.notPositive')
    );

export const requiredDayFieldFor = (t: ValidationTranslator) =>
  z.string().min(1, t('day.required'));

/** The API refuses an amount finer than the currency's minor unit: say so before it does. */
export const requireMinorUnitsOf =
  <Field extends string>(
    fields: ReadonlyArray<Field>,
    t: ValidationTranslator
  ) =>
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
          message: t('amount.minorUnits', {
            places,
            currency: values.currency
          })
        });
    }
  };

export const descriptionFormFieldsFor = (t: ValidationTranslator) =>
  z.object({
    description: requiredTextFieldFor(t, FINANCE_LIMITS.DescriptionMaxLength),
    category: z.enum(EXPENSE_CATEGORIES),
    subcategory: optionalTextFieldFor(t, FINANCE_LIMITS.SubcategoryMaxLength),
    paymentMethod: z
      .union([z.enum(PAYMENT_METHODS), z.literal(NO_PAYMENT_METHOD)])
      .transform((method) => (method === NO_PAYMENT_METHOD ? null : method)),
    account: optionalTextFieldFor(t, FINANCE_LIMITS.AccountMaxLength),
    notes: optionalTextFieldFor(t, FINANCE_LIMITS.NotesMaxLength)
  });

export const DESCRIPTION_FORM_FIELDS = [
  'description',
  'category',
  'subcategory',
  'paymentMethod',
  'account',
  'notes'
] as const satisfies ReadonlyArray<keyof DescriptionFormInput>;

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

/**
 * An amount with its currency attached. With `currencyName`, the code that
 * closes the field selects the form's currency; without it, the currency is
 * fixed and shown as text.
 */
export const MoneyField: FC<MoneyFieldProps> = ({
  name,
  label,
  currency,
  currencyName,
  isOptional = false,
  hint,
  className,
  action,
  deps
}) => {
  const tForm = useTranslations('common.form');
  const tValidation = useTranslations('validation');
  const format = useFormat();
  const { control, setError } = useFormContext<Record<string, string>>();
  const {
    field: { ref, value, onChange, onBlur },
    fieldState: { error }
  } = useController({
    name,
    control,
    rules: deps === undefined ? undefined : { deps: [...deps] }
  });
  const { errors } = useFormState({ control, name: currencyName ?? name });
  const currencyError =
    currencyName === undefined ? undefined : errors[currencyName]?.message;

  return (
    <FormField
      isOptional={isOptional}
      label={
        currencyName === undefined
          ? tForm.rich('labelInCurrency', { label, currency, hidden: srOnly })
          : label
      }
      hint={hint}
      error={error?.message ?? currencyError}
      action={action}
      className={className}
    >
      {(fieldControl) => (
        <CurrencyAmountInput
          {...fieldControl}
          ref={ref}
          name={name}
          value={value}
          currency={currency}
          decimals={currencyFractionDigits(currency)}
          currencyControl={
            currencyName === undefined ? undefined : (
              <CurrencyControl
                name={currencyName}
                isInvalid={currencyError !== undefined}
                describedBy={fieldControl['aria-describedby']}
              />
            )
          }
          onValueChange={onChange}
          onBlur={onBlur}
          onRejectedPaste={(reading) =>
            setError(name, {
              message: pastedAmountIssueOf(reading, tValidation, format)
            })
          }
        />
      )}
    </FormField>
  );
};

const CurrencyControl: FC<
  Record<'name', string> &
    Record<'isInvalid', boolean> &
    Partial<Record<'describedBy', string>>
> = ({ name, isInvalid, describedBy }) => {
  const { control } = useFormContext<Record<string, string>>();
  const {
    field: { ref, value, onChange, onBlur }
  } = useController({ name, control });

  return (
    <CurrencySelect
      ref={ref}
      name={name}
      value={value}
      aria-invalid={isInvalid}
      aria-describedby={describedBy}
      onValueChange={onChange}
      onBlur={onBlur}
    />
  );
};

export const DayField: FC<DayFieldProps> = ({
  name,
  label,
  hint,
  className,
  isOptional,
  shortcuts
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
        <>
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

          {shortcuts}
        </>
      )}
    </FormField>
  );
};

/**
 * What every bill, plan and series is: its description and its category, two
 * cells of the grid the form lays its essential fields in. The form that
 * renders it provides its methods through `FormProvider`.
 */
export const DescriptionFields: FC = () => {
  const t = useTranslations('finances');
  const { control, register } = useFormContext<DescriptionFormInput>();
  const { errors } = useFormState({ control });
  const { field: categoryField } = useController({
    name: 'category',
    control
  });
  const categoryOptions = EXPENSE_CATEGORIES.map((category) => ({
    value: category,
    label: t(`categories.${category}`),
    description: t(`categoryExamples.${category}`)
  }));

  return (
    <>
      <FormField
        label={t('form.description')}
        error={errors.description?.message}
      >
        {(fieldControl) => (
          <Input
            {...fieldControl}
            type="text"
            autoComplete="off"
            placeholder={t('form.descriptionPlaceholder')}
            maxLength={FINANCE_LIMITS.DescriptionMaxLength}
            {...register('description')}
          />
        )}
      </FormField>

      <FormField label={t('form.category')} error={errors.category?.message}>
        {(fieldControl) => (
          <SearchableSelect
            {...triggerPropsOf(fieldControl)}
            ref={categoryField.ref}
            name={categoryField.name}
            value={categoryField.value}
            options={categoryOptions}
            onValueChange={categoryField.onChange}
            onBlur={categoryField.onBlur}
          />
        )}
      </FormField>
    </>
  );
};

const MORE_DETAILS = [
  'subcategory',
  'paymentMethod',
  'account',
  'notes'
] as const satisfies ReadonlyArray<keyof DescriptionFormInput>;

/**
 * What a bill, plan or series can say beyond what it is: a subcategory, how it
 * is paid and any notes, all optional and out of the way until asked for.
 */
export const MoreDetailsFields: FC = () => {
  const t = useTranslations('finances');
  const { control, register, getValues, setFocus } =
    useFormContext<DescriptionFormInput>();
  const { errors } = useFormState({ control });
  const { field: methodField } = useController({
    name: 'paymentMethod',
    control
  });
  const { subcategory, paymentMethod, account, notes } = getValues();

  return (
    <DeferredSection
      title={t('form.moreDetailsSection')}
      revealLabel={t('form.addMoreDetails')}
      revealHint={t('form.moreDetailsHint')}
      isInitiallyRevealed={
        subcategory !== '' ||
        paymentMethod !== NO_PAYMENT_METHOD ||
        account !== '' ||
        notes !== ''
      }
      hasError={MORE_DETAILS.some((name) => errors[name] !== undefined)}
      onReveal={() => setFocus('subcategory')}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <FormField
          isOptional
          label={t('form.subcategory')}
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
          label={t('form.paymentMethod')}
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
                <SelectItem value={NO_PAYMENT_METHOD}>
                  {t('form.noPaymentMethod')}
                </SelectItem>

                {PAYMENT_METHODS.map((method) => (
                  <SelectItem key={method} value={method}>
                    {t(`paymentMethods.${method}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </FormField>

        <FormField
          isOptional
          label={t('form.account')}
          error={errors.account?.message}
          className="sm:col-span-2"
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
          label={t('form.notes')}
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

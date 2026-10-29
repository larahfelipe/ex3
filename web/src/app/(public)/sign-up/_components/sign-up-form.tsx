'use client';

import { useId, useMemo, useState, type FC, type SubmitEvent } from 'react';
import { flushSync } from 'react-dom';
import {
  useForm,
  useWatch,
  type FieldErrors,
  type SubmitHandler
} from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'use-intl';
import { z } from 'zod';

import { DEFAULT_CURRENCY, OFFERED_CURRENCIES } from '@/common/constants';
import { ChoiceField, FormField } from '@/components/form-field';
import { PasswordRequirements } from '@/components/password-requirements';
import { SlideTransition } from '@/components/slide-transition';
import { SubmitButton } from '@/components/submit-button';
import {
  Button,
  Input,
  SegmentedControl,
  SegmentedControlItem
} from '@/components/ui';
import { useSignUp } from '@/hooks/use-user';
import type { Translator } from '@/i18n/translator';
import {
  accountNameSchemaFor,
  emailSchemaFor,
  isDerivedFromEmail,
  newPasswordSchemaFor
} from '@/lib/account-schema';
import { ApiProxyError, isConflictError } from '@/lib/axios';
import type { SlideDirection } from '@/lib/motion';
import {
  PORTFOLIO_NAME_MAX_LENGTH,
  portfolioNameSchemaFor
} from '@/lib/portfolio-schema';
import { presentSubmitError } from '@/lib/submit-error';

import { AuthNotice } from '../../_components/auth-notice';

type SignUpFormValues = z.infer<ReturnType<typeof signUpSchemaFor>>;

type SignUpField = keyof SignUpFormValues;

const signUpSchemaFor = (t: Translator<'validation'>) =>
  z
    .object({
      name: accountNameSchemaFor(t),
      email: emailSchemaFor(t),
      password: newPasswordSchemaFor(t),
      confirmPassword: z.string().min(1, t('password.confirmRequired')),
      portfolioName: portfolioNameSchemaFor(t),
      baseCurrency: z.enum(OFFERED_CURRENCIES, t('currency.invalid'))
    })
    .refine(({ email, password }) => !isDerivedFromEmail(password, email), {
      message: t('password.derivedFromEmail'),
      path: ['password']
    })
    .refine(({ password, confirmPassword }) => password === confirmPassword, {
      message: t('password.mismatch'),
      path: ['confirmPassword']
    });

const SIGN_UP_STEPS = [
  { title: 'details', fields: ['name', 'email'] },
  { title: 'security', fields: ['password', 'confirmPassword'] },
  { title: 'portfolio', fields: ['portfolioName', 'baseCurrency'] }
] as const satisfies ReadonlyArray<
  Record<'title', string> & Record<'fields', ReadonlyArray<SignUpField>>
>;

const SIGN_UP_FIELDS = SIGN_UP_STEPS.flatMap(({ fields }) => fields);

const LAST_STEP = SIGN_UP_STEPS.length - 1;

const isSignUpField = (path: string): path is SignUpField =>
  SIGN_UP_FIELDS.some((field) => field === path);

const stepOf = (field: SignUpField) =>
  SIGN_UP_STEPS.findIndex(({ fields }) =>
    fields.some((stepField) => stepField === field)
  );

export const SignUpForm: FC = () => {
  const { mutateAsync: signUp } = useSignUp();
  const t = useTranslations('auth');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const tActions = useTranslations('common.actions');
  const signUpSchema = useMemo(
    () => signUpSchemaFor(tValidation),
    [tValidation]
  );

  const [step, setStep] = useState(0);
  const [stepDirection, setStepDirection] = useState<SlideDirection>(1);

  const stepTitleId = useId();

  const {
    control: formControl,
    register,
    handleSubmit,
    setError,
    setFocus,
    getFieldState,
    trigger,
    formState: { errors, isSubmitting }
  } = useForm<SignUpFormValues>({
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      portfolioName: t('signUp.firstPortfolioName'),
      baseCurrency: DEFAULT_CURRENCY
    }
  });

  const email = useWatch({ control: formControl, name: 'email' });

  const { title, fields } = SIGN_UP_STEPS[step];
  const stepNumber = step + 1;
  const stepCount = SIGN_UP_STEPS.length;
  const isLastStep = step === LAST_STEP;

  /**
   * The step's fields mount in `flushSync`, so the one to focus is registered
   * when `setFocus` looks it up.
   */
  const goToStep = (nextStep: number, field?: SignUpField) => {
    flushSync(() => {
      setStepDirection(nextStep > step ? 1 : -1);
      setStep(nextStep);
    });
    setFocus(field ?? SIGN_UP_STEPS[nextStep].fields[0]);
  };

  const revealFirstInvalidField = (invalid: FieldErrors<SignUpFormValues>) => {
    const field = SIGN_UP_FIELDS.find((name) => invalid[name] !== undefined);

    if (field !== undefined && stepOf(field) !== step)
      goToStep(stepOf(field), field);
  };

  /** The password fields are left out, so typing a password never shows or clears an error until the step is submitted. */
  const validateOnChange = (field: 'name' | 'email' | 'portfolioName') => ({
    onChange: () => void trigger(field)
  });

  const handleSignUp: SubmitHandler<SignUpFormValues> = async ({
    name,
    email,
    password,
    portfolioName,
    baseCurrency
  }) => {
    try {
      await signUp({ name, email, password, portfolioName, baseCurrency });
    } catch (error) {
      if (error instanceof ApiProxyError && isConflictError(error)) {
        setError('email', {
          type: 'server',
          message: t('signUp.emailTaken')
        });
        goToStep(stepOf('email'), 'email');
        return;
      }

      presentSubmitError(error, {
        setError,
        fieldOf: (path) => (isSignUpField(path) ? path : undefined),
        t: tErrors
      });

      const invalidField = SIGN_UP_FIELDS.find(
        (field) => getFieldState(field).error !== undefined
      );

      if (invalidField !== undefined && stepOf(invalidField) !== step)
        goToStep(stepOf(invalidField), invalidField);
    }
  };

  const submitStep = async (event: SubmitEvent<HTMLFormElement>) => {
    if (isLastStep) {
      await handleSubmit(handleSignUp, revealFirstInvalidField)(event);

      return;
    }

    event.preventDefault();

    if (await trigger(fields, { shouldFocus: true })) goToStep(step + 1);
  };

  return (
    <form noValidate aria-labelledby={stepTitleId} onSubmit={submitStep}>
      <div className="space-y-3">
        <div
          aria-live="polite"
          className="flex items-baseline justify-between gap-4"
        >
          <h2 id={stepTitleId} className="font-semibold">
            {t(`signUp.steps.${title}`)}
          </h2>

          <p className="text-sm text-muted-foreground tabular-nums">
            {t('signUp.progress', { step: stepNumber, count: stepCount })}
          </p>
        </div>

        <div
          role="progressbar"
          aria-labelledby={stepTitleId}
          aria-valuemin={1}
          aria-valuemax={stepCount}
          aria-valuenow={stepNumber}
          aria-valuetext={t('signUp.progress', {
            step: stepNumber,
            count: stepCount
          })}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="size-full rounded-full bg-primary transition-transform duration-500 ease-out motion-reduce:transition-none"
            style={{
              transform: `translateX(-${100 - (stepNumber / stepCount) * 100}%)`
            }}
          />
        </div>
      </div>

      <div className="mt-8">
        <SlideTransition panelKey={step} direction={stepDirection}>
          <div className="space-y-5">
            {step === stepOf('name') && (
              <>
                <FormField
                  label={t('fields.name')}
                  error={errors.name?.message}
                >
                  {(control) => (
                    <Input
                      {...control}
                      autoComplete="name"
                      autoCorrect="off"
                      {...register('name', validateOnChange('name'))}
                    />
                  )}
                </FormField>

                <FormField
                  label={t('fields.email')}
                  error={errors.email?.message}
                >
                  {(control) => (
                    <Input
                      {...control}
                      type="email"
                      autoComplete="username"
                      {...register('email', validateOnChange('email'))}
                    />
                  )}
                </FormField>
              </>
            )}

            {step === stepOf('password') && (
              <>
                <input
                  hidden
                  readOnly
                  type="email"
                  autoComplete="username"
                  value={email}
                />

                <FormField
                  label={t('fields.password')}
                  hint={<PasswordRequirements />}
                  error={errors.password?.message}
                >
                  {(control) => (
                    <Input
                      {...control}
                      type="password"
                      autoComplete="new-password"
                      {...register('password')}
                    />
                  )}
                </FormField>

                <FormField
                  label={t('fields.confirmPassword')}
                  error={errors.confirmPassword?.message}
                >
                  {(control) => (
                    <Input
                      {...control}
                      type="password"
                      autoComplete="new-password"
                      {...register('confirmPassword')}
                    />
                  )}
                </FormField>
              </>
            )}

            {step === stepOf('portfolioName') && (
              <>
                <FormField
                  label={t('fields.portfolioName')}
                  hint={t('signUp.portfolioNameHint')}
                  error={errors.portfolioName?.message}
                >
                  {(control) => (
                    <Input
                      {...control}
                      type="text"
                      autoComplete="off"
                      maxLength={PORTFOLIO_NAME_MAX_LENGTH}
                      {...register(
                        'portfolioName',
                        validateOnChange('portfolioName')
                      )}
                    />
                  )}
                </FormField>

                <ChoiceField
                  legend={t('fields.baseCurrency')}
                  hint={t('signUp.baseCurrencyHint')}
                  error={errors.baseCurrency?.message}
                >
                  <SegmentedControl className="grid grid-cols-3">
                    {OFFERED_CURRENCIES.map((currency) => (
                      <SegmentedControlItem
                        key={currency}
                        value={currency}
                        {...register('baseCurrency')}
                      >
                        {currency}
                      </SegmentedControlItem>
                    ))}
                  </SegmentedControl>
                </ChoiceField>
              </>
            )}

            {errors.root?.server?.message !== undefined && (
              <AuthNotice tone="negative" role="alert">
                {errors.root.server.message}
              </AuthNotice>
            )}
          </div>
        </SlideTransition>
      </div>

      <div className="mt-8 flex gap-3">
        {step > 0 && (
          <Button
            type="button"
            variant="outline"
            size="lg"
            disabled={isSubmitting}
            className="flex-1"
            onClick={() => goToStep(step - 1)}
          >
            {tActions('back')}
          </Button>
        )}

        {isLastStep ? (
          <SubmitButton isPending={isSubmitting} size="lg" className="flex-1">
            {t('signUp.submit')}
          </SubmitButton>
        ) : (
          <Button type="submit" size="lg" className="flex-1">
            {t('signUp.continue')}
          </Button>
        )}
      </div>
    </form>
  );
};

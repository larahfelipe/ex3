'use client';

import { useId, useState, type FC, type SubmitEvent } from 'react';
import { flushSync } from 'react-dom';
import {
  useForm,
  useWatch,
  type FieldErrors,
  type SubmitHandler
} from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { CURRENCIES } from '@/common/constants';
import { ChoiceField, FormField } from '@/components/form-field';
import { PasswordRequirements } from '@/components/password-requirements';
import { SubmitButton } from '@/components/submit-button';
import {
  Button,
  Input,
  SegmentedControl,
  SegmentedControlItem
} from '@/components/ui';
import { useSignUp } from '@/hooks/use-user';
import {
  AccountNameSchema,
  EmailSchema,
  isDerivedFromEmail,
  NewPasswordSchema,
  PASSWORD_DERIVED_FROM_EMAIL_MESSAGE
} from '@/lib/account-schema';
import { ApiProxyError, isConflictError } from '@/lib/axios';
import {
  PORTFOLIO_NAME_MAX_LENGTH,
  PortfolioNameSchema
} from '@/lib/portfolio-schema';
import { presentSubmitError } from '@/lib/submit-error';

import { AuthNotice } from '../../_components/auth-notice';

type SignUpFormValues = z.infer<typeof signUpSchema>;

type SignUpField = keyof SignUpFormValues;

const CURRENCY_IDS = Object.values(CURRENCIES).map(({ id }) => id);

/** The name the API gives the first portfolio when the sign-up sends none. */
const FIRST_PORTFOLIO_NAME = 'Main';

const signUpSchema = z
  .object({
    name: AccountNameSchema,
    email: EmailSchema,
    password: NewPasswordSchema,
    confirmPassword: z.string().min(1, 'Confirm your password'),
    portfolioName: PortfolioNameSchema,
    baseCurrency: z.enum(CURRENCY_IDS, 'Select a valid base currency')
  })
  .refine(({ email, password }) => !isDerivedFromEmail(password, email), {
    message: PASSWORD_DERIVED_FROM_EMAIL_MESSAGE,
    path: ['password']
  })
  .refine(({ password, confirmPassword }) => password === confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword']
  });

const SIGN_UP_FIELDS = signUpSchema.keyof().options;

const SIGN_UP_STEPS = [
  { title: 'Your details', fields: ['name', 'email'] },
  { title: 'Security', fields: ['password', 'confirmPassword'] },
  { title: 'Portfolio', fields: ['portfolioName', 'baseCurrency'] }
] as const satisfies ReadonlyArray<
  Record<'title', string> & Record<'fields', ReadonlyArray<SignUpField>>
>;

const LAST_STEP = SIGN_UP_STEPS.length - 1;

const isSignUpField = (path: string): path is SignUpField =>
  SIGN_UP_FIELDS.some((field) => field === path);

const stepOf = (field: SignUpField) =>
  SIGN_UP_STEPS.findIndex(({ fields }) =>
    fields.some((stepField) => stepField === field)
  );

export const SignUpForm: FC = () => {
  const { mutateAsync: signUp } = useSignUp();

  const [step, setStep] = useState(0);

  const stepTitleId = useId();

  const {
    control: formControl,
    register,
    handleSubmit,
    setError,
    setFocus,
    getValues,
    getFieldState,
    trigger,
    formState: { errors, isSubmitting }
  } = useForm<SignUpFormValues>({
    mode: 'onChange',
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      portfolioName: FIRST_PORTFOLIO_NAME,
      baseCurrency: CURRENCIES.BRL.id
    }
  });

  const [email, password] = useWatch({
    control: formControl,
    name: ['email', 'password']
  });

  const { title, fields } = SIGN_UP_STEPS[step];
  const stepNumber = step + 1;
  const stepCount = SIGN_UP_STEPS.length;
  const isLastStep = step === LAST_STEP;

  /**
   * The step's fields mount in `flushSync`, so the one to focus is registered
   * when `setFocus` looks it up.
   */
  const goToStep = (nextStep: number, field?: SignUpField) => {
    flushSync(() => setStep(nextStep));
    setFocus(field ?? SIGN_UP_STEPS[nextStep].fields[0]);
  };

  const revealFirstInvalidField = (invalid: FieldErrors<SignUpFormValues>) => {
    const field = SIGN_UP_FIELDS.find((name) => invalid[name] !== undefined);

    if (field !== undefined && stepOf(field) !== step)
      goToStep(stepOf(field), field);
  };

  /**
   * A field's error depends on another field here, and only the changed field
   * is validated on change; the dependent one is re-validated once it has a
   * value, so an untouched field still shows nothing.
   */
  const revalidateOnceTyped = (field: 'password' | 'confirmPassword') => () => {
    if (getValues(field)) void trigger(field);
  };

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
          message: 'This email is already registered. Sign in instead.'
        });
        goToStep(stepOf('email'), 'email');
        return;
      }

      presentSubmitError(error, {
        setError,
        fieldOf: (path) => (isSignUpField(path) ? path : undefined)
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
            {title}
          </h2>

          <p className="text-sm text-muted-foreground tabular-nums">
            {`Step ${stepNumber} of ${stepCount}`}
          </p>
        </div>

        <div
          role="progressbar"
          aria-labelledby={stepTitleId}
          aria-valuemin={1}
          aria-valuemax={stepCount}
          aria-valuenow={stepNumber}
          aria-valuetext={`Step ${stepNumber} of ${stepCount}`}
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

      <div
        key={step}
        className="mt-8 space-y-5 duration-300 ease-out animate-in fade-in-0 motion-reduce:animate-none"
      >
        {step === stepOf('name') && (
          <>
            <FormField label="Name" error={errors.name?.message}>
              {(control) => (
                <Input
                  {...control}
                  autoComplete="name"
                  autoCorrect="off"
                  {...register('name')}
                />
              )}
            </FormField>

            <FormField label="Email" error={errors.email?.message}>
              {(control) => (
                <Input
                  {...control}
                  type="email"
                  autoComplete="username"
                  {...register('email', {
                    onChange: revalidateOnceTyped('password')
                  })}
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
              label="Password"
              hint={<PasswordRequirements password={password} email={email} />}
              error={errors.password?.message}
            >
              {(control) => (
                <Input
                  {...control}
                  type="password"
                  autoComplete="new-password"
                  {...register('password', {
                    onChange: revalidateOnceTyped('confirmPassword')
                  })}
                />
              )}
            </FormField>

            <FormField
              label="Confirm password"
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
              label="Portfolio name"
              hint="You can rename it and add other portfolios later."
              error={errors.portfolioName?.message}
            >
              {(control) => (
                <Input
                  {...control}
                  type="text"
                  autoComplete="off"
                  maxLength={PORTFOLIO_NAME_MAX_LENGTH}
                  {...register('portfolioName')}
                />
              )}
            </FormField>

            <ChoiceField
              legend="Base currency"
              hint="The portfolio reports every value in this currency."
              error={errors.baseCurrency?.message}
            >
              <SegmentedControl className="grid grid-cols-3">
                {CURRENCY_IDS.map((currency) => (
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
            Back
          </Button>
        )}

        {isLastStep ? (
          <SubmitButton isPending={isSubmitting} size="lg" className="flex-1">
            Create account
          </SubmitButton>
        ) : (
          <Button type="submit" size="lg" className="flex-1">
            Continue
          </Button>
        )}
      </div>
    </form>
  );
};

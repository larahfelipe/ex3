import { useId, useMemo, type FC } from 'react';
import { useForm, useWatch } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'use-intl';
import { z } from 'zod';

import { FormField } from '@/components/form-field';
import { InfoNote } from '@/components/info-note';
import { PasswordRequirements } from '@/components/password-requirements';
import { SubmitButton } from '@/components/submit-button';
import { CardContent, CardFooter, Input } from '@/components/ui';
import { useRevalidateOnLocaleChange } from '@/hooks/use-revalidate-on-locale-change';
import { useChangePassword } from '@/hooks/use-user';
import type { Translator } from '@/i18n/translator';
import { newPasswordSchemaFor } from '@/lib/account-schema';
import { ApiProxyError, isValidationError } from '@/lib/axios';
import { presentSubmitError } from '@/lib/submit-error';

type PasswordFormProps = Partial<Record<'email', string>>;

type PasswordFormValues = z.infer<ReturnType<typeof passwordFormSchemaFor>>;

type PasswordFormField = keyof PasswordFormValues;

const passwordFormSchemaFor = (t: Translator<'validation'>) =>
  z
    .object({
      currentPassword: z.string().min(1, t('password.currentRequired')),
      newPassword: newPasswordSchemaFor(t),
      confirmNewPassword: z.string().min(1, t('password.confirmNewRequired'))
    })
    .refine(
      ({ newPassword, confirmNewPassword }) =>
        newPassword === confirmNewPassword,
      { message: t('password.mismatch'), path: ['confirmNewPassword'] }
    );

const FIELDS_BY_API_PATH = new Map<string, PasswordFormField>([
  ['oldPassword', 'currentPassword'],
  ['newPassword', 'newPassword']
]);

/** `PATCH /v1/user` answers a wrong current password with a validation error that names no field. */
const isWrongCurrentPassword = (error: unknown) =>
  error instanceof ApiProxyError &&
  isValidationError(error) &&
  error._error?.details.length === 0;

export const PasswordForm: FC<PasswordFormProps> = ({ email }) => {
  const { mutateAsync: changePassword } = useChangePassword();
  const t = useTranslations('account.security');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const passwordFormSchema = useMemo(
    () => passwordFormSchemaFor(tValidation),
    [tValidation]
  );

  const signOutNoteId = useId();

  const {
    control,
    register,
    handleSubmit,
    setError,
    getValues,
    trigger,
    formState: { errors, isSubmitting }
  } = useForm<PasswordFormValues>({
    mode: 'onChange',
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: ''
    }
  });

  useRevalidateOnLocaleChange(errors, trigger);

  const newPassword = useWatch({ control, name: 'newPassword' });

  const replacePassword = async ({
    currentPassword,
    newPassword
  }: PasswordFormValues) => {
    try {
      await changePassword({ oldPassword: currentPassword, newPassword });
    } catch (error) {
      if (isWrongCurrentPassword(error)) {
        setError(
          'currentPassword',
          {
            type: 'server',
            message: tValidation('password.currentIncorrect')
          },
          { shouldFocus: true }
        );
        return;
      }

      presentSubmitError(error, {
        setError,
        fieldOf: (path) => FIELDS_BY_API_PATH.get(path),
        t: tErrors
      });
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(replacePassword)}>
      <CardContent className="space-y-5">
        <FormField
          label={t('currentPassword')}
          error={errors.currentPassword?.message}
        >
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="current-password"
              {...register('currentPassword')}
            />
          )}
        </FormField>

        <FormField
          label={t('newPassword')}
          hint={<PasswordRequirements password={newPassword} email={email} />}
          error={errors.newPassword?.message}
        >
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="new-password"
              {...register('newPassword', {
                onChange: () => {
                  if (getValues('confirmNewPassword'))
                    void trigger('confirmNewPassword');
                }
              })}
            />
          )}
        </FormField>

        <FormField
          label={t('confirmNewPassword')}
          error={errors.confirmNewPassword?.message}
        >
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="new-password"
              {...register('confirmNewPassword')}
            />
          )}
        </FormField>

        {errors.root?.server?.message !== undefined && (
          <p role="alert" className="text-sm text-negative">
            {errors.root.server.message}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:justify-between">
        <InfoNote id={signOutNoteId}>{t('signOutNote')}</InfoNote>

        <SubmitButton
          isPending={isSubmitting}
          size="sm"
          aria-describedby={signOutNoteId}
          className="shrink-0"
        >
          {t('submit')}
        </SubmitButton>
      </CardFooter>
    </form>
  );
};

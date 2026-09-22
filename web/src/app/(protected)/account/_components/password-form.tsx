import type { FC } from 'react';
import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import { FormField } from '@/components/form-field';
import { SubmitButton } from '@/components/submit-button';
import { CardContent, CardFooter, Input } from '@/components/ui';
import { useChangePassword } from '@/hooks/use-user';
import { NEW_PASSWORD_HINT, NewPasswordSchema } from '@/lib/account-schema';
import { ApiProxyError, isValidationError } from '@/lib/axios';
import { presentSubmitError } from '@/lib/submit-error';

type PasswordFormValues = z.infer<typeof PasswordFormSchema>;

type PasswordFormField = keyof PasswordFormValues;

const PasswordFormSchema = z
  .object({
    currentPassword: z.string().min(1, 'Current password is required'),
    newPassword: NewPasswordSchema,
    confirmNewPassword: z.string().min(1, 'Confirm the new password')
  })
  .refine(
    ({ newPassword, confirmNewPassword }) => newPassword === confirmNewPassword,
    { message: 'Passwords must match', path: ['confirmNewPassword'] }
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

export const PasswordForm: FC = () => {
  const { mutateAsync: changePassword } = useChangePassword();

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<PasswordFormValues>({
    mode: 'onTouched',
    resolver: zodResolver(PasswordFormSchema),
    defaultValues: {
      currentPassword: '',
      newPassword: '',
      confirmNewPassword: ''
    }
  });

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
          { type: 'server', message: 'The current password is incorrect' },
          { shouldFocus: true }
        );
        return;
      }

      presentSubmitError(error, {
        setError,
        fieldOf: (path) => FIELDS_BY_API_PATH.get(path)
      });
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(replacePassword)}>
      <CardContent className="space-y-5">
        <FormField
          label="Current password"
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
          label="New password"
          hint={NEW_PASSWORD_HINT}
          error={errors.newPassword?.message}
        >
          {(control) => (
            <Input
              {...control}
              type="password"
              autoComplete="new-password"
              {...register('newPassword')}
            />
          )}
        </FormField>

        <FormField
          label="Confirm new password"
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

      <CardFooter className="flex justify-end">
        <SubmitButton
          isPending={isSubmitting}
          size="sm"
          className="max-sm:w-full"
        >
          Change password
        </SubmitButton>
      </CardFooter>
    </form>
  );
};

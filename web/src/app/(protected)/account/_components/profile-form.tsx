import { useMemo, type FC } from 'react';
import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'use-intl';
import { z } from 'zod';

import type { GetCurrentUserResponseData } from '@/app/api/v1/user';
import { FormField } from '@/components/form-field';
import { SubmitButton } from '@/components/submit-button';
import { CardContent, CardFooter, Input } from '@/components/ui';
import { useRevalidateOnLocaleChange } from '@/hooks/use-revalidate-on-locale-change';
import { useUpdateProfile } from '@/hooks/use-user';
import type { Translator } from '@/i18n/translator';
import { accountNameSchemaFor } from '@/lib/account-schema';
import { presentSubmitError } from '@/lib/submit-error';

type ProfileFormProps = Record<'user', GetCurrentUserResponseData['user']>;

type ProfileFormValues = z.infer<ReturnType<typeof profileFormSchemaFor>>;

const profileFormSchemaFor = (t: Translator<'validation'>) =>
  z.object({ name: accountNameSchemaFor(t) });

export const ProfileForm: FC<ProfileFormProps> = ({ user }) => {
  const { mutateAsync: updateProfile } = useUpdateProfile();
  const t = useTranslations('account.profile');
  const tValidation = useTranslations('validation');
  const tErrors = useTranslations('errors');
  const tActions = useTranslations('common.actions');
  const profileFormSchema = useMemo(
    () => profileFormSchemaFor(tValidation),
    [tValidation]
  );

  const {
    register,
    handleSubmit,
    reset,
    setError,
    trigger,
    formState: { errors, isSubmitting }
  } = useForm<ProfileFormValues>({
    mode: 'onChange',
    resolver: zodResolver(profileFormSchema),
    defaultValues: { name: user.name ?? '' }
  });

  useRevalidateOnLocaleChange(errors, trigger);

  const saveProfile = async ({ name }: ProfileFormValues) => {
    try {
      await updateProfile({ name });
      reset({ name });
    } catch (error) {
      presentSubmitError(error, {
        setError,
        fieldOf: (path) => (path === 'name' ? path : undefined),
        t: tErrors
      });
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(saveProfile)}>
      <CardContent className="space-y-5">
        <FormField label={t('name')} error={errors.name?.message}>
          {(control) => (
            <Input
              {...control}
              autoComplete="name"
              autoCorrect="off"
              {...register('name')}
            />
          )}
        </FormField>

        <dl className="space-y-1.5">
          <dt className="text-sm font-medium leading-none">{t('email')}</dt>

          <dd className="text-sm wrap-anywhere">{user.email}</dd>
        </dl>

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
          {tActions('saveChanges')}
        </SubmitButton>
      </CardFooter>
    </form>
  );
};

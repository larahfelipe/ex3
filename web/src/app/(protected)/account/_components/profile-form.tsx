import { useMemo, type FC } from 'react';
import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'use-intl';
import { z } from 'zod';

import type { GetCurrentUserResponseData } from '@/app/api/v1/user';
import { PersonNameFields } from '@/components/person-name-fields';
import { SubmitButton } from '@/components/submit-button';
import { CardContent, CardFooter } from '@/components/ui';
import { useRevalidateOnLocaleChange } from '@/hooks/use-revalidate-on-locale-change';
import { useUpdateProfile } from '@/hooks/use-user';
import type { Translator } from '@/i18n/translator';
import { firstNameSchemaFor, lastNameSchemaFor } from '@/lib/account-schema';
import { presentSubmitError } from '@/lib/submit-error';

type ProfileFormProps = Record<'user', GetCurrentUserResponseData['user']>;

type ProfileFormValues = z.infer<ReturnType<typeof profileFormSchemaFor>>;

const profileFormSchemaFor = (t: Translator<'validation'>) =>
  z.object({
    firstName: firstNameSchemaFor(t),
    lastName: lastNameSchemaFor(t)
  });

const isProfileField = (path: string): path is keyof ProfileFormValues =>
  path === 'firstName' || path === 'lastName';

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
    defaultValues: {
      firstName: user.firstName ?? '',
      lastName: user.lastName ?? ''
    }
  });

  useRevalidateOnLocaleChange(errors, trigger);

  const saveProfile = async (names: ProfileFormValues) => {
    try {
      await updateProfile(names);
      reset(names);
    } catch (error) {
      presentSubmitError(error, {
        setError,
        fieldOf: (path) => (isProfileField(path) ? path : undefined),
        t: tErrors
      });
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(saveProfile)}>
      <CardContent className="space-y-5">
        <PersonNameFields
          firstName={{
            registration: register('firstName'),
            error: errors.firstName?.message
          }}
          lastName={{
            registration: register('lastName'),
            error: errors.lastName?.message
          }}
        />

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

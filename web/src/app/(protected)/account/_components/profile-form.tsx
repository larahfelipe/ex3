import type { FC } from 'react';
import { useForm } from 'react-hook-form';

import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

import type { GetCurrentUserResponseData } from '@/app/api/v1/user';
import { FormField } from '@/components/form-field';
import { SubmitButton } from '@/components/submit-button';
import { CardContent, CardFooter, Input } from '@/components/ui';
import { useUpdateProfile } from '@/hooks/use-user';
import { AccountNameSchema } from '@/lib/account-schema';
import { presentSubmitError } from '@/lib/submit-error';

type ProfileFormProps = Record<'user', GetCurrentUserResponseData['user']>;

type ProfileFormValues = z.infer<typeof ProfileFormSchema>;

const ProfileFormSchema = z.object({ name: AccountNameSchema });

export const ProfileForm: FC<ProfileFormProps> = ({ user }) => {
  const { mutateAsync: updateProfile } = useUpdateProfile();

  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting }
  } = useForm<ProfileFormValues>({
    mode: 'onChange',
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: { name: user.name ?? '' }
  });

  const saveProfile = async ({ name }: ProfileFormValues) => {
    try {
      await updateProfile({ name });
      reset({ name });
    } catch (error) {
      presentSubmitError(error, {
        setError,
        fieldOf: (path) => (path === 'name' ? path : undefined)
      });
    }
  };

  return (
    <form noValidate onSubmit={handleSubmit(saveProfile)}>
      <CardContent className="space-y-5">
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

        <dl className="space-y-1.5">
          <dt className="text-sm font-medium leading-none">Email</dt>

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
          Save changes
        </SubmitButton>
      </CardFooter>
    </form>
  );
};

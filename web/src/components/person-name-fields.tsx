import type { FC } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

import { useTranslations } from 'use-intl';

import { FormField } from '@/components/form-field';
import { Input } from '@/components/ui';

type NameFieldProps = Record<'registration', UseFormRegisterReturn> &
  Partial<Record<'error', string>>;

type PersonNameFieldsProps = Record<'firstName' | 'lastName', NameFieldProps>;

/**
 * The names sit side by side once the form is wide enough for both. The last
 * name is optional: not everyone has one, and an account created before the
 * names were apart holds its whole name as the first.
 */
export const PersonNameFields: FC<PersonNameFieldsProps> = ({
  firstName,
  lastName
}) => {
  const t = useTranslations('common.personName');

  return (
    <div className="@container">
      <div className="grid gap-x-4 gap-y-5 @sm:grid-cols-2">
        <FormField label={t('firstName')} error={firstName.error}>
          {(control) => (
            <Input
              {...control}
              autoComplete="given-name"
              autoCorrect="off"
              {...firstName.registration}
            />
          )}
        </FormField>

        <FormField label={t('lastName')} isOptional error={lastName.error}>
          {(control) => (
            <Input
              {...control}
              autoComplete="family-name"
              autoCorrect="off"
              {...lastName.registration}
            />
          )}
        </FormField>
      </div>
    </div>
  );
};

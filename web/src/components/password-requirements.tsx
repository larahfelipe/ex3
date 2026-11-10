import type { FC } from 'react';

import { Check, Circle } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { srOnly } from '@/i18n/rich-text';
import {
  hasPasswordMinLength,
  isDerivedFromEmail,
  PASSWORD_MIN_CODE_POINTS
} from '@/lib/account-schema';
import { cn } from '@/lib/utils';

type PasswordRequirementsProps = Partial<Record<'password' | 'email', string>>;

/**
 * The password rules as the password field's description. Given the password,
 * a person sees each rule met while typing, and an empty password meets none,
 * so nothing is ticked before typing. Without it the rules are only listed,
 * for forms that judge the password once it is submitted.
 */
export const PasswordRequirements: FC<PasswordRequirementsProps> = ({
  password,
  email
}) => {
  const t = useTranslations('auth.passwordRequirements');

  const minLengthRequirement = t('minLength', {
    min: PASSWORD_MIN_CODE_POINTS
  });
  const emailRequirement = t('notEmail');

  if (password === undefined)
    return (
      <ul className="list-disc space-y-1 ps-4">
        <li>{minLengthRequirement}</li>

        <li>{emailRequirement}</li>
      </ul>
    );

  const isTyped = password.length > 0;

  const requirements = [
    {
      label: minLengthRequirement,
      isMet: hasPasswordMinLength(password)
    },
    {
      label: emailRequirement,
      isMet:
        isTyped && (email === undefined || !isDerivedFromEmail(password, email))
    }
  ];

  return (
    <ul className="space-y-1">
      {requirements.map(({ label, isMet }) => (
        <li
          key={label}
          className={cn(
            'flex items-center gap-2 transition-colors',
            isMet && 'text-positive'
          )}
        >
          {isMet ? (
            <Check aria-hidden="true" className="size-3.5 shrink-0" />
          ) : (
            <Circle aria-hidden="true" className="size-3.5 shrink-0" />
          )}

          <span>
            {t.rich('item', {
              status: isMet ? 'met' : 'notMet',
              requirement: label,
              hidden: srOnly
            })}
          </span>
        </li>
      ))}
    </ul>
  );
};

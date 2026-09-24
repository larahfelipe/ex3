import type { FC } from 'react';

import { Check, Circle } from 'lucide-react';

import {
  hasPasswordMinLength,
  isDerivedFromEmail,
  PASSWORD_MIN_LENGTH_REQUIREMENT
} from '@/lib/account-schema';
import { cn } from '@/lib/utils';

type PasswordRequirementsProps = Partial<Record<'password' | 'email', string>>;

const EMAIL_REQUIREMENT = 'Does not include your email';

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
  if (password === undefined)
    return (
      <ul className="list-disc space-y-1 ps-4">
        <li>{PASSWORD_MIN_LENGTH_REQUIREMENT}</li>

        <li>{EMAIL_REQUIREMENT}</li>
      </ul>
    );

  const isTyped = password.length > 0;

  const requirements = [
    {
      label: PASSWORD_MIN_LENGTH_REQUIREMENT,
      isMet: hasPasswordMinLength(password)
    },
    {
      label: EMAIL_REQUIREMENT,
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
            <span className="sr-only">{isMet ? 'Met: ' : 'Not met: '}</span>

            {label}
          </span>
        </li>
      ))}
    </ul>
  );
};

import type { FC } from 'react';

import { Check, Circle } from 'lucide-react';

import {
  hasPasswordMinLength,
  isDerivedFromEmail,
  PASSWORD_MIN_LENGTH_REQUIREMENT
} from '@/lib/account-schema';
import { cn } from '@/lib/utils';

type PasswordRequirementsProps = {
  password: string;
  email?: string;
};

/**
 * The password rules a person can see met while typing, as the password field's
 * description. An empty password meets none, so nothing is ticked before typing.
 */
export const PasswordRequirements: FC<PasswordRequirementsProps> = ({
  password,
  email
}) => {
  const isTyped = password.length > 0;

  const requirements = [
    {
      label: PASSWORD_MIN_LENGTH_REQUIREMENT,
      isMet: hasPasswordMinLength(password)
    },
    {
      label: 'Does not include your email',
      isMet:
        isTyped && (email === undefined || !isDerivedFromEmail(password, email))
    }
  ];

  return (
    <div className="space-y-2">
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

      <p>
        Longer is stronger: a few unrelated words make a password easy to
        remember and hard to guess.
      </p>
    </div>
  );
};

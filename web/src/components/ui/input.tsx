import * as React from 'react';

import { Eye, EyeClosed, KeyRound, Mail, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils';

import { Button } from '.';
import { FIELD_CLASS } from './field';

export type InputProps = React.ComponentProps<'input'> &
  Partial<Record<'leftElement', React.JSX.Element>>;

const TYPE_ICONS: Partial<Record<React.HTMLInputTypeAttribute, LucideIcon>> = {
  email: Mail,
  password: KeyRound
};

const Input = ({
  className,
  type,
  disabled,
  leftElement,
  ...props
}: InputProps) => {
  const [showPassword, setShowPassword] = React.useState(false);
  const t = useTranslations('common.form');

  const isPasswordType = type === 'password';
  const passwordState = showPassword ? 'text' : 'password';

  const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

  const TypeIcon = type === undefined ? undefined : TYPE_ICONS[type];
  const leadingElement =
    leftElement ??
    (TypeIcon === undefined ? undefined : (
      <TypeIcon
        aria-hidden="true"
        size={16}
        className="text-muted-foreground"
      />
    ));

  return (
    <div className="flex items-center relative">
      {leadingElement && (
        <div className="pointer-events-none absolute left-2.5 flex">
          {leadingElement}
        </div>
      )}

      <input
        type={isPasswordType ? passwordState : type}
        className={cn(
          FIELD_CLASS,
          'flex h-(--field-height) w-full px-3 py-1 text-base md:text-sm',
          leadingElement && 'pl-8',
          isPasswordType && 'pr-11 sm:pr-10',
          className
        )}
        disabled={disabled}
        {...props}
      />

      {isPasswordType && (
        <Button
          type="button"
          variant="ghost"
          size="icon"
          aria-label={showPassword ? t('hidePassword') : t('showPassword')}
          className="absolute right-1 size-9 text-muted-foreground sm:size-8"
          disabled={disabled}
          onClick={togglePasswordVisibility}
        >
          {showPassword ? (
            <EyeClosed size={16} aria-hidden="true" />
          ) : (
            <Eye size={16} aria-hidden="true" />
          )}
        </Button>
      )}
    </div>
  );
};

export { Input };

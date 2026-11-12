import * as React from 'react';

import { Eye, EyeClosed } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { cn } from '@/lib/utils';

import { Button } from '.';
import { FIELD_CLASS } from './field';

export type InputProps = React.ComponentProps<'input'> &
  Partial<Record<'leftElement', React.JSX.Element>>;

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

  return (
    <div className="flex items-center relative">
      {leftElement && (
        <div className="pointer-events-none absolute left-2.5 flex">
          {leftElement}
        </div>
      )}

      <input
        type={isPasswordType ? passwordState : type}
        className={cn(
          FIELD_CLASS,
          'flex h-9 w-full px-3 py-1 text-base md:text-sm',
          leftElement && 'pl-8',
          isPasswordType && 'pr-10',
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
          className="absolute right-1 size-8 text-muted-foreground"
          disabled={disabled}
          onClick={togglePasswordVisibility}
        >
          {showPassword ? (
            <Eye size={16} aria-hidden="true" />
          ) : (
            <EyeClosed size={16} aria-hidden="true" />
          )}
        </Button>
      )}
    </div>
  );
};

export { Input };

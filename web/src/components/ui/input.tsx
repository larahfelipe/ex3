import * as React from 'react';

import { Eye, EyeClosed } from 'lucide-react';

import { cn } from '@/lib/utils';

import { Button } from '.';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  leftElement?: React.JSX.Element;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, disabled, leftElement, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

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
            'flex h-10 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base ring-offset-background transition-colors placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-negative md:text-sm',
            leftElement && 'pl-8',
            isPasswordType && 'pr-10',
            className
          )}
          ref={ref}
          disabled={disabled}
          {...props}
        />

        {isPasswordType && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={showPassword ? 'Hide password' : 'Show password'}
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
  }
);
Input.displayName = 'Input';

export { Input };

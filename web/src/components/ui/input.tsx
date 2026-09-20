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
        {leftElement && <div className="absolute ml-2.5">{leftElement}</div>}

        <input
          type={isPasswordType ? passwordState : type}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50',
            leftElement && 'pl-8',
            isPasswordType && 'pr-12',
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
            aria-label={showPassword ? 'Hide password' : 'Show password'}
            className="absolute right-0 *:text-muted-foreground"
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

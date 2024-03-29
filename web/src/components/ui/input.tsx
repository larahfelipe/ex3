import * as React from 'react';
import { PiEye, PiEyeClosed } from 'react-icons/pi';

import { cn } from '@/lib/utils';

import { Button } from '.';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  leftElement?: JSX.Element;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, leftElement, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    const isTypePassword = type === 'password';

    const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

    return (
      <div className="flex items-center relative">
        {leftElement && <div className="absolute ml-2.5">{leftElement}</div>}

        <input
          type={type}
          className={cn(
            'flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-default file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50',
            leftElement && 'pl-8',
            isTypePassword && 'pr-12',
            className
          )}
          ref={ref}
          {...props}
        />

        {isTypePassword && (
          <Button
            type="button"
            variant="ghost"
            className="absolute right-0"
            onClick={togglePasswordVisibility}
          >
            {showPassword ? <PiEye size={16} /> : <PiEyeClosed size={16} />}
          </Button>
        )}
      </div>
    );
  }
);
Input.displayName = 'Input';

export { Input };

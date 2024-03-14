import * as React from 'react';
import { PiEye, PiEyeClosed } from 'react-icons/pi';

import { cn } from '@/lib/utils';

import { Button } from '.';

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    const [showPassword, setShowPassword] = React.useState(false);

    const togglePasswordVisibility = () => setShowPassword((prev) => !prev);

    return (
      <div className="flex relative">
        <input
          type={type === 'password' && showPassword ? 'text' : type}
          className={cn(
            'flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring transition ease-in-out delay-50 disabled:cursor-not-allowed disabled:opacity-50',
            className
          )}
          ref={ref}
          {...props}
        />

        {type === 'password' && (
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

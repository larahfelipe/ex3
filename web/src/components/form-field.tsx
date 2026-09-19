import {
  useId,
  type FC,
  type InputHTMLAttributes,
  type ReactNode
} from 'react';

import { Label } from '@/components/ui';
import { cn } from '@/lib/utils';

export type FieldControlProps = Pick<
  InputHTMLAttributes<HTMLElement>,
  'id' | 'required' | 'aria-invalid' | 'aria-describedby'
>;

type FormFieldProps = {
  label: string;
  error?: string;
  className?: string;
  isOptional?: boolean;
  children: (control: FieldControlProps) => ReactNode;
};

export const FormField: FC<FormFieldProps> = ({
  label,
  error,
  className,
  isOptional = false,
  children
}) => {
  const controlId = useId();
  const errorId = useId();
  const hasError = error !== undefined;

  return (
    <div className={cn('space-y-1.5', className)}>
      <Label htmlFor={controlId}>
        {label}

        {isOptional && (
          <span className="font-normal text-muted-foreground"> (optional)</span>
        )}
      </Label>

      {children({
        id: controlId,
        required: !isOptional,
        'aria-invalid': hasError,
        'aria-describedby': hasError ? errorId : undefined
      })}

      {hasError && (
        <p id={errorId} className="text-sm text-negative">
          {error}
        </p>
      )}
    </div>
  );
};

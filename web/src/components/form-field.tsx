import {
  useId,
  type FC,
  type InputHTMLAttributes,
  type ReactNode
} from 'react';

import { Label } from '@/components/ui';
import { APPEAR_CLASS } from '@/lib/motion';
import { cn } from '@/lib/utils';

export type FieldControlProps = Pick<
  InputHTMLAttributes<HTMLElement>,
  'id' | 'required' | 'aria-invalid' | 'aria-describedby'
>;

type FieldDescription = {
  hint?: ReactNode;
  error?: string;
};

type FormFieldProps = FieldDescription & {
  label: ReactNode;
  className?: string;
  isOptional?: boolean;
  action?: ReactNode;
  children: (control: FieldControlProps) => ReactNode;
};

type ChoiceFieldProps = FieldDescription & {
  legend: string;
  className?: string;
  children: ReactNode;
};

const useFieldDescription = ({ hint, error }: FieldDescription) => {
  const hintId = useId();
  const errorId = useId();

  const describedByIds = [
    ...(hint !== undefined ? [hintId] : []),
    ...(error !== undefined ? [errorId] : [])
  ];

  return {
    describedBy:
      describedByIds.length > 0 ? describedByIds.join(' ') : undefined,
    description: (
      <>
        {hint !== undefined && (
          <div id={hintId} className="text-sm text-muted-foreground">
            {hint}
          </div>
        )}

        {error !== undefined && (
          <p id={errorId} className={cn('text-sm text-negative', APPEAR_CLASS)}>
            {error}
          </p>
        )}
      </>
    )
  };
};

export const FormField: FC<FormFieldProps> = ({
  label,
  hint,
  error,
  className,
  isOptional = false,
  action,
  children
}) => {
  const controlId = useId();
  const { describedBy, description } = useFieldDescription({ hint, error });

  const fieldLabel = (
    <Label htmlFor={controlId}>
      {label}

      {isOptional && (
        <span className="font-normal text-muted-foreground"> (optional)</span>
      )}
    </Label>
  );

  return (
    <div className={cn('space-y-1.5', className)}>
      {action === undefined ? (
        fieldLabel
      ) : (
        <div className="flex items-center justify-between gap-2">
          {fieldLabel}

          {action}
        </div>
      )}

      {children({
        id: controlId,
        required: !isOptional,
        'aria-invalid': error !== undefined,
        'aria-describedby': describedBy
      })}

      {description}
    </div>
  );
};

export const ChoiceField: FC<ChoiceFieldProps> = ({
  legend,
  hint,
  error,
  className,
  children
}) => {
  const { describedBy, description } = useFieldDescription({ hint, error });

  return (
    <fieldset
      aria-describedby={describedBy}
      data-invalid={error !== undefined || undefined}
      className={className}
    >
      <legend className="mb-1.5 text-sm font-medium leading-none">
        {legend}
      </legend>

      {children}

      {describedBy !== undefined && (
        <div className="mt-1.5 space-y-1.5">{description}</div>
      )}
    </fieldset>
  );
};

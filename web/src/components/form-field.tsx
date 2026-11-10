import {
  createContext,
  use,
  useId,
  useState,
  type FC,
  type InputHTMLAttributes,
  type ReactNode
} from 'react';
import { flushSync } from 'react-dom';

import { Plus } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { Button, Label } from '@/components/ui';
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

type FormSectionProps = Record<'title', string> &
  Partial<Record<'isOptional', boolean>> &
  Partial<Record<'action' | 'children', ReactNode>> &
  Partial<Record<'className', string>>;

type DeferredSectionProps = Omit<FormSectionProps, 'isOptional'> &
  Record<'revealLabel', string> &
  Record<'onReveal', VoidFunction> &
  Partial<Record<'isInitiallyRevealed' | 'hasError', boolean>>;

type ChoiceFieldProps = FieldDescription & {
  legend: string;
  className?: string;
  children: ReactNode;
};

/** Inside an optional section the title already says so, and its fields do not repeat it. */
const OptionalSectionContext = createContext(false);

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
  const isInOptionalSection = use(OptionalSectionContext);
  const t = useTranslations('common.form');

  const fieldLabel = (
    <Label htmlFor={controlId}>
      {isOptional && !isInOptionalSection
        ? t.rich('optionalLabel', {
            label: () => label,
            muted: (chunks) => (
              <span className="font-normal text-muted-foreground">
                {chunks}
              </span>
            )
          })
        : label}
    </Label>
  );

  return (
    <div className={cn('space-y-2', className)}>
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
      <legend className="mb-2 text-sm font-medium leading-none">
        {legend}
      </legend>

      {children}

      {describedBy !== undefined && (
        <div className="mt-2 space-y-1.5">{description}</div>
      )}
    </fieldset>
  );
};

/** A titled group of a form's fields, with an optional control beside the title. */
export const FormSection: FC<FormSectionProps> = ({
  title,
  isOptional = false,
  action,
  className,
  children
}) => {
  const titleId = useId();
  const t = useTranslations('common.form');

  return (
    <div
      role="group"
      aria-labelledby={titleId}
      className={cn('grid min-w-0 gap-3', className)}
    >
      <div className="flex min-h-8 flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <h3
          id={titleId}
          className="text-xs font-semibold tracking-wide text-muted-foreground uppercase"
        >
          {isOptional
            ? t.rich('optionalSectionTitle', {
                title: () => title,
                muted: (chunks) => (
                  <span className="font-normal tracking-normal normal-case">
                    {chunks}
                  </span>
                )
              })
            : title}
        </h3>

        {action}
      </div>

      <OptionalSectionContext value={isOptional}>
        <div className="grid gap-4">{children}</div>
      </OptionalSectionContext>
    </div>
  );
};

/**
 * An optional section that waits behind a button until it is asked for, so a
 * form opens on what it needs. It is open from the start when it already holds
 * something, and opens for good when one of its fields reports an error.
 * `onReveal` runs once its fields are in the page, to focus the first.
 */
export const DeferredSection: FC<DeferredSectionProps> = ({
  revealLabel,
  onReveal,
  isInitiallyRevealed = false,
  hasError = false,
  ...section
}) => {
  const [isRevealed, setIsRevealed] = useState(isInitiallyRevealed);

  if (hasError && !isRevealed) setIsRevealed(true);

  if (isRevealed || hasError) return <FormSection isOptional {...section} />;

  return (
    <div>
      <Button
        type="button"
        variant="outline"
        size="xs"
        className="gap-1.5"
        onClick={() => {
          flushSync(() => setIsRevealed(true));
          onReveal();
        }}
      >
        <Plus size={14} aria-hidden="true" />

        {revealLabel}
      </Button>
    </div>
  );
};

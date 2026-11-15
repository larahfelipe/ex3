import { useRef, useState, type FC, type ReactNode } from 'react';
import { flushSync } from 'react-dom';

import { Plus } from 'lucide-react';

import { Button } from '@/components/ui';
import { cn } from '@/lib/utils';

type OptionalDetailsOptions<Detail extends string> = {
  details: ReadonlyArray<Detail>;
  initiallyShown: () => Iterable<Detail>;
  required?: ReadonlyArray<Detail>;
  focus: (detail: Detail) => void;
  clear: (detail: Detail) => void;
};

type OptionalDetailButtonsProps<Detail extends string> = {
  label: string;
  details: ReadonlyArray<Detail>;
  labelOf: (detail: Detail) => ReactNode;
  onShow: (detail: Detail) => void;
  buttonRefOf: (detail: Detail) => (button: HTMLButtonElement | null) => void;
  className?: string;
};

type RemoveDetailButtonProps = Record<'children', ReactNode> &
  Record<'onClick', VoidFunction>;

export const useOptionalDetails = <Detail extends string>({
  details,
  initiallyShown,
  required = [],
  focus,
  clear
}: OptionalDetailsOptions<Detail>) => {
  const [shown, setShown] = useState<ReadonlySet<Detail>>(
    () => new Set(initiallyShown())
  );
  const addButtons = useRef<Partial<Record<Detail, HTMLButtonElement | null>>>(
    {}
  );

  const missing = required.filter((detail) => !shown.has(detail));

  if (missing.length > 0) setShown(new Set([...shown, ...missing]));

  const reveal = (detail: Detail) =>
    setShown((current) =>
      current.has(detail) ? current : new Set(current).add(detail)
    );

  const show = (detail: Detail) => {
    flushSync(() => reveal(detail));
    focus(detail);
  };

  const remove = (detail: Detail) => {
    clear(detail);
    flushSync(() =>
      setShown(
        (current) =>
          new Set([...current].filter((shownDetail) => shownDetail !== detail))
      )
    );
    addButtons.current[detail]?.focus();
  };

  return {
    isShown: (detail: Detail) => shown.has(detail),
    hidden: details.filter((detail) => !shown.has(detail)),
    reveal,
    show,
    remove,
    addButtonRef: (detail: Detail) => (button: HTMLButtonElement | null) => {
      addButtons.current[detail] = button;
    }
  };
};

export const OptionalDetailButtons = <Detail extends string>({
  label,
  details,
  labelOf,
  onShow,
  buttonRefOf,
  className
}: OptionalDetailButtonsProps<Detail>) =>
  details.length === 0 ? null : (
    <div
      role="group"
      aria-label={label}
      className={cn('flex flex-wrap gap-2', className)}
    >
      {details.map((detail) => (
        <Button
          key={detail}
          ref={buttonRefOf(detail)}
          type="button"
          variant="outline"
          size="xs"
          className="gap-1.5"
          onClick={() => onShow(detail)}
        >
          <Plus size={14} aria-hidden="true" />

          <span>{labelOf(detail)}</span>
        </Button>
      ))}
    </div>
  );

export const RemoveDetailButton: FC<RemoveDetailButtonProps> = ({
  children,
  onClick
}) => (
  <Button
    type="button"
    variant="ghost"
    size="xxs"
    className="text-muted-foreground"
    onClick={onClick}
  >
    {children}
  </Button>
);

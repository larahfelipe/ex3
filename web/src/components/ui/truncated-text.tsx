'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

import { Tooltip, TooltipContent, TooltipTrigger } from './tooltip';

type TruncatedTextProps = React.ComponentProps<'span'> &
  Record<'children', React.ReactNode>;

type Truncation = 'own' | 'inside-control';

const CONTROL_SELECTOR = 'a, button, label, summary, [role="button"]';

const truncationOf = (element: HTMLElement): Truncation | null => {
  if (
    element.scrollWidth <= element.clientWidth &&
    element.scrollHeight <= element.clientHeight
  )
    return null;

  return element.parentElement?.closest(CONTROL_SELECTOR)
    ? 'inside-control'
    : 'own';
};

const TruncatedText = ({
  className,
  children,
  ...props
}: TruncatedTextProps) => {
  const ref = React.useRef<HTMLSpanElement>(null);
  const [truncation, setTruncation] = React.useState<Truncation | null>(null);
  const [isOpen, setIsOpen] = React.useState(false);
  const tap = React.useRef({ isTouch: false, wasOpen: false });

  React.useEffect(() => {
    const element = ref.current;

    if (!element) return;

    const measure = () => setTruncation(truncationOf(element));
    const resizeObserver = new ResizeObserver(measure);
    const mutationObserver = new MutationObserver(measure);

    resizeObserver.observe(element);
    mutationObserver.observe(element, {
      characterData: true,
      childList: true,
      subtree: true
    });

    return () => {
      resizeObserver.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  return (
    <Tooltip
      open={truncation !== null && isOpen}
      onOpenChange={(open) => setIsOpen(open && truncation !== null)}
    >
      <TooltipTrigger
        asChild
        onPointerDown={({ pointerType }) => {
          tap.current = { isTouch: pointerType === 'touch', wasOpen: isOpen };
        }}
        onClick={(event) => {
          if (truncation !== 'own' || !tap.current.isTouch) return;

          event.preventDefault();
          setIsOpen(!tap.current.wasOpen);
        }}
      >
        <span
          ref={ref}
          tabIndex={truncation === 'own' ? 0 : undefined}
          data-truncated={truncation === null ? undefined : ''}
          className={cn(
            'block rounded-xs focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus',
            className
          )}
          {...props}
        >
          {children}
        </span>
      </TooltipTrigger>

      <TooltipContent>{children}</TooltipContent>
    </Tooltip>
  );
};

export { TruncatedText };

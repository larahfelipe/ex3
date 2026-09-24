'use client';

import * as React from 'react';

import { LayoutGroup, m } from 'framer-motion';

import { MotionScope } from '@/components/motion-scope';
import { TAB_SPRING } from '@/lib/motion';
import { cn } from '@/lib/utils';
import type { Maybe } from '@/types';

const CheckedValueContext = React.createContext<Maybe<string>>(null);

const readNothingChecked = () => null;

/**
 * Reads the checked radio from the DOM rather than from props: a radio
 * registered with a form is uncontrolled, a click reports only the radio that
 * became checked, and a form reset checks one without any event. The store
 * listens for `change` and is read again on every render, which a reset causes.
 */
const useCheckedValue = (groupRef: React.RefObject<Maybe<HTMLElement>>) => {
  const subscribe = React.useCallback(
    (onCheckedChange: VoidFunction) => {
      const group = groupRef.current;

      group?.addEventListener('change', onCheckedChange);

      return () => group?.removeEventListener('change', onCheckedChange);
    },
    [groupRef]
  );

  const readCheckedValue = React.useCallback(
    () =>
      groupRef.current?.querySelector<HTMLInputElement>('input:checked')
        ?.value ?? null,
    [groupRef]
  );

  return React.useSyncExternalStore(
    subscribe,
    readCheckedValue,
    readNothingChecked
  );
};

/**
 * The checked option carries a shared indicator that slides from the option
 * left to the one chosen. Until the checked radio has been read, on the server
 * and in the first client render, the option is filled by CSS instead.
 */
const SegmentedControl = ({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) => {
  const groupRef = React.useRef<HTMLDivElement>(null);
  const layoutGroupId = React.useId();
  const checkedValue = useCheckedValue(groupRef);

  return (
    <div
      ref={groupRef}
      className={cn(
        'flex rounded-md border border-input p-0.5 in-data-invalid:border-negative',
        className
      )}
      {...props}
    >
      <MotionScope>
        <LayoutGroup id={layoutGroupId}>
          <CheckedValueContext value={checkedValue}>
            {children}
          </CheckedValueContext>
        </LayoutGroup>
      </MotionScope>
    </div>
  );
};

type SegmentedControlItemProps = Omit<
  React.ComponentProps<'input'>,
  'type' | 'value'
> &
  Record<'value', string>;

const SegmentedControlItem = ({
  className,
  children,
  value,
  ...props
}: SegmentedControlItemProps) => {
  const checkedValue = React.use(CheckedValueContext);

  return (
    <label
      className={cn(
        'cursor-pointer has-disabled:cursor-not-allowed',
        className
      )}
    >
      <input type="radio" className="peer sr-only" value={value} {...props} />

      <span
        className={cn(
          'relative block rounded-sm px-3 py-1 text-center text-sm font-medium text-muted-foreground ring-offset-background transition-colors peer-not-checked:hover:text-foreground peer-checked:text-primary-foreground peer-checked:duration-300 peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 peer-disabled:pointer-events-none peer-disabled:opacity-50',
          checkedValue === null && 'peer-checked:bg-primary'
        )}
      >
        {value === checkedValue && (
          <m.span
            layoutId="segmented-control-indicator"
            transition={TAB_SPRING}
            className="absolute inset-0 rounded-sm bg-primary"
          />
        )}

        <span className="relative">{children}</span>
      </span>
    </label>
  );
};

export { SegmentedControl, SegmentedControlItem };

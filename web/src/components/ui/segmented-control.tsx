'use client';

import * as React from 'react';
import { flushSync } from 'react-dom';

import { TAB_SPRING_CSS } from '@/lib/motion';
import {
  boxWithin,
  nextPlacement,
  settledPlacement,
  type IndicatorPlacement,
  type PlacementCause
} from '@/lib/segmented-indicator';
import { cn } from '@/lib/utils';
import type { Maybe } from '@/types';

const HasIndicatorContext = React.createContext(false);

const SLIDE_TRANSITION = ['transform', 'width', 'height']
  .map((property) => `${property} ${TAB_SPRING_CSS}`)
  .join(', ');

const OPTION_SELECTOR = 'input[type="radio"] + span';

const CHECKED_OPTION_SELECTOR = 'input[type="radio"]:checked + span';

const readNothingChecked = () => null;

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

const checkedOptionBoxOf = (group: HTMLElement) => {
  const option = group.querySelector<HTMLElement>(CHECKED_OPTION_SELECTOR);

  if (option === null) return null;

  const groupRect = group.getBoundingClientRect();
  const groupStyle = getComputedStyle(group);

  return boxWithin(
    {
      left: groupRect.left,
      top: groupRect.top,
      width: groupRect.width,
      height: groupRect.height,
      layoutWidth: Number.parseFloat(groupStyle.width),
      layoutHeight: Number.parseFloat(groupStyle.height),
      clientLeft: group.clientLeft,
      clientTop: group.clientTop,
      scrollLeft: group.scrollLeft,
      scrollTop: group.scrollTop
    },
    option.getBoundingClientRect()
  );
};

const useIndicatorPlacement = (
  groupRef: React.RefObject<HTMLElement | null>,
  checkedValue: string | null
) => {
  const [placement, setPlacement] = React.useState<IndicatorPlacement | null>(
    null
  );

  React.useLayoutEffect(() => {
    const group = groupRef.current;

    if (group === null) return;

    const place = (cause: PlacementCause) =>
      setPlacement((previous) =>
        nextPlacement(previous, checkedValue, checkedOptionBoxOf(group), cause)
      );

    place('selection');

    const observer = new ResizeObserver(() => flushSync(() => place('resize')));

    observer.observe(group);
    group
      .querySelectorAll(OPTION_SELECTOR)
      .forEach((option) => observer.observe(option));

    return () => observer.disconnect();
  });

  const settle = React.useCallback(
    ({ currentTarget }: React.TransitionEvent<HTMLElement>) => {
      if (currentTarget.getAnimations().length === 0)
        setPlacement(settledPlacement);
    },
    []
  );

  return { placement, settle };
};

type SegmentedControlProps = React.ComponentProps<'div'> &
  Partial<Record<'isFullWidthBelowSm', boolean>>;

const SegmentedControl = ({
  className,
  isFullWidthBelowSm = false,
  children,
  ...props
}: SegmentedControlProps) => {
  const groupRef = React.useRef<HTMLDivElement>(null);
  const checkedValue = useCheckedValue(groupRef);
  const { placement, settle } = useIndicatorPlacement(groupRef, checkedValue);

  return (
    <div
      ref={groupRef}
      data-full-width={isFullWidthBelowSm || undefined}
      className={cn(
        'group/segmented relative flex max-w-full rounded-md border border-input bg-background/60 p-0.5 in-data-invalid:border-negative max-sm:min-h-(--control-height) max-sm:p-1',
        isFullWidthBelowSm && 'max-sm:w-full',
        className
      )}
      {...props}
    >
      {placement !== null && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 rounded-sm bg-primary group-has-[input:checked:disabled]/segmented:opacity-50"
          style={{
            width: placement.box.width,
            height: placement.box.height,
            transform: `translate(${placement.box.x}px, ${placement.box.y}px)`,
            transition: placement.isSliding ? SLIDE_TRANSITION : undefined
          }}
          onTransitionEnd={settle}
        />
      )}

      <HasIndicatorContext value={placement !== null}>
        {children}
      </HasIndicatorContext>
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
  const hasIndicator = React.use(HasIndicatorContext);

  return (
    <label
      className={cn(
        'cursor-pointer has-disabled:cursor-not-allowed max-sm:group-data-full-width/segmented:grow',
        className
      )}
    >
      <input type="radio" className="peer sr-only" value={value} {...props} />

      <span
        className={cn(
          'relative flex h-full items-center justify-center rounded-sm px-3 py-1 text-center text-sm font-medium text-muted-foreground ring-offset-background transition-colors peer-not-checked:hover:text-foreground peer-checked:text-primary-foreground peer-checked:duration-300 peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 peer-disabled:pointer-events-none peer-disabled:opacity-50 max-sm:group-data-full-width/segmented:px-1 max-sm:group-data-full-width/segmented:whitespace-nowrap',
          !hasIndicator && 'peer-checked:bg-primary'
        )}
      >
        {children}
      </span>
    </label>
  );
};

export { SegmentedControl, SegmentedControlItem };

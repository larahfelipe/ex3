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

/** Whether the group's indicator is in place; until it is, the checked option is filled by CSS. */
const HasIndicatorContext = React.createContext(false);

/** The properties the indicator moves by, each on `TAB_SPRING`. */
const SLIDE_TRANSITION = ['transform', 'width', 'height']
  .map((property) => `${property} ${TAB_SPRING_CSS}`)
  .join(', ');

const OPTION_SELECTOR = 'input[type="radio"] + span';

const CHECKED_OPTION_SELECTOR = 'input[type="radio"]:checked + span';

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
 * The group's computed size, its border box under the preflight's `border-box`,
 * is its size before any transform, and unlike `offsetWidth` is not rounded, so
 * a group of fractional width is not taken for a scaled one.
 */
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

/**
 * Places the indicator under the checked option, measured within the group
 * rather than on the page, so a page that moves or reflows carries it along
 * instead of sending it across. It is measured before paint after every render,
 * which a new checked option or new options cause, and again whenever the group
 * or an option resizes.
 */
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

    /** Committed before paint, so a frame never shows the old place over the new layout. */
    const observer = new ResizeObserver(() => flushSync(() => place('resize')));

    observer.observe(group);
    group
      .querySelectorAll(OPTION_SELECTOR)
      .forEach((option) => observer.observe(option));

    return () => observer.disconnect();
  });

  /**
   * Each property ends on its own, and a slide retargeted by a newer one ends
   * only with it, so the slide is over once nothing is left running.
   */
  const settle = React.useCallback(
    ({ currentTarget }: React.TransitionEvent<HTMLElement>) => {
      if (currentTarget.getAnimations().length === 0)
        setPlacement(settledPlacement);
    },
    []
  );

  return { placement, settle };
};

/**
 * One indicator per group slides from the option left to the one chosen, and
 * only then: any other move puts it in place at once. A CSS transition moves
 * it, so a newer choice retargets it from wherever it is. Until it has been
 * placed, on the server and in the first client render, the checked option is
 * filled by CSS instead.
 */
const SegmentedControl = ({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>) => {
  const groupRef = React.useRef<HTMLDivElement>(null);
  const checkedValue = useCheckedValue(groupRef);
  const { placement, settle } = useIndicatorPlacement(groupRef, checkedValue);

  return (
    <div
      ref={groupRef}
      className={cn(
        'group/segmented relative flex rounded-md border border-input bg-background/60 p-0.5 in-data-invalid:border-negative max-sm:min-h-(--control-height)',
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
        'cursor-pointer has-disabled:cursor-not-allowed',
        className
      )}
    >
      <input type="radio" className="peer sr-only" value={value} {...props} />

      <span
        className={cn(
          'relative flex h-full items-center justify-center rounded-sm px-3 py-1 text-center text-sm font-medium text-muted-foreground ring-offset-background transition-colors peer-not-checked:hover:text-foreground peer-checked:text-primary-foreground peer-checked:duration-300 peer-focus-visible:ring-2 peer-focus-visible:ring-focus peer-focus-visible:ring-offset-2 peer-disabled:pointer-events-none peer-disabled:opacity-50',
          !hasIndicator && 'peer-checked:bg-primary'
        )}
      >
        {children}
      </span>
    </label>
  );
};

export { SegmentedControl, SegmentedControlItem };

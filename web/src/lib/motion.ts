import type { Transition, Variants } from 'framer-motion';

/**
 * What replaces a loading state, or answers an action, fades in instead of
 * popping in, so the change reads as one. `globals.css` cuts every animation
 * short under `prefers-reduced-motion`.
 */
export const APPEAR_CLASS = 'animate-in fade-in-0 duration-200 ease-out';

export type SlideDirection = -1 | 1;

/**
 * A tab settles in about a third of a second and overshoots slightly, so the
 * switch lands instead of stopping.
 */
export const TAB_SPRING = {
  type: 'spring',
  visualDuration: 0.3,
  bounce: 0.25
} as const satisfies Transition;

/**
 * How far a tab's panel travels: enough to read as a direction, short enough
 * that the leaving and the arriving panel cross-fade instead of travelling.
 */
const TAB_PANEL_OFFSET_PX = 32;

/** The leaving panel fades faster than the arriving one, so the two barely overlap. */
const TAB_PANEL_ENTER_TRANSITION = {
  x: TAB_SPRING,
  opacity: { duration: 0.2, ease: 'easeOut' }
} as const satisfies Transition;

const TAB_PANEL_EXIT_TRANSITION = {
  x: TAB_SPRING,
  opacity: { duration: 0.12, ease: 'easeIn' }
} as const satisfies Transition;

/** The panel arrives from the side of the tab chosen and leaves to the other. */
export const TAB_PANEL_VARIANTS = {
  enter: (direction: SlideDirection) => ({
    x: direction * TAB_PANEL_OFFSET_PX,
    opacity: 0
  }),
  present: { x: 0, opacity: 1, transition: TAB_PANEL_ENTER_TRANSITION },
  exit: (direction: SlideDirection) => ({
    x: -direction * TAB_PANEL_OFFSET_PX,
    opacity: 0,
    transition: TAB_PANEL_EXIT_TRANSITION
  })
} satisfies Variants;

/** The panel's height follows without overshoot, so what sits below it does not bounce. */
export const TAB_PANEL_HEIGHT_TRANSITION = {
  ...TAB_SPRING,
  bounce: 0
} as const satisfies Transition;

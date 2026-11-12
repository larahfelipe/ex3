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
 * `TAB_SPRING` for a CSS transition: the time it takes to settle and the
 * `linear()` easing that traces it, as framer-motion's `spring().toString()`
 * gives them. Written out, so that what slides by CSS alone does not load the
 * library; `motion.test.ts` keeps it in step with `TAB_SPRING`.
 */
export const TAB_SPRING_CSS =
  '550ms linear(0, 0.1195, 0.3552, 0.5913, 0.7781, 0.9047, 0.9789, 1.0152, 1.0275, 1.0271, 1.0212, 1.0142, 1.0083, 1.004, 1.0013, 0.9999, 1, 1)';

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

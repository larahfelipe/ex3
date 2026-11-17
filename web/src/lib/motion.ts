import type { Transition, Variants } from 'framer-motion';

export const APPEAR_CLASS = 'animate-in fade-in-0 duration-200 ease-out';

export type SlideDirection = -1 | 1;

export const TAB_SPRING = {
  type: 'spring',
  visualDuration: 0.3,
  bounce: 0.25
} as const satisfies Transition;

export const TAB_SPRING_CSS =
  '550ms linear(0, 0.1195, 0.3552, 0.5913, 0.7781, 0.9047, 0.9789, 1.0152, 1.0275, 1.0271, 1.0212, 1.0142, 1.0083, 1.004, 1.0013, 0.9999, 1, 1)';

export const METER_FILL_SPRING = {
  type: 'spring',
  stiffness: 520,
  damping: 34,
  mass: 0.45
} as const satisfies Transition;

export const METER_FADE_SPRING = {
  type: 'spring',
  stiffness: 260,
  damping: 34,
  mass: 0.8
} as const satisfies Transition;

export const METER_FILL_SPRING_CSS = {
  duration: '400ms',
  easing:
    'linear(0, 0.2965, 0.6194, 0.8072, 0.9043, 0.9528, 0.9768, 0.9886, 0.9944, 0.9972, 0.9986, 0.9993, 1)'
} as const;

export const METER_FADE_SPRING_CSS = {
  duration: '750ms',
  easing:
    'linear(0, 0.1042, 0.2851, 0.4555, 0.5938, 0.7, 0.7795, 0.8383, 0.8816, 0.9133, 0.9366, 0.9536, 0.966, 0.9751, 0.9818, 0.9867, 0.9903, 0.9929, 0.9948, 0.9962, 0.9972, 0.998, 0.9985, 0.9989, 1)'
} as const;

const TAB_PANEL_OFFSET_PX = 32;

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

export const TAB_PANEL_HEIGHT_TRANSITION = {
  ...TAB_SPRING,
  bounce: 0
} as const satisfies Transition;

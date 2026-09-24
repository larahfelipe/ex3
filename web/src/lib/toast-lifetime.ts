import type { CSSProperties } from 'react';

import type { ExternalToast } from 'sonner';

/** sonner's own default, passed explicitly so the countdown bar reads it too. */
export const TOAST_LIFETIME_MS = 4_000;

/**
 * The countdown bar is a CSS animation lasting `--toast-lifetime`, so a toast
 * given its own lifetime takes the timer and the bar from here, together.
 */
export const toastLifetimeOf = (
  lifetimeMs: number
): Pick<ExternalToast, 'duration' | 'style'> => ({
  duration: lifetimeMs,
  style: { '--toast-lifetime': `${lifetimeMs}ms` } as CSSProperties
});

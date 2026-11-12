import { cn } from '@/lib/utils';

/**
 * The look every field shares, typed or picked: a fill a shade below the
 * surface it sits on, a border that firms up under the pointer and turns
 * negative when invalid, and the focus ring. A disabled field keeps its
 * resting border, dimmed with the rest of it.
 */
export const FIELD_CLASS =
  'rounded-md border border-input bg-background/60 ring-offset-background transition-colors placeholder:text-muted-foreground hover:border-input-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-input disabled:opacity-50 aria-invalid:border-negative';

export const TEXTAREA_CLASS = cn(
  FIELD_CLASS,
  'flex w-full px-3 py-2 text-base md:text-sm'
);

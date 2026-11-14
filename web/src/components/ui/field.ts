import { cn } from '@/lib/utils';

export const FIELD_CLASS =
  'rounded-md border border-input bg-background/60 ring-offset-background transition-colors placeholder:text-muted-foreground hover:border-input-hover focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:border-input disabled:opacity-50 aria-invalid:border-negative';

export const TEXTAREA_CLASS = cn(
  FIELD_CLASS,
  'flex w-full px-3 py-2.5 text-base md:text-sm'
);

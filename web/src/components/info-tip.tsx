import type { FC, ReactNode } from 'react';

import { Info } from 'lucide-react';

import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui';

type InfoTipProps = Record<'label', string> & Record<'children', ReactNode>;

/**
 * Opens on click, tap or Enter instead of on hover: a hover tooltip never shows
 * on a touch screen, and the explanation has to reach every reader.
 */
export const InfoTip: FC<InfoTipProps> = ({ label, children }) => (
  <Popover>
    <PopoverTrigger
      aria-label={label}
      className="-my-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground ring-offset-background transition-colors hover:text-foreground focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2 data-[state=open]:text-foreground"
    >
      <Info aria-hidden="true" className="size-3.5" />
    </PopoverTrigger>

    <PopoverContent
      aria-label={label}
      className="w-72 max-w-(--radix-popover-content-available-width) text-sm font-normal text-pretty"
    >
      {children}
    </PopoverContent>
  </Popover>
);

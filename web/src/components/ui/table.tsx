'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type TableProps = React.ComponentProps<'table'> &
  Record<'label', string> &
  Partial<Record<'regionClassName', string>>;

const Table = ({ className, label, regionClassName, ...props }: TableProps) => {
  const [isScrollable, setIsScrollable] = React.useState(false);
  const regionRef = React.useRef<HTMLElement>(null);

  React.useEffect(() => {
    const region = regionRef.current;
    const table = region?.firstElementChild;

    if (!region || !table) return;

    const observer = new ResizeObserver(() => {
      setIsScrollable(
        region.scrollWidth > region.clientWidth ||
          region.scrollHeight > region.clientHeight
      );
    });

    observer.observe(region);
    observer.observe(table);

    return () => observer.disconnect();
  }, []);

  // Only a region that actually scrolls is named and focusable: otherwise every
  // table would add a landmark and a tab stop that lead nowhere.
  return (
    <section
      ref={regionRef}
      aria-label={isScrollable ? label : undefined}
      tabIndex={isScrollable ? 0 : undefined}
      className={cn(
        'relative w-full overflow-auto ring-offset-background focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2',
        regionClassName
      )}
    >
      <table
        className={cn('w-full caption-bottom text-sm', className)}
        {...props}
      />
    </section>
  );
};

const TableHeader = ({
  className,
  ...props
}: React.ComponentProps<'thead'>) => (
  <thead className={cn('[&_tr]:border-b', className)} {...props} />
);

const TableBody = ({ className, ...props }: React.ComponentProps<'tbody'>) => (
  <tbody className={cn('[&_tr:last-child]:border-0', className)} {...props} />
);

const TableFooter = ({
  className,
  ...props
}: React.ComponentProps<'tfoot'>) => (
  <tfoot
    className={cn(
      'border-t bg-muted/50 font-medium last:[&>tr]:border-b-0',
      className
    )}
    {...props}
  />
);

const TableRow = ({ className, ...props }: React.ComponentProps<'tr'>) => (
  <tr
    className={cn(
      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className
    )}
    {...props}
  />
);

const TableHead = ({ className, ...props }: React.ComponentProps<'th'>) => (
  <th
    scope="col"
    className={cn(
      'h-10 px-2 text-left align-middle font-medium text-muted-foreground has-[[role=checkbox]]:pr-0 *:[[role=checkbox]]:translate-y-[2px]',
      className
    )}
    {...props}
  />
);

const TableCell = ({ className, ...props }: React.ComponentProps<'td'>) => (
  <td
    className={cn(
      'p-2 align-middle has-[[role=checkbox]]:pr-0 *:[[role=checkbox]]:translate-y-[2px]',
      className
    )}
    {...props}
  />
);

const TableRowHeader = ({
  className,
  ...props
}: React.ComponentProps<'th'>) => (
  <th
    scope="row"
    className={cn('p-2 text-left align-middle font-normal', className)}
    {...props}
  />
);

const TableCaption = ({
  className,
  ...props
}: React.ComponentProps<'caption'>) => (
  <caption
    className={cn('mt-4 text-sm text-muted-foreground', className)}
    {...props}
  />
);

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableRowHeader,
  TableCaption
};

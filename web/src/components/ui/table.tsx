'use client';

import * as React from 'react';

import { cn } from '@/lib/utils';

type TableProps = React.HTMLAttributes<HTMLTableElement> &
  Record<'label', string> &
  Partial<Record<'regionClassName', string>>;

const Table = React.forwardRef<HTMLTableElement, TableProps>(
  ({ className, label, regionClassName, ...props }, ref) => {
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
          ref={ref}
          className={cn('w-full caption-bottom text-sm', className)}
          {...props}
        />
      </section>
    );
  }
);
Table.displayName = 'Table';

const TableHeader = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <thead ref={ref} className={cn('[&_tr]:border-b', className)} {...props} />
));
TableHeader.displayName = 'TableHeader';

const TableBody = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tbody
    ref={ref}
    className={cn('[&_tr:last-child]:border-0', className)}
    {...props}
  />
));
TableBody.displayName = 'TableBody';

const TableFooter = React.forwardRef<
  HTMLTableSectionElement,
  React.HTMLAttributes<HTMLTableSectionElement>
>(({ className, ...props }, ref) => (
  <tfoot
    ref={ref}
    className={cn(
      'border-t bg-muted/50 font-medium last:[&>tr]:border-b-0',
      className
    )}
    {...props}
  />
));
TableFooter.displayName = 'TableFooter';

const TableRow = React.forwardRef<
  HTMLTableRowElement,
  React.HTMLAttributes<HTMLTableRowElement>
>(({ className, ...props }, ref) => (
  <tr
    ref={ref}
    className={cn(
      'border-b transition-colors hover:bg-muted/50 data-[state=selected]:bg-muted',
      className
    )}
    {...props}
  />
));
TableRow.displayName = 'TableRow';

const TableHead = React.forwardRef<
  HTMLTableCellElement,
  React.ThHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <th
    ref={ref}
    scope="col"
    className={cn(
      'h-10 px-2 text-left align-middle font-medium text-muted-foreground has-[[role=checkbox]]:pr-0 *:[[role=checkbox]]:translate-y-[2px]',
      className
    )}
    {...props}
  />
));
TableHead.displayName = 'TableHead';

const TableCell = React.forwardRef<
  HTMLTableCellElement,
  React.TdHTMLAttributes<HTMLTableCellElement>
>(({ className, ...props }, ref) => (
  <td
    ref={ref}
    className={cn(
      'p-2 align-middle has-[[role=checkbox]]:pr-0 *:[[role=checkbox]]:translate-y-[2px]',
      className
    )}
    {...props}
  />
));
TableCell.displayName = 'TableCell';

const TableCaption = React.forwardRef<
  HTMLTableCaptionElement,
  React.HTMLAttributes<HTMLTableCaptionElement>
>(({ className, ...props }, ref) => (
  <caption
    ref={ref}
    className={cn('mt-4 text-sm text-muted-foreground', className)}
    {...props}
  />
));
TableCaption.displayName = 'TableCaption';

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption
};

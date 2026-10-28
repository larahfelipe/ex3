import type { FC, ReactNode } from 'react';

import { Button } from '@/components/ui';
import { FIRST_PAGE } from '@/lib/pagination';

type PageNavigationProps = Record<'label', string> &
  Record<'page' | 'totalPages', number> &
  Partial<Record<'detail', string>> &
  Record<'onPageChange', (page: number) => void>;

type PageStepButtonProps = Record<'isUnavailable', boolean> &
  Record<'onStep', VoidFunction> &
  Record<'children', ReactNode>;

/**
 * `aria-disabled` instead of `disabled`: reaching the first or the last page
 * would disable the button that has focus, and the browser drops that focus to
 * `<body>`.
 */
const PageStepButton: FC<PageStepButtonProps> = ({
  isUnavailable,
  onStep,
  children
}) => (
  <Button
    variant="secondary"
    size="sm"
    aria-disabled={isUnavailable}
    onClick={() => {
      if (!isUnavailable) onStep();
    }}
  >
    {children}
  </Button>
);

export const PageNavigation: FC<PageNavigationProps> = ({
  label,
  page,
  totalPages,
  detail,
  onPageChange
}) => {
  const position = `Page ${page} of ${totalPages}`;

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3">
      <PageStepButton
        isUnavailable={page <= FIRST_PAGE}
        onStep={() => onPageChange(page - 1)}
      >
        Previous
      </PageStepButton>

      <span aria-live="polite" className="text-sm text-muted-foreground">
        {detail === undefined ? position : `${position} · ${detail}`}
      </span>

      <PageStepButton
        isUnavailable={page >= totalPages}
        onStep={() => onPageChange(page + 1)}
      >
        Next
      </PageStepButton>
    </nav>
  );
};

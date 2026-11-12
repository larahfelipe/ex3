import type { FC, ReactNode } from 'react';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { Button } from '@/components/ui';
import { FIRST_PAGE } from '@/lib/pagination';

type PageNavigationProps = Record<'label', string> &
  Record<'page' | 'totalPages', number> &
  Partial<Record<'detail', string>> &
  Record<'onPageChange', (page: number) => void>;

type PageStepButtonProps = Record<'label', string> &
  Record<'isUnavailable', boolean> &
  Record<'onStep', VoidFunction> &
  Record<'children', ReactNode>;

/**
 * `aria-disabled` instead of `disabled`: reaching the first or the last page
 * would disable the button that has focus, and the browser drops that focus to
 * `<body>`.
 */
const PageStepButton: FC<PageStepButtonProps> = ({
  label,
  isUnavailable,
  onStep,
  children
}) => (
  <Button
    variant="outline"
    size="icon"
    aria-label={label}
    title={label}
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
  const t = useTranslations('common.pagination');

  return (
    <nav aria-label={label} className="flex items-center justify-between gap-3">
      <span aria-live="polite" className="text-sm text-muted-foreground">
        {detail === undefined
          ? t('position', { page, totalPages })
          : t('positionWithDetail', { page, totalPages, detail })}
      </span>

      <div className="flex shrink-0 items-center gap-2">
        <PageStepButton
          label={t('previous')}
          isUnavailable={page <= FIRST_PAGE}
          onStep={() => onPageChange(page - 1)}
        >
          <ChevronLeft aria-hidden="true" className="size-4" />
        </PageStepButton>

        <PageStepButton
          label={t('next')}
          isUnavailable={page >= totalPages}
          onStep={() => onPageChange(page + 1)}
        >
          <ChevronRight aria-hidden="true" className="size-4" />
        </PageStepButton>
      </div>
    </nav>
  );
};

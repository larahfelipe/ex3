import type { FC } from 'react';

import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { IconButton } from '@/components/ui';
import { FIRST_PAGE } from '@/lib/pagination';

type PageNavigationProps = Record<'label', string> &
  Record<'page' | 'totalPages', number> &
  Partial<Record<'detail', string>> &
  Record<'onPageChange', (page: number) => void>;

type PageStepButtonProps = Record<'label', string> &
  Record<'isUnavailable', boolean> &
  Record<'onStep', VoidFunction> &
  Record<'icon', LucideIcon>;

const PageStepButton: FC<PageStepButtonProps> = ({
  label,
  isUnavailable,
  onStep,
  icon
}) => (
  <IconButton
    icon={icon}
    variant="outline"
    size="icon"
    label={label}
    aria-disabled={isUnavailable}
    onClick={() => {
      if (!isUnavailable) onStep();
    }}
  />
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
          icon={ChevronLeft}
          label={t('previous')}
          isUnavailable={page <= FIRST_PAGE}
          onStep={() => onPageChange(page - 1)}
        />

        <PageStepButton
          icon={ChevronRight}
          label={t('next')}
          isUnavailable={page >= totalPages}
          onStep={() => onPageChange(page + 1)}
        />
      </div>
    </nav>
  );
};

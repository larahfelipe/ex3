import type { FC, ReactNode } from 'react';

import Link from 'next/link';

import { LoaderCircle, TriangleAlert } from 'lucide-react';
import { useTranslations } from 'use-intl';

import { Button, Skeleton } from '@/components/ui';
import { APPEAR_CLASS } from '@/lib/motion';
import { cn } from '@/lib/utils';

type StateAction = Record<'label', string> &
  (Record<'onSelect', VoidFunction> | Record<'href', string>);

type LoadingStateProps = Record<'label', string> &
  Partial<Record<'className', string>> &
  Partial<Record<'children', ReactNode>>;

type EmptyStateProps = Record<'message', string> &
  Partial<Record<'action', StateAction>>;

type NoResultsStateProps = Record<'message', string> &
  Record<'onClear', VoidFunction>;

type ErrorStateProps = Record<'message', string> &
  Record<'onRetry', VoidFunction>;

type StaleStateProps = Omit<ErrorStateProps, 'message'> &
  Partial<Record<'message', string>> &
  Record<'isRetrying', boolean>;

const StateActionButton: FC<StateAction> = (action) =>
  'href' in action ? (
    <Button asChild variant="secondary" size="sm" className="max-sm:w-full">
      <Link href={action.href}>{action.label}</Link>
    </Button>
  ) : (
    <Button
      variant="secondary"
      size="sm"
      className="max-sm:w-full"
      onClick={() => action.onSelect()}
    >
      {action.label}
    </Button>
  );

export const LoadingState: FC<LoadingStateProps> = ({
  label,
  className,
  children
}) => (
  <output aria-busy="true" className="block">
    <span className="sr-only">{label}</span>

    {children ?? (
      <Skeleton
        aria-hidden="true"
        className={cn('h-40 w-full rounded-xl', className)}
      />
    )}
  </output>
);

export const EmptyState: FC<EmptyStateProps> = ({ message, action }) => (
  <div className={cn('flex flex-col items-start gap-3', APPEAR_CLASS)}>
    <p className="text-sm text-muted-foreground">{message}</p>

    {action && <StateActionButton {...action} />}
  </div>
);

export const NoResultsState: FC<NoResultsStateProps> = ({
  message,
  onClear
}) => {
  const t = useTranslations('common.actions');

  return (
    <EmptyState
      message={message}
      action={{ label: t('clearRefinements'), onSelect: onClear }}
    />
  );
};

export const ErrorState: FC<ErrorStateProps> = ({ message, onRetry }) => {
  const t = useTranslations('common.actions');

  return (
    <div
      role="alert"
      className={cn('flex flex-col items-start gap-3', APPEAR_CLASS)}
    >
      <p className="text-sm text-negative">{message}</p>

      <StateActionButton label={t('retry')} onSelect={onRetry} />
    </div>
  );
};

/** Data shown from before a refresh that failed; the message defaults to saying so. */
export const StaleState: FC<StaleStateProps> = ({
  message,
  onRetry,
  isRetrying
}) => {
  const t = useTranslations('common');

  return (
    <div
      role="alert"
      className="flex flex-col items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3 sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="flex items-center gap-2 text-sm text-warning">
        <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />

        {message ?? t('states.stale')}
      </p>

      <Button
        variant="secondary"
        size="sm"
        className="gap-2 max-sm:w-full"
        onClick={() => onRetry()}
      >
        {isRetrying && (
          <LoaderCircle aria-hidden="true" className="size-4 animate-spin" />
        )}

        {t('actions.retry')}
      </Button>
    </div>
  );
};

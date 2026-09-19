import type { FC, ReactNode } from 'react';

import Link from 'next/link';

import { LoaderCircle, TriangleAlert } from 'lucide-react';
import { twMerge } from 'tailwind-merge';

import { Button, Skeleton } from '@/components/ui';

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

type StaleStateProps = ErrorStateProps & Record<'isRetrying', boolean>;

const RETRY_LABEL = 'Try again';

const CLEAR_REFINEMENTS_LABEL = 'Clear search and filters';

const StateActionButton: FC<StateAction> = (action) =>
  'href' in action ? (
    <Button asChild variant="secondary" className="h-9 max-sm:w-full">
      <Link href={action.href}>{action.label}</Link>
    </Button>
  ) : (
    <Button
      variant="secondary"
      className="h-9 max-sm:w-full"
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
        className={twMerge('h-40 w-full rounded-xl', className)}
      />
    )}
  </output>
);

export const EmptyState: FC<EmptyStateProps> = ({ message, action }) => (
  <div className="flex flex-col items-start gap-3">
    <p className="text-sm text-muted-foreground">{message}</p>

    {action && <StateActionButton {...action} />}
  </div>
);

export const NoResultsState: FC<NoResultsStateProps> = ({
  message,
  onClear
}) => (
  <EmptyState
    message={message}
    action={{ label: CLEAR_REFINEMENTS_LABEL, onSelect: onClear }}
  />
);

export const ErrorState: FC<ErrorStateProps> = ({ message, onRetry }) => (
  <div role="alert" className="flex flex-col items-start gap-3">
    <p className="text-sm text-negative">{message}</p>

    <StateActionButton label={RETRY_LABEL} onSelect={onRetry} />
  </div>
);

export const StaleState: FC<StaleStateProps> = ({
  message,
  onRetry,
  isRetrying
}) => (
  <div
    role="alert"
    className="flex flex-col items-start gap-3 rounded-xl border border-warning/30 bg-warning/10 p-3 sm:flex-row sm:items-center sm:justify-between"
  >
    <p className="flex items-center gap-2 text-sm text-warning">
      <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />

      {message}
    </p>

    <Button
      variant="secondary"
      className="h-9 gap-2 max-sm:w-full"
      onClick={() => onRetry()}
    >
      {isRetrying && (
        <LoaderCircle
          aria-hidden="true"
          className="size-4 motion-safe:animate-spin"
        />
      )}

      {RETRY_LABEL}
    </Button>
  </div>
);

'use client';

import {
  useId,
  useRef,
  useState,
  type ComponentProps,
  type FC,
  type ReactElement
} from 'react';

import Link from 'next/link';

import {
  Bell,
  CalendarClock,
  Check,
  CheckCheck,
  CircleAlert,
  X,
  type LucideIcon
} from 'lucide-react';
import { useTranslations } from 'use-intl';

import type {
  FinanceNotification,
  FinanceNotificationKind
} from '@/app/api/v1/finances';
import { APP_ROUTES, billDetailRoute } from '@/common/constants';
import { EmptyState, ErrorState, LoadingState } from '@/components/data-state';
import { Money } from '@/components/financial';
import {
  Button,
  IconButton,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Skeleton,
  TruncatedText
} from '@/components/ui';
import {
  useFinanceNotifications,
  useMarkFinanceNotifications,
  useReferenceDay
} from '@/hooks/use-finances';
import { daysBetween } from '@/lib/dates';
import { cn } from '@/lib/utils';

type NotificationsPopoverProps = Pick<
  ComponentProps<typeof PopoverContent>,
  'side' | 'align'
> &
  Record<'renderTrigger', (unreadCount: number) => ReactElement>;

type NotificationItemProps = Record<'notification', FinanceNotification> &
  Record<'today', string> &
  Record<'onOpen' | 'onMarkRead' | 'onDismiss', VoidFunction>;

const KIND_ICONS: Record<FinanceNotificationKind, LucideIcon> = {
  OVERDUE: CircleAlert,
  DUE_SOON: CalendarClock
};

const KIND_TONES: Record<FinanceNotificationKind, string> = {
  OVERDUE: 'bg-negative/10 text-negative',
  DUE_SOON: 'bg-warning/10 text-warning'
};

const PLACEHOLDER_ROWS = 3;

export const NotificationItem: FC<NotificationItemProps> = ({
  notification: { kind, isRead, notifiedOn, expense },
  today,
  onOpen,
  onMarkRead,
  onDismiss
}) => {
  const t = useTranslations('notifications');
  const tDisplay = useTranslations('finances.display');
  const Icon = KIND_ICONS[kind];
  const daysToDue = daysBetween(today, expense.dueDate) ?? 0;

  return (
    <li className="relative flex items-start gap-1 py-1 pr-2 pl-1 transition-colors hover:bg-accent/60 sm:pr-1.5">
      {!isRead && (
        <span
          aria-hidden="true"
          className="absolute top-1/2 left-1 size-1.5 -translate-y-1/2 rounded-full bg-primary"
        />
      )}

      <Link
        href={billDetailRoute(expense.id)}
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-start gap-3 rounded-md py-2 pr-1 pl-3 outline-hidden focus-visible:ring-2 focus-visible:ring-focus"
      >
        <span
          aria-hidden="true"
          className={cn(
            'mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full',
            KIND_TONES[kind]
          )}
        >
          <Icon size={16} />
        </span>

        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-baseline gap-2">
            {!isRead && <span className="sr-only">{t('unread')}</span>}

            <TruncatedText
              className={cn(
                'min-w-0 flex-1 truncate text-sm',
                isRead ? 'text-muted-foreground' : 'font-semibold'
              )}
            >
              {expense.description}
            </TruncatedText>

            <time
              dateTime={notifiedOn}
              className="shrink-0 text-xs text-muted-foreground tabular-nums"
            >
              {t('notifiedOn', {
                days: Math.max(daysBetween(notifiedOn, today) ?? 0, 0)
              })}
            </time>
          </span>

          <span className="text-xs text-muted-foreground">
            <span className={cn(kind === 'OVERDUE' && 'text-negative')}>
              {daysToDue < 0
                ? tDisplay('overdueBy', { days: -daysToDue })
                : tDisplay('dueIn', { days: daysToDue })}
            </span>

            <span aria-hidden="true">{' · '}</span>

            <span className="tabular-nums">
              <Money
                value={expense.outstandingAmount}
                currency={expense.currency}
              />
            </span>
          </span>
        </span>
      </Link>

      <span className="flex shrink-0 items-center pt-1.5">
        {!isRead && (
          <IconButton
            icon={Check}
            label={t('markRead')}
            aria-label={t('markReadNamed', {
              description: expense.description
            })}
            onClick={onMarkRead}
          />
        )}

        <IconButton
          icon={X}
          label={t('dismiss')}
          aria-label={t('dismissNamed', { description: expense.description })}
          onClick={onDismiss}
        />
      </span>
    </li>
  );
};

export const NotificationsPopover: FC<NotificationsPopoverProps> = ({
  side,
  align,
  renderTrigger
}) => {
  const t = useTranslations('notifications');
  const tStates = useTranslations('common.states');
  const titleId = useId();
  const contentRef = useRef<HTMLDivElement>(null);
  const [isOpen, setIsOpen] = useState(false);
  const today = useReferenceDay();

  const { data: feed, isPending, isError, refetch } = useFinanceNotifications();
  const { mutate: mark } = useMarkFinanceNotifications();

  const unreadCount = feed?.unreadCount ?? 0;
  const notifications = feed?.notifications ?? [];

  const close = () => setIsOpen(false);

  const renderBody = () => {
    if (isPending)
      return (
        <LoadingState label={tStates('loading')}>
          <span aria-hidden="true" className="flex flex-col gap-4 p-4">
            {Array.from({ length: PLACEHOLDER_ROWS }, (_, row) => (
              <span key={row} className="flex items-center gap-3">
                <Skeleton className="size-8 rounded-full" />

                <span className="flex flex-1 flex-col gap-1.5">
                  <Skeleton className="h-3.5 w-3/5" />

                  <Skeleton className="h-3 w-2/5" />
                </span>
              </span>
            ))}
          </span>
        </LoadingState>
      );

    if (isError)
      return (
        <div className="p-4">
          <ErrorState message={t('loadFailed')} onRetry={() => refetch()} />
        </div>
      );

    if (notifications.length === 0)
      return (
        <div className="p-4">
          <EmptyState icon={Bell} message={t('empty')} />
        </div>
      );

    return (
      <>
        <ul className="divide-y">
          {notifications.map((notification) => {
            const keys = [notification.key];

            return (
              <NotificationItem
                key={notification.key}
                notification={notification}
                today={today}
                onOpen={() => {
                  if (!notification.isRead) mark({ action: 'READ', keys });

                  close();
                }}
                onMarkRead={() => mark({ action: 'READ', keys })}
                onDismiss={() => mark({ action: 'DISMISS', keys })}
              />
            );
          })}
        </ul>

        {feed && feed.total > notifications.length && (
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            {t('partial', { shown: notifications.length, total: feed.total })}
          </p>
        )}
      </>
    );
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>{renderTrigger(unreadCount)}</PopoverTrigger>

      <PopoverContent
        ref={contentRef}
        side={side}
        align={align}
        sideOffset={8}
        collisionPadding={8}
        aria-labelledby={titleId}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          contentRef.current?.focus();
        }}
        className="flex max-h-[min(36rem,var(--radix-popover-content-available-height))] w-[min(24rem,calc(100vw-1rem))] flex-col p-0"
      >
        <div className="flex items-center gap-2 border-b py-1.5 pr-1.5 pl-4">
          <h2 id={titleId} className="text-sm font-semibold">
            {t('label')}
          </h2>

          {unreadCount > 0 && (
            <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-xs leading-none font-semibold text-primary tabular-nums">
              {unreadCount}
            </span>
          )}

          <IconButton
            icon={CheckCheck}
            label={t('markAllRead')}
            aria-disabled={unreadCount === 0}
            className="ml-auto"
            onClick={() => {
              if (unreadCount > 0) mark({ action: 'READ' });
            }}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {renderBody()}
        </div>

        <div className="flex items-center justify-between gap-2 border-t p-1.5">
          <Button asChild variant="ghost" size="xs">
            <Link href={APP_ROUTES.Protected.FinanceBills} onClick={close}>
              {t('viewBills')}
            </Link>
          </Button>

          {notifications.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              className="text-muted-foreground"
              onClick={() => mark({ action: 'DISMISS' })}
            >
              {t('clearAll')}
            </Button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

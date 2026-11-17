import type { NotificationMarkAction } from '@/domain/FinanceNotifications';

import {
  activeNotificationsFor,
  notificationFeedFor,
  type NotificationFeed,
  type NotificationSources
} from './FinanceNotificationFeed';

export class MarkFinanceNotificationsService {
  private static INSTANCE: MarkFinanceNotificationsService;
  private readonly sources: NotificationSources;

  private constructor(sources: NotificationSources) {
    this.sources = sources;
  }

  static getInstance(sources: NotificationSources) {
    if (!MarkFinanceNotificationsService.INSTANCE)
      MarkFinanceNotificationsService.INSTANCE =
        new MarkFinanceNotificationsService(sources);

    return MarkFinanceNotificationsService.INSTANCE;
  }

  async execute({
    userId,
    today,
    action,
    keys
  }: MarkFinanceNotificationsService.DTO): Promise<NotificationFeed> {
    const activeKeys = new Set(
      (await activeNotificationsFor(this.sources, { userId, today })).map(
        ({ key }) => key
      )
    );
    const targets =
      keys === undefined
        ? [...activeKeys]
        : [...new Set(keys)].filter((key) => activeKeys.has(key));

    if (targets.length > 0)
      await this.sources.financeNotificationRepository.mark({
        userId,
        keys: targets,
        action,
        at: new Date()
      });

    return notificationFeedFor(this.sources, { userId, today });
  }
}

namespace MarkFinanceNotificationsService {
  export type DTO = Record<'userId', string> &
    Record<'today', Date> &
    Record<'action', NotificationMarkAction> &
    Partial<Record<'keys', ReadonlyArray<string>>>;
}

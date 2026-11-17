import {
  notificationFeedFor,
  type NotificationFeed,
  type NotificationSources
} from './FinanceNotificationFeed';

export class GetFinanceNotificationsService {
  private static INSTANCE: GetFinanceNotificationsService;
  private readonly sources: NotificationSources;

  private constructor(sources: NotificationSources) {
    this.sources = sources;
  }

  static getInstance(sources: NotificationSources) {
    if (!GetFinanceNotificationsService.INSTANCE)
      GetFinanceNotificationsService.INSTANCE =
        new GetFinanceNotificationsService(sources);

    return GetFinanceNotificationsService.INSTANCE;
  }

  async execute(
    query: GetFinanceNotificationsService.DTO
  ): Promise<NotificationFeed> {
    return notificationFeedFor(this.sources, query);
  }
}

namespace GetFinanceNotificationsService {
  export type DTO = Record<'userId', string> & Record<'today', Date>;
}

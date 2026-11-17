import type {
  NotificationMarkAction,
  NotificationMarks
} from '@/domain/FinanceNotifications';

import { PrismaClient } from './PrismaClient';

const MARKS_SELECT = { key: true, readAt: true, dismissedAt: true } as const;

export class FinanceNotificationRepository {
  private static INSTANCE: FinanceNotificationRepository;
  private prismaClient: PrismaClient;

  private constructor() {
    this.prismaClient = PrismaClient.getInstance();
  }

  static getInstance() {
    if (!FinanceNotificationRepository.INSTANCE)
      FinanceNotificationRepository.INSTANCE =
        new FinanceNotificationRepository();

    return FinanceNotificationRepository.INSTANCE;
  }

  async getMarks({
    userId,
    activeKeys
  }: FinanceNotificationRepository.MarksQuery): Promise<
    Array<NotificationMarks>
  > {
    return this.prismaClient.runSerializable(async (transactionClient) => {
      await transactionClient.financeNotificationMark.deleteMany({
        where: { userId, key: { notIn: [...activeKeys] } }
      });

      return transactionClient.financeNotificationMark.findMany({
        where: { userId },
        select: MARKS_SELECT
      });
    });
  }

  async mark({
    userId,
    keys,
    action,
    at
  }: FinanceNotificationRepository.MarkParams) {
    const isDismissal = action === 'DISMISS';

    await this.prismaClient.runSerializable(async (transactionClient) => {
      const marks = transactionClient.financeNotificationMark;
      const ofKeys = { userId, key: { in: [...keys] } };

      await marks.createMany({
        data: keys.map((key) => ({
          userId,
          key,
          readAt: at,
          dismissedAt: isDismissal ? at : null
        })),
        skipDuplicates: true
      });
      await marks.updateMany({
        where: { ...ofKeys, readAt: null },
        data: { readAt: at }
      });

      if (isDismissal)
        await marks.updateMany({
          where: { ...ofKeys, dismissedAt: null },
          data: { dismissedAt: at }
        });
    });
  }
}

namespace FinanceNotificationRepository {
  export type MarksQuery = Record<'userId', string> &
    Record<'activeKeys', ReadonlyArray<string>>;
  export type MarkParams = Record<'userId', string> &
    Record<'keys', ReadonlyArray<string>> &
    Record<'action', NotificationMarkAction> &
    Record<'at', Date>;
}

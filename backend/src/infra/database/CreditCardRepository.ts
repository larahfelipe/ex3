import type { CreditCard as CreditCardRow } from '@prisma/client';

import { cardDueDateOf } from '@/domain/CardStatement';
import type { CardBrand, CreditCard } from '@/domain/models';

import {
  changesOf,
  recordFinanceEvent,
  UNPAID_EXPENSE_WHERE
} from './FinanceRecords';
import { PrismaClient } from './PrismaClient';

const toCreditCard = (
  row: CreditCardRow,
  unpaidBillCount: number
): CreditCard => ({
  id: row.id,
  name: row.name,
  lastFourDigits: row.lastFourDigits,
  brand: row.brand,
  closingDay: row.closingDay,
  dueDay: row.dueDay,
  unpaidBillCount,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt
});

export class CreditCardRepository {
  private static INSTANCE: CreditCardRepository;
  private prismaClient: PrismaClient;

  private constructor() {
    this.prismaClient = PrismaClient.getInstance();
  }

  static getInstance() {
    if (!CreditCardRepository.INSTANCE)
      CreditCardRepository.INSTANCE = new CreditCardRepository();

    return CreditCardRepository.INSTANCE;
  }

  async getAll(userId: string): Promise<Array<CreditCard>> {
    const rows = await this.prismaClient.creditCard.findMany({
      where: { userId, deletedAt: null },
      orderBy: [{ name: 'asc' }, { createdAt: 'asc' }, { id: 'asc' }]
    });

    if (rows.length === 0) return [];

    const groups = await this.prismaClient.expense.groupBy({
      by: ['creditCardId'],
      where: {
        userId,
        creditCardId: { in: rows.map(({ id }) => id) },
        ...UNPAID_EXPENSE_WHERE
      },
      _count: { _all: true }
    });
    const counts = new Map(
      groups.map(({ creditCardId, _count }) => [creditCardId, _count._all])
    );

    return rows.map((row) => toCreditCard(row, counts.get(row.id) ?? 0));
  }

  async add(params: CreditCardRepository.AddParams) {
    const row = await this.prismaClient.creditCard.create({ data: params });

    return row.id;
  }

  async update(
    params: CreditCardRepository.UpdateParams
  ): Promise<CreditCardRepository.Write> {
    const { id, userId, ...patch } = params;

    return this.prismaClient.runSerializable<CreditCardRepository.Write>(
      async (transactionClient) => {
        const current = await transactionClient.creditCard.findFirst({
          where: { id, userId, deletedAt: null }
        });

        if (!current) return { outcome: 'not-found' };

        const cycle = {
          closingDay: patch.closingDay ?? current.closingDay,
          dueDay: patch.dueDay ?? current.dueDay
        };

        if (cycle.closingDay === cycle.dueDay) return { outcome: 'same-days' };

        await transactionClient.creditCard.update({
          where: { id },
          data: patch
        });

        if (
          cycle.closingDay === current.closingDay &&
          cycle.dueDay === current.dueDay
        )
          return { outcome: 'written', movedBills: 0 };

        const bills = await transactionClient.expense.findMany({
          where: { userId, creditCardId: id, ...UNPAID_EXPENSE_WHERE },
          select: { id: true, dueDate: true, originalDueDate: true }
        });
        let movedBills = 0;

        for (const bill of bills) {
          if (bill.originalDueDate === null) continue;

          const dueDate = cardDueDateOf(cycle, bill.originalDueDate);

          if (dueDate.getTime() === bill.dueDate.getTime()) continue;

          await transactionClient.expense.update({
            where: { id: bill.id },
            data: { dueDate }
          });
          await recordFinanceEvent(transactionClient, {
            userId,
            recordType: 'EXPENSE',
            recordId: bill.id,
            type: 'UPDATED',
            changes: changesOf(bill, { dueDate })
          });
          movedBills += 1;
        }

        return { outcome: 'written', movedBills };
      }
    );
  }

  async delete(
    params: CreditCardRepository.GetByIdParams
  ): Promise<CreditCardRepository.DeleteWrite> {
    const { id, userId } = params;

    const { count } = await this.prismaClient.creditCard.updateMany({
      where: { id, userId, deletedAt: null },
      data: { deletedAt: new Date() }
    });

    return count === 0 ? { outcome: 'not-found' } : { outcome: 'written' };
  }
}

namespace CreditCardRepository {
  export type GetByIdParams = Record<'id' | 'userId', string>;
  export type AddParams = Record<'userId' | 'name' | 'lastFourDigits', string> &
    Record<'brand', CardBrand> &
    Record<'closingDay' | 'dueDay', number>;
  export type UpdateParams = GetByIdParams & Partial<Omit<AddParams, 'userId'>>;
  export type Write =
    | { outcome: 'written'; movedBills: number }
    | { outcome: 'not-found' }
    | { outcome: 'same-days' };
  export type DeleteWrite = { outcome: 'written' } | { outcome: 'not-found' };
}

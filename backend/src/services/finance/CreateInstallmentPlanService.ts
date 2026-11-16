import { FinanceMessages } from '@/config/Constants';
import { utcToday } from '@/domain/CalendarDay';
import {
  scheduleInstallments,
  type InstallmentTerms
} from '@/domain/InstallmentSchedule';
import type { ExpenseDescription } from '@/domain/models';
import type { InstallmentPlanRepository } from '@/infra/database';

import { financeRefusalError } from './FinanceRefusalError';

export class CreateInstallmentPlanService {
  private static INSTANCE: CreateInstallmentPlanService;
  private readonly installmentPlanRepository: InstallmentPlanRepository;

  private constructor(installmentPlanRepository: InstallmentPlanRepository) {
    this.installmentPlanRepository = installmentPlanRepository;
  }

  static getInstance(installmentPlanRepository: InstallmentPlanRepository) {
    if (!CreateInstallmentPlanService.INSTANCE)
      CreateInstallmentPlanService.INSTANCE = new CreateInstallmentPlanService(
        installmentPlanRepository
      );

    return CreateInstallmentPlanService.INSTANCE;
  }

  async execute({
    amount,
    installmentCount,
    firstDueDate,
    entryDate,
    ...plan
  }: CreateInstallmentPlanService.DTO): Promise<CreateInstallmentPlanService.Result> {
    const installments = scheduleInstallments({
      amount,
      count: installmentCount,
      firstDueDate,
      frequency: plan.frequency,
      currency: plan.currency,
      firstNumber: 1
    });

    if (installments === null)
      throw financeRefusalError(
        { outcome: 'split-too-small' },
        'INSTALLMENT_PLAN'
      );

    const write = await this.installmentPlanRepository.add({
      ...plan,
      entryDate: entryDate ?? utcToday(),
      installments
    });

    if (write.outcome !== 'written')
      throw financeRefusalError(write, 'INSTALLMENT_PLAN');

    return { id: write.id, message: FinanceMessages.PLAN_CREATED };
  }
}

namespace CreateInstallmentPlanService {
  export type DTO = ExpenseDescription &
    Pick<InstallmentTerms, 'amount' | 'frequency'> &
    Record<'currency' | 'userId', string> &
    Record<'principalAmount' | 'creditCardId', string | null> &
    Record<'installmentCount', number> &
    Record<'firstDueDate', Date> &
    Partial<Record<'entryDate', Date>>;
  export type Result = Record<'id' | 'message', string>;
}

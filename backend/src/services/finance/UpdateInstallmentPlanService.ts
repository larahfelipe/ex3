import { FinanceMessages } from '@/config/Constants';
import type { ExpenseDescription } from '@/domain/models';
import { NotFoundError } from '@/errors';
import type { InstallmentPlanRepository } from '@/infra/database';

import { financeRefusalError } from './FinanceRefusalError';

export class UpdateInstallmentPlanService {
  private static INSTANCE: UpdateInstallmentPlanService;
  private readonly installmentPlanRepository: InstallmentPlanRepository;

  private constructor(installmentPlanRepository: InstallmentPlanRepository) {
    this.installmentPlanRepository = installmentPlanRepository;
  }

  static getInstance(installmentPlanRepository: InstallmentPlanRepository) {
    if (!UpdateInstallmentPlanService.INSTANCE)
      UpdateInstallmentPlanService.INSTANCE = new UpdateInstallmentPlanService(
        installmentPlanRepository
      );

    return UpdateInstallmentPlanService.INSTANCE;
  }

  async execute(
    params: UpdateInstallmentPlanService.DTO
  ): Promise<UpdateInstallmentPlanService.Result> {
    const write = await this.installmentPlanRepository.update(params);

    if (write.outcome === 'not-found')
      throw new NotFoundError(FinanceMessages.INSTALLMENT_PLAN_NOT_FOUND);

    if (write.outcome !== 'written')
      throw financeRefusalError(write, 'INSTALLMENT_PLAN');

    return { message: FinanceMessages.PLAN_UPDATED };
  }
}

namespace UpdateInstallmentPlanService {
  export type DTO = Record<'id' | 'userId', string> &
    Partial<ExpenseDescription> &
    Partial<Record<'principalAmount', string | null>>;
  export type Result = Record<'message', string>;
}

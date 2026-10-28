import { FinanceMessages } from '@/config/Constants';
import { NotFoundError } from '@/errors';
import type { InstallmentPlanRepository } from '@/infra/database';

import { financeRefusalError } from './FinanceRefusalError';

export class CancelInstallmentPlanService {
  private static INSTANCE: CancelInstallmentPlanService;
  private readonly installmentPlanRepository: InstallmentPlanRepository;

  private constructor(installmentPlanRepository: InstallmentPlanRepository) {
    this.installmentPlanRepository = installmentPlanRepository;
  }

  static getInstance(installmentPlanRepository: InstallmentPlanRepository) {
    if (!CancelInstallmentPlanService.INSTANCE)
      CancelInstallmentPlanService.INSTANCE = new CancelInstallmentPlanService(
        installmentPlanRepository
      );

    return CancelInstallmentPlanService.INSTANCE;
  }

  async execute(
    params: CancelInstallmentPlanService.DTO
  ): Promise<CancelInstallmentPlanService.Result> {
    const write = await this.installmentPlanRepository.cancel(params);

    if (write.outcome === 'not-found')
      throw new NotFoundError(FinanceMessages.INSTALLMENT_PLAN_NOT_FOUND);

    if (write.outcome !== 'written')
      throw financeRefusalError(write, 'INSTALLMENT_PLAN');

    return { message: FinanceMessages.PLAN_CANCELLED_SUCCESSFULLY };
  }
}

namespace CancelInstallmentPlanService {
  export type DTO = Record<'id' | 'userId', string>;
  export type Result = Record<'message', string>;
}

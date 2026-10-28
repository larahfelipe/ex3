import { FinanceMessages } from '@/config/Constants';
import { NotFoundError } from '@/errors';
import type { InstallmentPlanRepository } from '@/infra/database';

import { financeRefusalError } from './FinanceRefusalError';

export class DeleteInstallmentPlanService {
  private static INSTANCE: DeleteInstallmentPlanService;
  private readonly installmentPlanRepository: InstallmentPlanRepository;

  private constructor(installmentPlanRepository: InstallmentPlanRepository) {
    this.installmentPlanRepository = installmentPlanRepository;
  }

  static getInstance(installmentPlanRepository: InstallmentPlanRepository) {
    if (!DeleteInstallmentPlanService.INSTANCE)
      DeleteInstallmentPlanService.INSTANCE = new DeleteInstallmentPlanService(
        installmentPlanRepository
      );

    return DeleteInstallmentPlanService.INSTANCE;
  }

  async execute(
    params: DeleteInstallmentPlanService.DTO
  ): Promise<DeleteInstallmentPlanService.Result> {
    const write = await this.installmentPlanRepository.delete(params);

    if (write.outcome === 'not-found')
      throw new NotFoundError(FinanceMessages.INSTALLMENT_PLAN_NOT_FOUND);

    if (write.outcome !== 'written')
      throw financeRefusalError(write, 'INSTALLMENT_PLAN');

    return { message: FinanceMessages.PLAN_DELETED };
  }
}

namespace DeleteInstallmentPlanService {
  export type DTO = Record<'id' | 'userId', string>;
  export type Result = Record<'message', string>;
}

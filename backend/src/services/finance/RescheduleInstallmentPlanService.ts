import { FinanceMessages } from '@/config/Constants';
import { NotFoundError } from '@/errors';
import type { InstallmentPlanRepository } from '@/infra/database';

import { financeRefusalError } from './FinanceRefusalError';

/** Changes what is still to pay; the installments with payments, and the ones before them, stay as they are. */
export class RescheduleInstallmentPlanService {
  private static INSTANCE: RescheduleInstallmentPlanService;
  private readonly installmentPlanRepository: InstallmentPlanRepository;

  private constructor(installmentPlanRepository: InstallmentPlanRepository) {
    this.installmentPlanRepository = installmentPlanRepository;
  }

  static getInstance(installmentPlanRepository: InstallmentPlanRepository) {
    if (!RescheduleInstallmentPlanService.INSTANCE)
      RescheduleInstallmentPlanService.INSTANCE =
        new RescheduleInstallmentPlanService(installmentPlanRepository);

    return RescheduleInstallmentPlanService.INSTANCE;
  }

  async execute(
    params: RescheduleInstallmentPlanService.DTO
  ): Promise<RescheduleInstallmentPlanService.Result> {
    const write = await this.installmentPlanRepository.reschedule(params);

    if (write.outcome === 'not-found')
      throw new NotFoundError(FinanceMessages.INSTALLMENT_PLAN_NOT_FOUND);

    if (write.outcome !== 'written')
      throw financeRefusalError(write, 'INSTALLMENT_PLAN');

    return { message: FinanceMessages.PLAN_RESCHEDULED };
  }
}

namespace RescheduleInstallmentPlanService {
  export type DTO = Record<'id' | 'userId' | 'remainingAmount', string> &
    Record<'remainingCount', number> &
    Record<'nextDueDate', Date>;
  export type Result = Record<'message', string>;
}

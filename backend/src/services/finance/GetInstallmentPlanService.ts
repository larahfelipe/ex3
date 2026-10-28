import { FinanceMessages } from '@/config/Constants';
import { NotFoundError } from '@/errors';
import type {
  InstallmentPlanDetail,
  InstallmentPlanRepository
} from '@/infra/database';

export class GetInstallmentPlanService {
  private static INSTANCE: GetInstallmentPlanService;
  private readonly installmentPlanRepository: InstallmentPlanRepository;

  private constructor(installmentPlanRepository: InstallmentPlanRepository) {
    this.installmentPlanRepository = installmentPlanRepository;
  }

  static getInstance(installmentPlanRepository: InstallmentPlanRepository) {
    if (!GetInstallmentPlanService.INSTANCE)
      GetInstallmentPlanService.INSTANCE = new GetInstallmentPlanService(
        installmentPlanRepository
      );

    return GetInstallmentPlanService.INSTANCE;
  }

  async execute(
    params: GetInstallmentPlanService.DTO
  ): Promise<GetInstallmentPlanService.Result> {
    const plan = await this.installmentPlanRepository.getById(params);

    if (!plan)
      throw new NotFoundError(FinanceMessages.INSTALLMENT_PLAN_NOT_FOUND);

    return plan;
  }
}

namespace GetInstallmentPlanService {
  export type DTO = Record<'id' | 'userId', string> & Record<'today', Date>;
  export type Result = InstallmentPlanDetail;
}

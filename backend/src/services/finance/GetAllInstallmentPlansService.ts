import type { InstallmentPlan } from '@/domain/models';
import type {
  InstallmentPlanListQuery,
  InstallmentPlanRepository
} from '@/infra/database';
import type { Page } from '@/interfaces';

export class GetAllInstallmentPlansService {
  private static INSTANCE: GetAllInstallmentPlansService;
  private readonly installmentPlanRepository: InstallmentPlanRepository;

  private constructor(installmentPlanRepository: InstallmentPlanRepository) {
    this.installmentPlanRepository = installmentPlanRepository;
  }

  static getInstance(installmentPlanRepository: InstallmentPlanRepository) {
    if (!GetAllInstallmentPlansService.INSTANCE)
      GetAllInstallmentPlansService.INSTANCE =
        new GetAllInstallmentPlansService(installmentPlanRepository);

    return GetAllInstallmentPlansService.INSTANCE;
  }

  async execute(
    query: GetAllInstallmentPlansService.DTO
  ): Promise<GetAllInstallmentPlansService.Result> {
    return this.installmentPlanRepository.getAll(query);
  }
}

namespace GetAllInstallmentPlansService {
  export type DTO = InstallmentPlanListQuery;
  export type Result = Page<InstallmentPlan>;
}

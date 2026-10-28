import type {
  FinanceReportRepository,
  FinanceSettings
} from '@/infra/database';

export class GetFinanceSettingsService {
  private static INSTANCE: GetFinanceSettingsService;
  private readonly financeReportRepository: FinanceReportRepository;

  private constructor(financeReportRepository: FinanceReportRepository) {
    this.financeReportRepository = financeReportRepository;
  }

  static getInstance(financeReportRepository: FinanceReportRepository) {
    if (!GetFinanceSettingsService.INSTANCE)
      GetFinanceSettingsService.INSTANCE = new GetFinanceSettingsService(
        financeReportRepository
      );

    return GetFinanceSettingsService.INSTANCE;
  }

  async execute({
    userId
  }: GetFinanceSettingsService.DTO): Promise<GetFinanceSettingsService.Result> {
    return this.financeReportRepository.getSettings(userId);
  }
}

namespace GetFinanceSettingsService {
  export type DTO = Record<'userId', string>;
  export type Result = FinanceSettings;
}

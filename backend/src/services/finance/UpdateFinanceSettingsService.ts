import { FinanceMessages } from '@/config/Constants';
import type {
  FinanceReportRepository,
  FinanceSettings
} from '@/infra/database';

export class UpdateFinanceSettingsService {
  private static INSTANCE: UpdateFinanceSettingsService;
  private readonly financeReportRepository: FinanceReportRepository;

  private constructor(financeReportRepository: FinanceReportRepository) {
    this.financeReportRepository = financeReportRepository;
  }

  static getInstance(financeReportRepository: FinanceReportRepository) {
    if (!UpdateFinanceSettingsService.INSTANCE)
      UpdateFinanceSettingsService.INSTANCE = new UpdateFinanceSettingsService(
        financeReportRepository
      );

    return UpdateFinanceSettingsService.INSTANCE;
  }

  async execute(
    settings: UpdateFinanceSettingsService.DTO
  ): Promise<UpdateFinanceSettingsService.Result> {
    return {
      settings: await this.financeReportRepository.saveSettings(settings),
      message: FinanceMessages.SETTINGS_UPDATED
    };
  }
}

namespace UpdateFinanceSettingsService {
  export type DTO = FinanceSettings & Record<'userId', string>;
  export type Result = { settings: FinanceSettings; message: string };
}

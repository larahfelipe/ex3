import { PortfolioRepository } from '@/infra/database';

export class PortfolioLoader {
  private static INSTANCE: PortfolioLoader;
  private portfolioRepository: PortfolioRepository;

  private constructor() {
    this.portfolioRepository = PortfolioRepository.getInstance();
  }

  static getInstance() {
    if (!PortfolioLoader.INSTANCE)
      PortfolioLoader.INSTANCE = new PortfolioLoader();

    return PortfolioLoader.INSTANCE;
  }

  async loadAll() {
    const portfolios = await this.portfolioRepository.getAll();

    return portfolios;
  }

  async loadByUserId(userId: string) {
    const portfolioExists = await this.portfolioRepository.getByUserId(userId);

    return portfolioExists;
  }
}

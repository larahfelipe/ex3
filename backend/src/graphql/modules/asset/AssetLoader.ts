import { AssetRepository } from '@/infra/database';

export class AssetLoader {
  private static INSTANCE: AssetLoader;
  private assetRepository: AssetRepository;

  private constructor() {
    this.assetRepository = AssetRepository.getInstance();
  }

  static getInstance() {
    if (!AssetLoader.INSTANCE) AssetLoader.INSTANCE = new AssetLoader();

    return AssetLoader.INSTANCE;
  }

  async loadAll(portfolioId?: string) {
    let assets = [];

    if (portfolioId) {
      assets = await this.assetRepository.getAllByPortfolioId(portfolioId);
    } else {
      assets = await this.assetRepository.getAll();
    }

    return assets;
  }

  async loadBySymbol(payload: Record<'symbol' | 'portfolioId', string>) {
    const assetExists = await this.assetRepository.getBySymbol(payload);

    return assetExists;
  }
}

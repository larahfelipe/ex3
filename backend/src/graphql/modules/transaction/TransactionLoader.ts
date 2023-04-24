import { TransactionRepository } from '@/infra/database';

export class TransactionLoader {
  private static INSTANCE: TransactionLoader;
  private transactionRepository: TransactionRepository;

  private constructor() {
    this.transactionRepository = TransactionRepository.getInstance();
  }

  static getInstance() {
    if (!TransactionLoader.INSTANCE)
      TransactionLoader.INSTANCE = new TransactionLoader();

    return TransactionLoader.INSTANCE;
  }

  async loadAll(assetId?: string) {
    let transactions = [];

    if (assetId) {
      transactions = await this.transactionRepository.getAllByAssetId(assetId);
    } else {
      transactions = await this.transactionRepository.getAll();
    }

    return transactions;
  }

  async loadById(id: string) {
    const transactionExists = await this.transactionRepository.getById(id);

    return transactionExists;
  }
}

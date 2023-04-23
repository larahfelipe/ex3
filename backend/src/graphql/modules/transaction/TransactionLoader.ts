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

  async loadAll() {
    const transactions = await this.transactionRepository.getAll();

    return transactions;
  }

  async loadById(id: string) {
    const transactionExists = await this.transactionRepository.getById(id);

    return transactionExists;
  }

  async loadByAssetId(assetId: string) {
    const transactions = await this.transactionRepository.getByAssetId(assetId);

    return transactions;
  }
}

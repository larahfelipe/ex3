import { PrismaClient } from './PrismaClient';

export class PortfolioRepository {
  private static INSTANCE: PortfolioRepository;
  private prismaClient: PrismaClient;

  private constructor() {
    this.prismaClient = PrismaClient.getInstance();
  }

  static getInstance() {
    if (!PortfolioRepository.INSTANCE)
      PortfolioRepository.INSTANCE = new PortfolioRepository();

    return PortfolioRepository.INSTANCE;
  }

  async getAll() {
    return this.prismaClient.portfolio.findMany();
  }

  async getByUserId(userId: string) {
    return this.prismaClient.portfolio.findUnique({
      where: { userId }
    });
  }

  async add(userId: string) {
    return this.prismaClient.portfolio.create({
      data: {
        assets: {
          create: []
        },
        user: {
          connect: {
            id: userId
          }
        }
      }
    });
  }

  async delete(userId: string) {
    return this.prismaClient.portfolio.delete({
      where: { userId }
    });
  }
}

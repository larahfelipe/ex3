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
    const portfolios = await this.prismaClient.portfolio.findMany();

    return portfolios;
  }

  async getByUserId(userId: string) {
    const portfolio = await this.prismaClient.portfolio.findUnique({
      where: {
        userId
      }
    });

    return portfolio;
  }

  async add(relatedUserId: string) {
    const newPortfolio = await this.prismaClient.portfolio.create({
      data: {
        assets: {
          create: []
        },
        user: {
          connect: {
            id: relatedUserId
          }
        }
      }
    });

    return newPortfolio;
  }

  async delete(relatedUserId: string) {
    await this.prismaClient.portfolio.delete({
      where: {
        userId: relatedUserId
      }
    });
  }
}

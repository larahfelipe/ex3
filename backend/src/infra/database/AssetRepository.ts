import type { Position as PositionRow } from '@prisma/client';

import type { PricedInstrument } from '@/domain/MarketDataProvider';
import type { InstrumentRegistration, Position } from '@/domain/models';
import type { AllocatedPosition } from '@/domain/PortfolioValuation';

import { PrismaClient } from './PrismaClient';

const INSTRUMENT_SYMBOL = { instrument: { select: { symbol: true } } } as const;

const toPosition = ({
  instrument,
  quantity,
  averageCost,
  investedValue,
  ...position
}: PositionRow & Record<'instrument', Pick<Position, 'symbol'>>): Position => ({
  ...position,
  quantity: quantity.toFixed(),
  averageCost: averageCost.toFixed(),
  investedValue: investedValue.toFixed(),
  symbol: instrument.symbol
});

export class AssetRepository {
  private static INSTANCE: AssetRepository;
  private prismaClient: PrismaClient;

  private constructor() {
    this.prismaClient = PrismaClient.getInstance();
  }

  static getInstance() {
    if (!AssetRepository.INSTANCE)
      AssetRepository.INSTANCE = new AssetRepository();

    return AssetRepository.INSTANCE;
  }

  async getBySymbol(params: AssetRepository.GetParams) {
    const { symbol, portfolioId } = params;

    const position = await this.prismaClient.position.findFirst({
      where: { portfolioId, instrument: { symbol } },
      include: INSTRUMENT_SYMBOL
    });

    return position && toPosition(position);
  }

  async getPricedPositions(
    params: AssetRepository.GetPricedPositionsParams
  ): Promise<Array<AssetRepository.PricedPosition>> {
    const { portfolioId, symbols } = params;

    const inSymbols = {
      portfolioId,
      ...(symbols && { instrument: { symbol: { in: symbols } } })
    };

    const [positions, ledgerCurrencies] = await Promise.all([
      this.prismaClient.position.findMany({
        where: inSymbols,
        orderBy: { instrument: { symbol: 'asc' } },
        select: {
          instrumentId: true,
          quantity: true,
          averageCost: true,
          investedValue: true,
          instrument: {
            select: {
              symbol: true,
              name: true,
              type: true,
              market: true,
              currency: true,
              sector: true
            }
          }
        }
      }),
      this.prismaClient.transaction.findMany({
        where: inSymbols,
        distinct: ['instrumentId'],
        select: { instrumentId: true, currency: true }
      })
    ]);

    const currencyByInstrument = new Map(
      ledgerCurrencies.map(({ instrumentId, currency }) => [
        instrumentId,
        currency
      ])
    );

    return positions.map(
      ({ instrumentId, quantity, averageCost, investedValue, instrument }) => ({
        ...instrument,
        quantity: quantity.toFixed(),
        averageCost: averageCost.toFixed(),
        investedValue: investedValue.toFixed(),
        ledgerCurrency: currencyByInstrument.get(instrumentId) ?? null
      })
    );
  }

  async add(params: AssetRepository.AddParams) {
    try {
      const position = await this.prismaClient.position.create({
        data: params,
        include: INSTRUMENT_SYMBOL
      });

      return toPosition(position);
    } catch (error) {
      if (PrismaClient.isUniqueConstraintViolation(error)) return null;

      throw error;
    }
  }

  async addWithPrivateInstrument(
    params: AssetRepository.AddWithPrivateInstrumentParams
  ) {
    const { portfolioId, instrument } = params;

    try {
      const position = await this.prismaClient.runSerializable(
        async (transactionClient) => {
          const { id: instrumentId } =
            await transactionClient.instrument.create({
              data: instrument,
              select: { id: true }
            });

          return transactionClient.position.create({
            data: { instrumentId, portfolioId },
            include: INSTRUMENT_SYMBOL
          });
        }
      );

      return toPosition(position);
    } catch (error) {
      if (PrismaClient.isUniqueConstraintViolation(error)) return null;

      throw error;
    }
  }

  async update(params: AssetRepository.UpdateParams) {
    const { oldInstrumentId, newInstrumentId, portfolioId } = params;

    const heldPosition = { portfolioId, instrumentId: oldInstrumentId };
    const movedPosition = { instrumentId: newInstrumentId };

    try {
      await this.prismaClient.runSerializable(async (transactionClient) => {
        await transactionClient.transaction.updateMany({
          where: heldPosition,
          data: movedPosition
        });
        await transactionClient.position.updateMany({
          where: heldPosition,
          data: movedPosition
        });
      });

      return true;
    } catch (error) {
      if (PrismaClient.isUniqueConstraintViolation(error)) return false;

      throw error;
    }
  }

  async delete(params: AssetRepository.DeleteParams) {
    const { instrumentId, portfolioId } = params;

    return this.prismaClient.runSerializable(async (transactionClient) => {
      await transactionClient.transaction.deleteMany({
        where: { instrumentId, portfolioId }
      });

      return transactionClient.position.deleteMany({
        where: { instrumentId, portfolioId }
      });
    });
  }
}

namespace AssetRepository {
  export type GetParams = Pick<Position, 'symbol' | 'portfolioId'>;
  export type GetPricedPositionsParams = Pick<Position, 'portfolioId'> & {
    symbols?: Array<Position['symbol']>;
  };
  export type PricedPosition = PricedInstrument & AllocatedPosition;
  export type AddParams = Pick<Position, 'instrumentId' | 'portfolioId'>;
  export type AddWithPrivateInstrumentParams = Pick<Position, 'portfolioId'> &
    Record<'instrument', InstrumentRegistration & Record<'ownerId', string>>;
  export type UpdateParams = Pick<Position, 'portfolioId'> &
    Record<'oldInstrumentId' | 'newInstrumentId', string>;
  export type DeleteParams = Pick<Position, 'instrumentId' | 'portfolioId'>;
}

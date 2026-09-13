import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import {
  AssetMessages,
  Errors,
  PortfolioMessages,
  TransactionMessages,
  TransactionTypes
} from '@/config';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { apiRequest, bearer, signIn } from '@/test/ApiClient';
import {
  FIXTURE_ASSET_SYMBOL,
  FIXTURE_PASSWORD,
  FIXTURE_USER_EMAIL,
  createAsset,
  createPortfolio,
  createTransaction,
  createUser,
  seedPortfolio
} from '@/test/Fixtures';
import { registerIntegrationHooks } from '@/test/IntegrationHooks';

const CREATE_TRANSACTION_ROUTE = '/v1/transaction';

const transactionRoute = (id: string) => `/v1/transaction/${id}`;
const transactionsRoute = (assetSymbol: string) =>
  `/v1/transactions/${assetSymbol}`;
const transactionsCountRoute = (assetSymbol: string) =>
  `/v1/transactions/${assetSymbol}/count`;

/** Mirrors the default page size in `AssetRepository.getAll`. */
const ASSET_PAGE_LIMIT = 10;

const INTRUDER_EMAIL = 'intruder@ex3.app';
const INTRUDER_SYMBOL = 'ETH';

/** Well-formed, and held by no transaction: the baseline a foreign id must be indistinguishable from. */
const MISSING_TRANSACTION_ID = '00000000-0000-4000-8000-000000000000';

/** Well-formed, and naming no portfolio: the baseline a foreign portfolio id must be indistinguishable from. */
const MISSING_PORTFOLIO_ID = '00000000-0000-4000-8000-000000000000';

const MISSING_ASSET_SYMBOL = 'XRP';

const TRANSACTION_EDIT = { type: TransactionTypes.SELL, amount: 1, price: 1 };

const prismaClient = PrismaClient.getInstance();

describe('transactions', () => {
  let client: Awaited<ReturnType<typeof apiRequest>>;

  registerIntegrationHooks();

  before(async () => {
    client = await apiRequest();
  });

  const signInWithPortfolio = async (email: string) => {
    const user = await createUser({ email });
    const portfolio = await createPortfolio(user.id);
    const accessToken = await signIn({ email, password: FIXTURE_PASSWORD });

    return { portfolio, accessToken };
  };

  /** A holder of one BTC transaction, and another user with an empty portfolio. */
  const seedHolderAndIntruder = async () => {
    const holder = await seedPortfolio();
    const holderToken = await signIn({
      email: holder.user.email,
      password: FIXTURE_PASSWORD
    });
    const intruder = await signInWithPortfolio(INTRUDER_EMAIL);

    return { holder, holderToken, intruder };
  };

  const storedPosition = (assetId: string) =>
    prismaClient.position.findUniqueOrThrow({
      where: { id: assetId },
      select: { quantity: true, averageCost: true, balance: true }
    });

  const heldPosition = ({
    quantity,
    averageCost,
    balance
  }: Record<'quantity' | 'averageCost' | 'balance', number>) => ({
    quantity,
    averageCost,
    balance
  });

  describe('ownership', () => {
    it("answers another user's transaction exactly like one that does not exist", async () => {
      const { holder, intruder } = await seedHolderAndIntruder();

      const foreign = await client
        .get(transactionRoute(holder.transaction.id))
        .set(bearer(intruder.accessToken));
      const missing = await client
        .get(transactionRoute(MISSING_TRANSACTION_ID))
        .set(bearer(intruder.accessToken));

      assert.equal(foreign.status, Errors.NOT_FOUND.status);
      assert.equal(foreign.body.message, TransactionMessages.NOT_FOUND);
      assert.deepEqual(foreign.body, missing.body);
    });

    it('does not let another user edit a transaction or the position it built', async () => {
      const { holder, intruder } = await seedHolderAndIntruder();

      const foreign = await client
        .patch(transactionRoute(holder.transaction.id))
        .set(bearer(intruder.accessToken))
        .send(TRANSACTION_EDIT);
      const missing = await client
        .patch(transactionRoute(MISSING_TRANSACTION_ID))
        .set(bearer(intruder.accessToken))
        .send(TRANSACTION_EDIT);

      assert.equal(foreign.status, Errors.NOT_FOUND.status);
      assert.deepEqual(foreign.body, missing.body);
      assert.deepEqual(
        await prismaClient.transaction.findUniqueOrThrow({
          where: { id: holder.transaction.id }
        }),
        holder.transaction
      );
      assert.deepEqual(
        await storedPosition(holder.asset.id),
        heldPosition(holder.asset)
      );
    });

    it('does not let another user delete a transaction or move the position it built', async () => {
      const { holder, intruder } = await seedHolderAndIntruder();

      const foreign = await client
        .delete(transactionRoute(holder.transaction.id))
        .set(bearer(intruder.accessToken));
      const missing = await client
        .delete(transactionRoute(MISSING_TRANSACTION_ID))
        .set(bearer(intruder.accessToken));

      assert.equal(foreign.status, Errors.NOT_FOUND.status);
      assert.deepEqual(foreign.body, missing.body);
      assert.equal(
        await prismaClient.transaction.count({
          where: { id: holder.transaction.id }
        }),
        1
      );
      assert.deepEqual(
        await storedPosition(holder.asset.id),
        heldPosition(holder.asset)
      );
    });

    it('does not let another user record a transaction on an asset they do not hold', async () => {
      const { holder, intruder } = await seedHolderAndIntruder();
      const entry = { type: TransactionTypes.BUY, amount: 1, price: 1 };

      const foreign = await client
        .post(CREATE_TRANSACTION_ROUTE)
        .set(bearer(intruder.accessToken))
        .send({
          ...entry,
          assetSymbol: holder.asset.symbol,
          portfolioId: intruder.portfolio.id
        });
      const missing = await client
        .post(CREATE_TRANSACTION_ROUTE)
        .set(bearer(intruder.accessToken))
        .send({
          ...entry,
          assetSymbol: MISSING_ASSET_SYMBOL,
          portfolioId: intruder.portfolio.id
        });

      assert.equal(foreign.status, Errors.NOT_FOUND.status);
      assert.equal(foreign.body.message, AssetMessages.NOT_FOUND);
      assert.deepEqual(foreign.body, missing.body);
      assert.equal(await prismaClient.transaction.count(), 1);
      assert.deepEqual(
        await storedPosition(holder.asset.id),
        heldPosition(holder.asset)
      );
    });

    it('lets the owner read and delete a transaction, reverting the position it built', async () => {
      const { holder, holderToken } = await seedHolderAndIntruder();

      const read = await client
        .get(transactionRoute(holder.transaction.id))
        .set(bearer(holderToken));
      const deleted = await client
        .delete(transactionRoute(holder.transaction.id))
        .set(bearer(holderToken));

      assert.equal(read.status, 200);
      assert.equal(read.body.id, holder.transaction.id);
      assert.equal(deleted.status, 200);
      assert.equal(deleted.body.message, TransactionMessages.DELETED);
      assert.equal(await prismaClient.transaction.count(), 0);
      assert.deepEqual(await storedPosition(holder.asset.id), {
        quantity: 0,
        averageCost: 0,
        balance: 0
      });
    });

    it("counts only the transactions of the caller's asset", async () => {
      const { holder, holderToken, intruder } = await seedHolderAndIntruder();
      const intruderAsset = await createAsset({
        portfolioId: intruder.portfolio.id,
        symbol: INTRUDER_SYMBOL
      });
      await Promise.all([
        createTransaction(intruderAsset),
        createTransaction(intruderAsset),
        createTransaction(intruderAsset, { type: TransactionTypes.SELL })
      ]);

      const holderCount = await client
        .get(transactionsCountRoute(holder.asset.symbol))
        .query({ portfolioId: holder.portfolio.id })
        .set(bearer(holderToken));
      const intruderCount = await client
        .get(transactionsCountRoute(INTRUDER_SYMBOL))
        .query({ portfolioId: intruder.portfolio.id })
        .set(bearer(intruder.accessToken));

      assert.equal(holderCount.status, 200);
      assert.deepEqual(holderCount.body, { buy: 1, sell: 0 });
      assert.deepEqual(intruderCount.body, { buy: 2, sell: 1 });
    });

    it("does not list or count the transactions of another user's asset", async () => {
      const { holder, intruder } = await seedHolderAndIntruder();

      for (const route of [
        transactionsRoute(holder.asset.symbol),
        transactionsCountRoute(holder.asset.symbol)
      ]) {
        const res = await client
          .get(route)
          .query({ portfolioId: intruder.portfolio.id })
          .set(bearer(intruder.accessToken));

        assert.equal(res.status, Errors.NOT_FOUND.status, route);
        assert.equal(res.body.message, AssetMessages.NOT_FOUND, route);
      }
    });

    it('keeps apart the ledgers of two portfolios holding the same instrument', async () => {
      const { holder, holderToken, intruder } = await seedHolderAndIntruder();
      const intruderAsset = await createAsset({
        portfolioId: intruder.portfolio.id,
        symbol: holder.asset.symbol
      });
      await createTransaction(intruderAsset, { amount: 1, price: 1 });

      const recorded = await client
        .post(CREATE_TRANSACTION_ROUTE)
        .set(bearer(intruder.accessToken))
        .send({
          type: TransactionTypes.BUY,
          amount: 1,
          price: 1,
          assetSymbol: holder.asset.symbol,
          portfolioId: intruder.portfolio.id
        });
      const holderListed = await client
        .get(transactionsRoute(holder.asset.symbol))
        .query({ portfolioId: holder.portfolio.id })
        .set(bearer(holderToken));
      const intruderCounted = await client
        .get(transactionsCountRoute(holder.asset.symbol))
        .query({ portfolioId: intruder.portfolio.id })
        .set(bearer(intruder.accessToken));

      assert.equal(recorded.status, 201);
      assert.deepEqual(
        holderListed.body.transactions.map(({ id }: { id: string }) => id),
        [holder.transaction.id]
      );
      assert.deepEqual(intruderCounted.body, { buy: 2, sell: 0 });
      assert.deepEqual(
        await storedPosition(holder.asset.id),
        heldPosition(holder.asset)
      );
      assert.deepEqual(await storedPosition(intruderAsset.id), {
        quantity: 2,
        averageCost: 1,
        balance: 2
      });
    });

    it('lists and counts transactions for every asset of a portfolio larger than one page', async () => {
      const { portfolio, accessToken } =
        await signInWithPortfolio(FIXTURE_USER_EMAIL);
      const symbols = Array.from(
        { length: ASSET_PAGE_LIMIT + 1 },
        (_, index) => `A${index}`
      );

      for (const symbol of symbols) {
        const asset = await createAsset({ portfolioId: portfolio.id, symbol });
        await createTransaction(asset);
      }

      for (const symbol of symbols) {
        const listed = await client
          .get(transactionsRoute(symbol))
          .query({ portfolioId: portfolio.id })
          .set(bearer(accessToken));
        const counted = await client
          .get(transactionsCountRoute(symbol))
          .query({ portfolioId: portfolio.id })
          .set(bearer(accessToken));

        assert.equal(
          listed.status,
          200,
          `${symbol}: ${JSON.stringify(listed.body)}`
        );
        assert.equal(listed.body.transactions.length, 1, symbol);
        assert.deepEqual(counted.body, { buy: 1, sell: 0 }, symbol);
      }
    });

    it('reaches a transaction by id in whichever portfolio of its owner holds it', async () => {
      const { holder, holderToken } = await seedHolderAndIntruder();
      const secondPortfolio = await createPortfolio(holder.user.id);
      const asset = await createAsset({
        portfolioId: secondPortfolio.id,
        quantity: 2,
        averageCost: 1,
        balance: 2
      });
      const transaction = await createTransaction(asset, {
        amount: 2,
        price: 1
      });

      const read = await client
        .get(transactionRoute(transaction.id))
        .set(bearer(holderToken));
      const edited = await client
        .patch(transactionRoute(transaction.id))
        .set(bearer(holderToken))
        .send({ type: TransactionTypes.BUY, amount: 3, price: 1 });
      const deleted = await client
        .delete(transactionRoute(transaction.id))
        .set(bearer(holderToken));

      assert.equal(read.status, 200);
      assert.equal(read.body.portfolioId, secondPortfolio.id);
      assert.equal(edited.status, 200);
      assert.equal(deleted.status, 200);
      assert.deepEqual(await storedPosition(asset.id), {
        quantity: 0,
        averageCost: 0,
        balance: 0
      });
      assert.deepEqual(
        await storedPosition(holder.asset.id),
        heldPosition(holder.asset)
      );
    });
  });

  describe('portfolio scope', () => {
    const scopedRequests = {
      'POST transaction': (accessToken: string, portfolioId?: string) =>
        client.post(CREATE_TRANSACTION_ROUTE).set(bearer(accessToken)).send({
          type: TransactionTypes.BUY,
          amount: 1,
          price: 1,
          assetSymbol: FIXTURE_ASSET_SYMBOL,
          portfolioId
        }),
      'GET transactions': (accessToken: string, portfolioId?: string) =>
        client
          .get(transactionsRoute(FIXTURE_ASSET_SYMBOL))
          .query({ portfolioId })
          .set(bearer(accessToken)),
      'GET transactions count': (accessToken: string, portfolioId?: string) =>
        client
          .get(transactionsCountRoute(FIXTURE_ASSET_SYMBOL))
          .query({ portfolioId })
          .set(bearer(accessToken))
    };

    it("answers another user's portfolio exactly like one that does not exist and records nothing", async () => {
      const { holder, intruder } = await seedHolderAndIntruder();
      await createAsset({ portfolioId: intruder.portfolio.id });

      for (const [request, send] of Object.entries(scopedRequests)) {
        const foreign = await send(intruder.accessToken, holder.portfolio.id);
        const missing = await send(intruder.accessToken, MISSING_PORTFOLIO_ID);

        assert.equal(foreign.status, Errors.NOT_FOUND.status, request);
        assert.equal(
          foreign.body.message,
          PortfolioMessages.NOT_FOUND,
          request
        );
        assert.deepEqual(foreign.body, missing.body, request);
      }

      assert.deepEqual(await prismaClient.transaction.findMany(), [
        holder.transaction
      ]);
      assert.deepEqual(
        await storedPosition(holder.asset.id),
        heldPosition(holder.asset)
      );
    });

    it('rejects a request without a well-formed portfolio id and records nothing', async () => {
      const { holder, holderToken } = await seedHolderAndIntruder();

      for (const [request, send] of Object.entries(scopedRequests)) {
        for (const portfolioId of [undefined, 'not-a-uuid']) {
          const res = await send(holderToken, portfolioId);

          assert.equal(
            res.status,
            Errors.BAD_REQUEST.status,
            `${request} ${portfolioId}`
          );
        }
      }

      assert.deepEqual(await prismaClient.transaction.findMany(), [
        holder.transaction
      ]);
    });
  });

  describe('ledger', () => {
    /** Below the API rate limit; enough to pass a balance check together. */
    const CONCURRENT_SELLS = 3;

    const REPLAY_SYMBOL = 'SOL';

    type LedgerEntry = { type: string; amount: number; price: number };

    const recorderOn =
      (
        { symbol, portfolioId }: Record<'symbol' | 'portfolioId', string>,
        accessToken: string
      ) =>
      (entry: LedgerEntry) =>
        client
          .post(CREATE_TRANSACTION_ROUTE)
          .set(bearer(accessToken))
          .send({ ...entry, assetSymbol: symbol, portfolioId });

    /** An owner whose asset starts empty, so every change to the position comes from the API. */
    const openEmptyPosition = async () => {
      const { portfolio, accessToken } =
        await signInWithPortfolio(FIXTURE_USER_EMAIL);
      const asset = await createAsset({ portfolioId: portfolio.id });

      return {
        portfolio,
        asset,
        accessToken,
        record: recorderOn(asset, accessToken)
      };
    };

    const replayedPosition = async (
      portfolioId: string,
      accessToken: string,
      entries: LedgerEntry[]
    ) => {
      const asset = await createAsset({ portfolioId, symbol: REPLAY_SYMBOL });
      const record = recorderOn(asset, accessToken);

      for (const entry of entries) await record(entry);

      return storedPosition(asset.id);
    };

    const storedEntry = (id: string) =>
      prismaClient.transaction.findUniqueOrThrow({
        where: { id },
        select: { type: true, amount: true, price: true }
      });

    it('adds a BUY to the position and removes a SELL from it', async () => {
      const { asset, record } = await openEmptyPosition();

      const bought = await record({ type: 'BUY', amount: 10, price: 10 });
      const sold = await record({ type: 'SELL', amount: 4, price: 20 });

      assert.equal(bought.status, 201);
      assert.equal(bought.body.message, TransactionMessages.CREATED);
      assert.equal(sold.status, 201);
      assert.deepEqual(await storedPosition(asset.id), {
        quantity: 6,
        averageCost: 10,
        balance: 20
      });
    });

    it('rejects a SELL beyond the position and records nothing', async () => {
      const { asset, record } = await openEmptyPosition();
      await record({ type: 'BUY', amount: 1, price: 10 });

      const res = await record({ type: 'SELL', amount: 2, price: 10 });

      assert.equal(res.status, Errors.BAD_REQUEST.status);
      assert.equal(res.body.message, TransactionMessages.ACC_NEGATIVE_AMOUNT);
      assert.equal(await prismaClient.transaction.count(), 1);
      assert.deepEqual(await storedPosition(asset.id), {
        quantity: 1,
        averageCost: 10,
        balance: 10
      });
    });

    it('replaces the impact of an edited transaction instead of adding to it', async () => {
      const { asset, accessToken, record } = await openEmptyPosition();
      const bought = await record({ type: 'BUY', amount: 10, price: 10 });
      const edit = { type: 'BUY', amount: 20, price: 15 };

      const res = await client
        .patch(transactionRoute(bought.body.transaction.id))
        .set(bearer(accessToken))
        .send(edit);

      assert.equal(res.status, 200);
      assert.equal(res.body.message, TransactionMessages.UPDATED);
      assert.deepEqual(await storedEntry(bought.body.transaction.id), edit);
      assert.deepEqual(await storedPosition(asset.id), {
        quantity: 20,
        averageCost: 15,
        balance: 300
      });
    });

    it('rejects an edit that would take the position below zero and changes nothing', async () => {
      const { asset, accessToken, record } = await openEmptyPosition();
      const bought = await record({ type: 'BUY', amount: 10, price: 10 });
      await record({ type: 'SELL', amount: 5, price: 10 });

      const res = await client
        .patch(transactionRoute(bought.body.transaction.id))
        .set(bearer(accessToken))
        .send({ type: 'BUY', amount: 1, price: 10 });

      assert.equal(res.status, Errors.BAD_REQUEST.status);
      assert.equal(res.body.message, TransactionMessages.ACC_NEGATIVE_AMOUNT);
      assert.deepEqual(await storedEntry(bought.body.transaction.id), {
        type: 'BUY',
        amount: 10,
        price: 10
      });
      assert.deepEqual(await storedPosition(asset.id), {
        quantity: 5,
        averageCost: 10,
        balance: 50
      });
    });

    it('rejects deleting a BUY that a later SELL depends on and changes nothing', async () => {
      const { asset, accessToken, record } = await openEmptyPosition();
      const bought = await record({ type: 'BUY', amount: 10, price: 10 });
      await record({ type: 'SELL', amount: 5, price: 10 });

      const res = await client
        .delete(transactionRoute(bought.body.transaction.id))
        .set(bearer(accessToken));

      assert.equal(res.status, Errors.BAD_REQUEST.status);
      assert.equal(res.body.message, TransactionMessages.ACC_NEGATIVE_AMOUNT);
      assert.equal(await prismaClient.transaction.count(), 2);
      assert.deepEqual(await storedPosition(asset.id), {
        quantity: 5,
        averageCost: 10,
        balance: 50
      });
    });

    it('rejects an edit that uncovers a later SELL even when the final quantity stays positive, and changes nothing', async () => {
      const { asset, accessToken, record } = await openEmptyPosition();
      const bought = await record({ type: 'BUY', amount: 10, price: 10 });
      await record({ type: 'SELL', amount: 8, price: 10 });
      await record({ type: 'BUY', amount: 10, price: 10 });

      const res = await client
        .patch(transactionRoute(bought.body.transaction.id))
        .set(bearer(accessToken))
        .send({ type: 'BUY', amount: 5, price: 10 });

      assert.equal(res.status, Errors.BAD_REQUEST.status);
      assert.equal(res.body.message, TransactionMessages.ACC_NEGATIVE_AMOUNT);
      assert.deepEqual(await storedEntry(bought.body.transaction.id), {
        type: 'BUY',
        amount: 10,
        price: 10
      });
      assert.deepEqual(await storedPosition(asset.id), {
        quantity: 12,
        averageCost: 10,
        balance: 120
      });
    });

    it('lets through only the concurrent SELLs the position covers', async () => {
      const { asset, record } = await openEmptyPosition();
      await record({ type: 'BUY', amount: 1, price: 10 });

      const responses = await Promise.all(
        Array.from({ length: CONCURRENT_SELLS }, () =>
          record({ type: 'SELL', amount: 1, price: 10 })
        )
      );
      const statuses = responses.map(({ status }) => status).toSorted();

      assert.deepEqual(statuses, [
        201,
        ...Array.from(
          { length: CONCURRENT_SELLS - 1 },
          () => Errors.BAD_REQUEST.status
        )
      ]);
      assert.equal(await prismaClient.transaction.count(), 2);
      assert.deepEqual(await storedPosition(asset.id), {
        quantity: 0,
        averageCost: 0,
        balance: 0
      });
    });

    it('records a transaction as sent and answers with the stored entry', async () => {
      const { portfolio, asset, accessToken, record } =
        await openEmptyPosition();
      const entry = { type: TransactionTypes.BUY, amount: 2, price: 5 };

      const created = await record(entry);
      const read = await client
        .get(transactionRoute(created.body.transaction.id))
        .set(bearer(accessToken));

      assert.equal(created.status, 201);
      assert.deepEqual(await storedEntry(created.body.transaction.id), entry);
      assert.equal(created.body.transaction.portfolioId, portfolio.id);
      assert.equal(created.body.transaction.instrumentId, asset.instrumentId);
      assert.deepEqual(read.body, created.body.transaction);
    });

    it('moves the position across when an edit turns a BUY into a SELL', async () => {
      const { asset, accessToken, record } = await openEmptyPosition();
      await record({ type: 'BUY', amount: 10, price: 10 });
      const bought = await record({ type: 'BUY', amount: 5, price: 10 });

      const res = await client
        .patch(transactionRoute(bought.body.transaction.id))
        .set(bearer(accessToken))
        .send({ type: 'SELL', amount: 5, price: 10 });

      assert.equal(res.status, 200);
      assert.deepEqual(await storedPosition(asset.id), {
        quantity: 5,
        averageCost: 10,
        balance: 50
      });
    });

    it('restores the position when a SELL is deleted', async () => {
      const { asset, accessToken, record } = await openEmptyPosition();
      await record({ type: 'BUY', amount: 10, price: 10 });
      const sold = await record({ type: 'SELL', amount: 4, price: 20 });

      const res = await client
        .delete(transactionRoute(sold.body.transaction.id))
        .set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.deepEqual(await storedPosition(asset.id), {
        quantity: 10,
        averageCost: 10,
        balance: 100
      });
    });

    it('weights the average cost by each BUY and keeps it through a SELL', async () => {
      const { asset, record } = await openEmptyPosition();
      await record({ type: 'BUY', amount: 10, price: 10 });
      await record({ type: 'BUY', amount: 10, price: 20 });
      await record({ type: 'SELL', amount: 5, price: 30 });

      assert.deepEqual(await storedPosition(asset.id), {
        quantity: 15,
        averageCost: 15,
        balance: 150
      });
    });

    it('reprices the entries after an edited BUY', async () => {
      const { asset, accessToken, record } = await openEmptyPosition();
      const bought = await record({ type: 'BUY', amount: 10, price: 10 });
      await record({ type: 'SELL', amount: 5, price: 10 });
      await record({ type: 'BUY', amount: 5, price: 20 });

      const res = await client
        .patch(transactionRoute(bought.body.transaction.id))
        .set(bearer(accessToken))
        .send({ type: 'BUY', amount: 10, price: 20 });

      assert.equal(res.status, 200);
      assert.deepEqual(await storedPosition(asset.id), {
        quantity: 10,
        averageCost: 20,
        balance: 250
      });
    });

    it('reprices the entries after a deleted SELL', async () => {
      const { asset, accessToken, record } = await openEmptyPosition();
      await record({ type: 'BUY', amount: 10, price: 10 });
      const sold = await record({ type: 'SELL', amount: 5, price: 10 });
      await record({ type: 'BUY', amount: 10, price: 25 });

      const res = await client
        .delete(transactionRoute(sold.body.transaction.id))
        .set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.deepEqual(await storedPosition(asset.id), {
        quantity: 20,
        averageCost: 17.5,
        balance: 350
      });
    });

    it(
      'keeps the cost of the units still held after a SELL',
      {
        todo: '`Asset.balance` adds purchase cost and subtracts sale proceeds (baseline #18, TASK 4.10): selling above cost leaves a held position with a negative balance'
      },
      async () => {
        const { asset, record } = await openEmptyPosition();
        await record({ type: 'BUY', amount: 10, price: 10 });
        await record({ type: 'SELL', amount: 5, price: 30 });

        assert.deepEqual(await storedPosition(asset.id), {
          quantity: 5,
          averageCost: 10,
          balance: 50
        });
      }
    );

    it(
      'sells a fractional position down to exactly zero',
      {
        todo: '`amount` and `price` are `Float` (FASE 4): 0.3 - 0.1 - 0.2 leaves a residue below zero and the last SELL is rejected'
      },
      async () => {
        const { asset, record } = await openEmptyPosition();
        await record({ type: 'BUY', amount: 0.3, price: 1 });
        await record({ type: 'SELL', amount: 0.1, price: 1 });

        const res = await record({ type: 'SELL', amount: 0.2, price: 1 });

        assert.equal(res.status, 201);
        assert.deepEqual(await storedPosition(asset.id), {
          quantity: 0,
          averageCost: 0,
          balance: 0
        });
      }
    );

    it('leaves an edited position equal to replaying the edited sequence', async () => {
      const { portfolio, asset, accessToken, record } =
        await openEmptyPosition();
      const first = await record({ type: 'BUY', amount: 0.1, price: 1 });
      const second = { type: 'BUY', amount: 0.3, price: 1 };
      await record(second);
      const edit = { type: 'BUY', amount: 0.3, price: 1 };

      const res = await client
        .patch(transactionRoute(first.body.transaction.id))
        .set(bearer(accessToken))
        .send(edit);

      assert.equal(res.status, 200);
      assert.deepEqual(
        await storedPosition(asset.id),
        await replayedPosition(portfolio.id, accessToken, [edit, second])
      );
    });

    it('leaves a position after a deletion equal to replaying the remaining transactions', async () => {
      const { portfolio, asset, accessToken, record } =
        await openEmptyPosition();
      const first = await record({ type: 'BUY', amount: 0.1, price: 1 });
      const remaining = { type: 'BUY', amount: 0.2, price: 1 };
      await record(remaining);

      const res = await client
        .delete(transactionRoute(first.body.transaction.id))
        .set(bearer(accessToken));

      assert.equal(res.status, 200);
      assert.deepEqual(
        await storedPosition(asset.id),
        await replayedPosition(portfolio.id, accessToken, [remaining])
      );
    });
  });

  describe('validation', () => {
    it('accepts a transaction type in any case with surrounding whitespace', async () => {
      const { portfolio, accessToken } =
        await signInWithPortfolio(FIXTURE_USER_EMAIL);
      const asset = await createAsset({ portfolioId: portfolio.id });

      const res = await client
        .post(CREATE_TRANSACTION_ROUTE)
        .set(bearer(accessToken))
        .send({
          type: ' buy ',
          amount: 1,
          price: 1,
          assetSymbol: asset.symbol,
          portfolioId: portfolio.id
        });

      assert.equal(res.status, 201);
      assert.equal(res.body.transaction.type, TransactionTypes.BUY);
    });

    it('rejects a blank or unknown transaction type and records nothing', async () => {
      const { portfolio, accessToken } =
        await signInWithPortfolio(FIXTURE_USER_EMAIL);
      const asset = await createAsset({ portfolioId: portfolio.id });

      for (const type of ['', '   ', 'HOLD', 'BUYS']) {
        const res = await client
          .post(CREATE_TRANSACTION_ROUTE)
          .set(bearer(accessToken))
          .send({
            type,
            amount: 1,
            price: 1,
            assetSymbol: asset.symbol,
            portfolioId: portfolio.id
          });

        assert.equal(res.status, Errors.BAD_REQUEST.status, `"${type}"`);
      }

      assert.equal(await prismaClient.transaction.count(), 0);
    });

    it('rejects a transaction id that is not a UUID', async () => {
      const { holderToken } = await seedHolderAndIntruder();
      const route = transactionRoute('not-a-uuid');

      const responses = new Map([
        ['GET', await client.get(route).set(bearer(holderToken))],
        [
          'PATCH',
          await client
            .patch(route)
            .set(bearer(holderToken))
            .send(TRANSACTION_EDIT)
        ],
        ['DELETE', await client.delete(route).set(bearer(holderToken))]
      ]);

      for (const [method, res] of responses)
        assert.equal(res.status, Errors.BAD_REQUEST.status, method);
    });

    it('rejects a non-positive or non-numeric amount or price and changes nothing', async () => {
      const { holder, holderToken } = await seedHolderAndIntruder();
      const valid = { type: TransactionTypes.BUY, amount: 1, price: 1 };
      const invalidEntries = [0, -1, '1'].flatMap((value) => [
        { ...valid, amount: value },
        { ...valid, price: value }
      ]);

      for (const entry of invalidEntries) {
        const label = JSON.stringify(entry);
        const created = await client
          .post(CREATE_TRANSACTION_ROUTE)
          .set(bearer(holderToken))
          .send({
            ...entry,
            assetSymbol: holder.asset.symbol,
            portfolioId: holder.portfolio.id
          });
        const edited = await client
          .patch(transactionRoute(holder.transaction.id))
          .set(bearer(holderToken))
          .send(entry);

        assert.equal(
          created.status,
          Errors.BAD_REQUEST.status,
          `POST ${label}`
        );
        assert.equal(
          edited.status,
          Errors.BAD_REQUEST.status,
          `PATCH ${label}`
        );
      }

      assert.deepEqual(await prismaClient.transaction.findMany(), [
        holder.transaction
      ]);
      assert.deepEqual(
        await storedPosition(holder.asset.id),
        heldPosition(holder.asset)
      );
    });

    it(
      'rejects an entry whose cost overflows a finite number and records nothing',
      {
        todo: '`amount` and `price` have no upper bound: 1e200 × 1e200 overflows to Infinity in the position balance'
      },
      async () => {
        const { portfolio, accessToken } =
          await signInWithPortfolio(FIXTURE_USER_EMAIL);
        const asset = await createAsset({ portfolioId: portfolio.id });

        const res = await client
          .post(CREATE_TRANSACTION_ROUTE)
          .set(bearer(accessToken))
          .send({
            type: TransactionTypes.BUY,
            amount: 1e200,
            price: 1e200,
            assetSymbol: asset.symbol,
            portfolioId: portfolio.id
          });

        assert.equal(res.status, Errors.BAD_REQUEST.status);
        assert.equal(await prismaClient.transaction.count(), 0);
        assert.deepEqual(await storedPosition(asset.id), {
          quantity: 0,
          averageCost: 0,
          balance: 0
        });
      }
    );
  });
});

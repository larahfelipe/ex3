import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';

import {
  AssetMessages,
  Errors,
  TransactionMessages,
  TransactionTypes
} from '@/config';
import { PrismaClient } from '@/infra/database/PrismaClient';
import { apiRequest, bearer, signIn } from '@/test/ApiClient';
import {
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
    prismaClient.asset.findUniqueOrThrow({
      where: { id: assetId },
      select: { amount: true, balance: true }
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
      assert.deepEqual(await storedPosition(holder.asset.id), {
        amount: holder.asset.amount,
        balance: holder.asset.balance
      });
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
      assert.deepEqual(await storedPosition(holder.asset.id), {
        amount: holder.asset.amount,
        balance: holder.asset.balance
      });
    });

    it('does not let another user record a transaction on an asset they do not hold', async () => {
      const { holder, intruder } = await seedHolderAndIntruder();
      const entry = { type: TransactionTypes.BUY, amount: 1, price: 1 };

      const foreign = await client
        .post(CREATE_TRANSACTION_ROUTE)
        .set(bearer(intruder.accessToken))
        .send({ ...entry, assetSymbol: holder.asset.symbol });
      const missing = await client
        .post(CREATE_TRANSACTION_ROUTE)
        .set(bearer(intruder.accessToken))
        .send({ ...entry, assetSymbol: MISSING_ASSET_SYMBOL });

      assert.equal(foreign.status, Errors.NOT_FOUND.status);
      assert.equal(foreign.body.message, AssetMessages.NOT_FOUND);
      assert.deepEqual(foreign.body, missing.body);
      assert.equal(await prismaClient.transaction.count(), 1);
      assert.deepEqual(await storedPosition(holder.asset.id), {
        amount: holder.asset.amount,
        balance: holder.asset.balance
      });
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
        amount: 0,
        balance: 0
      });
    });

    it("counts only the transactions of the caller's asset", async () => {
      const { holder, holderToken, intruder } = await seedHolderAndIntruder();
      await createAsset({
        portfolioId: intruder.portfolio.id,
        symbol: INTRUDER_SYMBOL
      });
      await Promise.all([
        createTransaction({ assetSymbol: INTRUDER_SYMBOL }),
        createTransaction({ assetSymbol: INTRUDER_SYMBOL }),
        createTransaction({
          assetSymbol: INTRUDER_SYMBOL,
          type: TransactionTypes.SELL
        })
      ]);

      const holderCount = await client
        .get(transactionsCountRoute(holder.asset.symbol))
        .set(bearer(holderToken));
      const intruderCount = await client
        .get(transactionsCountRoute(INTRUDER_SYMBOL))
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
        const res = await client.get(route).set(bearer(intruder.accessToken));

        assert.equal(res.status, Errors.NOT_FOUND.status, route);
        assert.equal(res.body.message, AssetMessages.NOT_FOUND, route);
      }
    });

    it('lists and counts transactions for every asset of a portfolio larger than one page', async () => {
      const { portfolio, accessToken } =
        await signInWithPortfolio(FIXTURE_USER_EMAIL);
      const symbols = Array.from(
        { length: ASSET_PAGE_LIMIT + 1 },
        (_, index) => `A${index}`
      );

      for (const symbol of symbols) {
        await createAsset({ portfolioId: portfolio.id, symbol });
        await createTransaction({ assetSymbol: symbol });
      }

      for (const symbol of symbols) {
        const listed = await client
          .get(transactionsRoute(symbol))
          .set(bearer(accessToken));
        const counted = await client
          .get(transactionsCountRoute(symbol))
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
  });

  describe('ledger', () => {
    /** Below the API rate limit; enough to pass a balance check together. */
    const CONCURRENT_SELLS = 3;

    const REPLAY_SYMBOL = 'SOL';

    type LedgerEntry = { type: string; amount: number; price: number };

    const recorderOn =
      (assetSymbol: string, accessToken: string) => (entry: LedgerEntry) =>
        client
          .post(CREATE_TRANSACTION_ROUTE)
          .set(bearer(accessToken))
          .send({ ...entry, assetSymbol });

    /** An owner whose asset starts empty, so every change to the position comes from the API. */
    const openEmptyPosition = async () => {
      const { portfolio, accessToken } =
        await signInWithPortfolio(FIXTURE_USER_EMAIL);
      const asset = await createAsset({ portfolioId: portfolio.id });

      return {
        portfolio,
        asset,
        accessToken,
        record: recorderOn(asset.symbol, accessToken)
      };
    };

    const replayedPosition = async (
      portfolioId: string,
      accessToken: string,
      entries: LedgerEntry[]
    ) => {
      const asset = await createAsset({ portfolioId, symbol: REPLAY_SYMBOL });
      const record = recorderOn(asset.symbol, accessToken);

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
        amount: 6,
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
        amount: 1,
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
        amount: 20,
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
        amount: 5,
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
        amount: 5,
        balance: 50
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
        amount: 0,
        balance: 0
      });
    });

    it('records a transaction as sent and answers with the stored entry', async () => {
      const { asset, accessToken, record } = await openEmptyPosition();
      const entry = { type: TransactionTypes.BUY, amount: 2, price: 5 };

      const created = await record(entry);
      const read = await client
        .get(transactionRoute(created.body.transaction.id))
        .set(bearer(accessToken));

      assert.equal(created.status, 201);
      assert.deepEqual(await storedEntry(created.body.transaction.id), entry);
      assert.equal(created.body.transaction.assetSymbol, asset.symbol);
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
        amount: 5,
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
        amount: 10,
        balance: 100
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
          amount: 5,
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
          amount: 0,
          balance: 0
        });
      }
    );

    it(
      'leaves an edited position equal to replaying the edited sequence',
      {
        todo: 'the edit moves the position by floating-point increments instead of rebuilding it from the ledger (TASKs 4.6 and 4.7): 0.1 + 0.3 edited to 0.3 + 0.3 stores 0.6000000000000001'
      },
      async () => {
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
      }
    );

    it(
      'leaves a position after a deletion equal to replaying the remaining transactions',
      {
        todo: 'the deletion subtracts the removed impact in floating point instead of rebuilding the position from the ledger (TASKs 4.6 and 4.8): 0.1 + 0.2 without 0.1 stores 0.20000000000000004'
      },
      async () => {
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
      }
    );
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
          assetSymbol: asset.symbol
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
          .send({ type, amount: 1, price: 1, assetSymbol: asset.symbol });

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
          .send({ ...entry, assetSymbol: holder.asset.symbol });
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
      assert.deepEqual(await storedPosition(holder.asset.id), {
        amount: holder.asset.amount,
        balance: holder.asset.balance
      });
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
            assetSymbol: asset.symbol
          });

        assert.equal(res.status, Errors.BAD_REQUEST.status);
        assert.equal(await prismaClient.transaction.count(), 0);
        assert.deepEqual(await storedPosition(asset.id), {
          amount: 0,
          balance: 0
        });
      }
    );
  });
});

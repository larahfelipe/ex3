-- Stored doubles convert through their shortest round-trip text, which any extra_float_digits above zero selects, so each keeps the value the API returned for it
SET extra_float_digits = 1;

-- A type outside the enum, a transaction without the portfolio its currency comes from, or an amount or price that is not positive or that DECIMAL(38,18) cannot hold without rounding aborts the migration before any structure changes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "transactions"
    WHERE "type" NOT IN ('BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'DEPOSIT', 'WITHDRAWAL', 'SPLIT', 'BONUS', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT')
  ) THEN
    RAISE EXCEPTION 'transactions with a type outside TransactionType cannot be migrated';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "transactions" AS t
    WHERE NOT EXISTS (SELECT 1 FROM "portfolios" AS p WHERE p."id" = t."portfolioId")
  ) THEN
    RAISE EXCEPTION 'transactions without a portfolio have no currency to inherit';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "transactions"
    WHERE NOT (
      "amount"::text::numeric > 0 AND "amount"::text::numeric < 1e20 AND "amount"::text::numeric = round("amount"::text::numeric, 18)
      AND "price"::text::numeric > 0 AND "price"::text::numeric < 1e20 AND "price"::text::numeric = round("price"::text::numeric, 18)
    )
  ) THEN
    RAISE EXCEPTION 'transactions with an amount or price that is not positive or outside DECIMAL(38,18) cannot be migrated';
  END IF;
END $$;

-- Every position is rebuilt in exact decimal arithmetic from its converted ledger, as the application replays it: each BUY truncates the average cost to 18 decimal places, a ledger passing through a position that DECIMAL(38,18) cannot hold aborts, and the balance is truncated once at the end
CREATE TEMPORARY TABLE "rebuilt_positions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quantity" NUMERIC NOT NULL,
    "averageCost" NUMERIC NOT NULL,
    "balance" NUMERIC NOT NULL
);

DO $$
DECLARE
  held RECORD;
  entry RECORD;
  quantity NUMERIC;
  average_cost NUMERIC;
  balance NUMERIC;
  bought_quantity NUMERIC;
BEGIN
  FOR held IN SELECT "id", "portfolioId", "instrumentId" FROM "positions" LOOP
    quantity := 0;
    average_cost := 0;
    balance := 0;

    FOR entry IN
      SELECT "type", "amount"::text::numeric AS "amount", "price"::text::numeric AS "price"
      FROM "transactions"
      WHERE "portfolioId" = held."portfolioId" AND "instrumentId" = held."instrumentId"
      ORDER BY "createdAt", "id"
    LOOP
      IF entry."type" = 'BUY' THEN
        bought_quantity := quantity + entry."amount";
        average_cost := div((quantity * average_cost + entry."amount" * entry."price") * 1e18, bought_quantity) * 1e-18;
        quantity := bought_quantity;
        balance := balance + entry."amount" * entry."price";
      ELSIF entry."type" <> 'SELL' THEN
        RAISE EXCEPTION 'position % holds a % transaction, which no replay implements', held."id", entry."type";
      ELSIF entry."amount" > quantity THEN
        RAISE EXCEPTION 'position % sells more than it holds', held."id";
      ELSE
        quantity := quantity - entry."amount";
        average_cost := CASE WHEN quantity > 0 THEN average_cost ELSE 0 END;
        balance := balance - entry."amount" * entry."price";
      END IF;

      IF quantity >= 1e20 OR average_cost >= 1e20 OR abs(balance) >= 1e20 THEN
        RAISE EXCEPTION 'position % does not fit DECIMAL(38,18)', held."id";
      END IF;
    END LOOP;

    balance := trunc(balance, 18);

    INSERT INTO "rebuilt_positions" VALUES (held."id", quantity, average_cost, balance);
  END LOOP;
END $$;

-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL', 'DIVIDEND', 'INTEREST', 'DEPOSIT', 'WITHDRAWAL', 'SPLIT', 'BONUS', 'TRANSFER_IN', 'TRANSFER_OUT', 'ADJUSTMENT');

-- AlterTable
ALTER TABLE "transactions" ALTER COLUMN "type" SET DATA TYPE "TransactionType" USING "type"::"TransactionType";

ALTER TABLE "transactions" RENAME COLUMN "amount" TO "quantity";

ALTER TABLE "transactions" RENAME COLUMN "price" TO "unitPrice";

ALTER TABLE "transactions" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(38,18) USING "quantity"::text::numeric,
ALTER COLUMN "unitPrice" SET DATA TYPE DECIMAL(38,18) USING "unitPrice"::text::numeric,
ADD COLUMN "fees" DECIMAL(38,18) NOT NULL DEFAULT 0,
ADD COLUMN "taxes" DECIMAL(38,18) NOT NULL DEFAULT 0,
ADD COLUMN "currency" TEXT,
ADD COLUMN "executedAt" TIMESTAMP(3),
ADD COLUMN "broker" TEXT,
ADD COLUMN "notes" TEXT;

RESET extra_float_digits;

-- Backfill: the portfolio's base currency and the creation time are the only currency and operation date an existing transaction knows
UPDATE "transactions" AS t
SET "currency" = p."baseCurrency", "executedAt" = t."createdAt"
FROM "portfolios" AS p
WHERE p."id" = t."portfolioId";

ALTER TABLE "transactions" ALTER COLUMN "currency" SET NOT NULL,
ALTER COLUMN "executedAt" SET NOT NULL;

-- AlterTable: the stored doubles are discarded, every row receives its rebuilt values below
ALTER TABLE "positions" ALTER COLUMN "quantity" SET DATA TYPE DECIMAL(38,18) USING 0,
ALTER COLUMN "averageCost" SET DATA TYPE DECIMAL(38,18) USING 0,
ALTER COLUMN "balance" SET DATA TYPE DECIMAL(38,18) USING 0;

-- Backfill
UPDATE "positions" AS p
SET "quantity" = r."quantity", "averageCost" = r."averageCost", "balance" = r."balance"
FROM "rebuilt_positions" AS r
WHERE r."id" = p."id";

DROP TABLE "rebuilt_positions";

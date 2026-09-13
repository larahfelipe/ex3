-- Every position is rebuilt from its ledger, in ledger order, before any structure changes; a ledger that sells more than it holds aborts the migration
CREATE TEMPORARY TABLE "rebuilt_positions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "quantity" DOUBLE PRECISION NOT NULL,
    "averageCost" DOUBLE PRECISION NOT NULL,
    "balance" DOUBLE PRECISION NOT NULL
);

DO $$
DECLARE
  held RECORD;
  entry RECORD;
  quantity DOUBLE PRECISION;
  average_cost DOUBLE PRECISION;
  balance DOUBLE PRECISION;
BEGIN
  FOR held IN SELECT "id", "portfolioId", "instrumentId" FROM "assets" LOOP
    quantity := 0;
    average_cost := 0;
    balance := 0;

    FOR entry IN
      SELECT "type", "amount", "price"
      FROM "transactions"
      WHERE "portfolioId" = held."portfolioId" AND "instrumentId" = held."instrumentId"
      ORDER BY "createdAt", "id"
    LOOP
      IF entry."type" = 'BUY' THEN
        average_cost := (quantity * average_cost + entry."amount" * entry."price") / (quantity + entry."amount");
        quantity := quantity + entry."amount";
        balance := balance + entry."amount" * entry."price";
      ELSIF entry."amount" > quantity THEN
        RAISE EXCEPTION 'position % sells more than it holds', held."id";
      ELSE
        quantity := quantity - entry."amount";
        average_cost := CASE WHEN quantity > 0 THEN average_cost ELSE 0 END;
        balance := balance - entry."amount" * entry."price";
      END IF;
    END LOOP;

    INSERT INTO "rebuilt_positions" VALUES (held."id", quantity, average_cost, balance);
  END LOOP;
END $$;

-- AlterTable
ALTER TABLE "assets" RENAME TO "positions";

ALTER TABLE "positions" RENAME CONSTRAINT "assets_pkey" TO "positions_pkey";

ALTER TABLE "positions" RENAME COLUMN "amount" TO "quantity";

ALTER TABLE "positions" ADD COLUMN "averageCost" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- RenameIndex
ALTER INDEX "assets_portfolioId_instrumentId_key" RENAME TO "positions_portfolioId_instrumentId_key";

-- RenameIndex
ALTER INDEX "assets_instrumentId_idx" RENAME TO "positions_instrumentId_idx";

-- Backfill
UPDATE "positions" AS p
SET "quantity" = r."quantity", "averageCost" = r."averageCost", "balance" = r."balance"
FROM "rebuilt_positions" AS r
WHERE r."id" = p."id";

DROP TABLE "rebuilt_positions";

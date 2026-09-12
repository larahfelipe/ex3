-- A transaction whose symbol no asset holds has no portfolio to move to
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "transactions" AS t
    WHERE NOT EXISTS (SELECT 1 FROM "assets" AS a WHERE a."symbol" = t."assetSymbol")
  ) THEN
    RAISE EXCEPTION 'transactions without an asset cannot be assigned to a portfolio';
  END IF;
END $$;

-- CreateEnum
CREATE TYPE "InstrumentType" AS ENUM ('STOCK', 'ETF', 'FUND', 'REIT', 'CRYPTO', 'BOND', 'TREASURY', 'CASH', 'OTHER');

-- CreateTable
CREATE TABLE "instruments" (
    "id" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "InstrumentType" NOT NULL,
    "market" TEXT,
    "currency" TEXT,
    "sector" TEXT,
    "country" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instruments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instruments_symbol_key" ON "instruments"("symbol");

-- Backfill
INSERT INTO "instruments" ("id", "symbol", "name", "type", "updatedAt")
SELECT gen_random_uuid()::TEXT, "symbol", "symbol", 'OTHER', CURRENT_TIMESTAMP
FROM "assets";

-- AlterTable
ALTER TABLE "assets" ADD COLUMN "instrumentId" TEXT;

ALTER TABLE "transactions" ADD COLUMN "portfolioId" TEXT,
ADD COLUMN "instrumentId" TEXT;

-- Backfill
UPDATE "assets" AS a
SET "instrumentId" = i."id"
FROM "instruments" AS i
WHERE i."symbol" = a."symbol";

UPDATE "transactions" AS t
SET "portfolioId" = a."portfolioId", "instrumentId" = a."instrumentId"
FROM "assets" AS a
WHERE a."symbol" = t."assetSymbol";

-- AlterTable
ALTER TABLE "assets" ALTER COLUMN "instrumentId" SET NOT NULL;

ALTER TABLE "transactions" ALTER COLUMN "portfolioId" SET NOT NULL,
ALTER COLUMN "instrumentId" SET NOT NULL;

-- DropIndex
DROP INDEX "assets_symbol_key";

-- DropIndex
DROP INDEX "assets_symbol_idx";

-- AlterTable
ALTER TABLE "assets" DROP COLUMN "symbol";

ALTER TABLE "transactions" DROP COLUMN "assetSymbol";

-- CreateIndex
CREATE UNIQUE INDEX "assets_portfolioId_instrumentId_key" ON "assets"("portfolioId", "instrumentId");

-- CreateIndex
CREATE INDEX "assets_instrumentId_idx" ON "assets"("instrumentId");

-- CreateIndex
CREATE INDEX "transactions_portfolioId_instrumentId_idx" ON "transactions"("portfolioId", "instrumentId");

-- CreateIndex
CREATE INDEX "transactions_instrumentId_idx" ON "transactions"("instrumentId");

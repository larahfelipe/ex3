-- Transactions can be imported from a file: each import is recorded, and each
-- transaction it records keeps the key of its row, unique in the portfolio so
-- the same row is never recorded twice, and the row itself. Columns added are
-- nullable, so the transactions recorded by hand are left as they are.

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "importId" TEXT,
ADD COLUMN     "importKey" TEXT,
ADD COLUMN     "importedRow" JSONB;

-- CreateTable
CREATE TABLE "transaction_imports" (
    "id" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileDigest" TEXT NOT NULL,
    "formats" TEXT[],
    "rowCount" INTEGER NOT NULL,
    "importedCount" INTEGER NOT NULL,
    "openedInstrumentIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" TIMESTAMP(3),
    "portfolioId" TEXT NOT NULL,

    CONSTRAINT "transaction_imports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "transaction_imports_portfolioId_createdAt_idx" ON "transaction_imports"("portfolioId", "createdAt");

-- CreateIndex
CREATE INDEX "transactions_importId_idx" ON "transactions"("importId");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_portfolioId_importKey_key" ON "transactions"("portfolioId", "importKey");


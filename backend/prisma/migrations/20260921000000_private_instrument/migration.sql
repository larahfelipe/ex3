ALTER TABLE "instruments" ADD COLUMN "ownerId" TEXT;

DROP INDEX "instruments_symbol_key";

-- Prisma cannot declare NULLS NOT DISTINCT: without it every catalog row, whose
-- "ownerId" is null, would be distinct and the catalog could repeat a symbol.
CREATE UNIQUE INDEX "instruments_ownerId_symbol_key" ON "instruments"("ownerId", "symbol") NULLS NOT DISTINCT;

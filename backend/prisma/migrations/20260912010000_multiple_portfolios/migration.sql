-- A portfolio without its user has no sign-up to date it from
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "portfolios" AS p
    WHERE NOT EXISTS (SELECT 1 FROM "users" AS u WHERE u."id" = p."userId")
  ) THEN
    RAISE EXCEPTION 'portfolios without a user cannot be dated';
  END IF;
END $$;

-- AlterTable
ALTER TABLE "portfolios" ADD COLUMN "name" TEXT,
ADD COLUMN "baseCurrency" TEXT,
ADD COLUMN "createdAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3);

-- Backfill
UPDATE "portfolios" AS p
SET "name" = 'Main', "baseCurrency" = 'BRL', "createdAt" = u."createdAt", "updatedAt" = u."createdAt"
FROM "users" AS u
WHERE u."id" = p."userId";

-- AlterTable
ALTER TABLE "portfolios" ALTER COLUMN "name" SET NOT NULL,
ALTER COLUMN "baseCurrency" SET NOT NULL,
ALTER COLUMN "createdAt" SET NOT NULL,
ALTER COLUMN "createdAt" SET DEFAULT CURRENT_TIMESTAMP,
ALTER COLUMN "updatedAt" SET NOT NULL;

-- DropIndex
DROP INDEX "portfolios_userId_key";

-- CreateIndex
CREATE INDEX "portfolios_userId_idx" ON "portfolios"("userId");

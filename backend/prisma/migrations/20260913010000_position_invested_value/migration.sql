-- A position whose invested value, quantity × average cost truncated to 18 decimal places, DECIMAL(38,18) cannot hold aborts the migration before any structure changes
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "positions"
    WHERE trunc("quantity" * "averageCost", 18) >= 1e20
  ) THEN
    RAISE EXCEPTION 'positions whose invested value does not fit DECIMAL(38,18) cannot be migrated';
  END IF;
END $$;

-- AlterTable: the balance, purchase cost minus sale proceeds, gives way to the cost of the units still held
ALTER TABLE "positions" RENAME COLUMN "balance" TO "investedValue";

-- Backfill
UPDATE "positions" SET "investedValue" = trunc("quantity" * "averageCost", 18);

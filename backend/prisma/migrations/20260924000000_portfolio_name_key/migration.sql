-- Stored names take the form `normalizePortfolioName` gives new ones: NFC, each
-- run of whitespace one space, trimmed.
UPDATE "portfolios"
SET "name" = normalize(regexp_replace(regexp_replace("name", '\s+', ' ', 'g'), '^ | $', '', 'g'), NFC);

ALTER TABLE "portfolios" ADD COLUMN "nameKey" TEXT;

UPDATE "portfolios" SET "nameKey" = lower("name");

-- A name an owner already repeats keeps its oldest portfolio; each later one
-- takes the first free " (n)" suffix, the name cut so the result still fits the
-- 60 characters `CreatePortfolioSchema` allows.
DO $$
DECLARE
  duplicate RECORD;
  suffix INTEGER;
  candidate TEXT;
BEGIN
  FOR duplicate IN
    SELECT "id", "userId", "name"
    FROM (
      SELECT "id", "userId", "name", "createdAt",
        row_number() OVER (PARTITION BY "userId", "nameKey" ORDER BY "createdAt", "id") AS "rank"
      FROM "portfolios"
    ) AS "ranked"
    WHERE "rank" > 1
    ORDER BY "userId", "createdAt", "id"
  LOOP
    suffix := 2;

    LOOP
      candidate := rtrim(left(duplicate."name", 60 - length(' (' || suffix || ')'))) || ' (' || suffix || ')';

      EXIT WHEN NOT EXISTS (
        SELECT 1 FROM "portfolios"
        WHERE "userId" = duplicate."userId" AND "nameKey" = lower(candidate)
      );

      suffix := suffix + 1;
    END LOOP;

    UPDATE "portfolios"
    SET "name" = candidate, "nameKey" = lower(candidate)
    WHERE "id" = duplicate."id";
  END LOOP;
END $$;

ALTER TABLE "portfolios" ALTER COLUMN "nameKey" SET NOT NULL;

CREATE UNIQUE INDEX "portfolios_userId_nameKey_key" ON "portfolios"("userId", "nameKey");

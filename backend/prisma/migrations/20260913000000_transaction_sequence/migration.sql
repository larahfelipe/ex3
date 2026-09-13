ALTER TABLE "transactions" ADD COLUMN "sequence" BIGINT;

UPDATE "transactions" AS "transaction"
SET "sequence" = "recorded"."sequence"
FROM (
  SELECT "id", ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS "sequence"
  FROM "transactions"
) AS "recorded"
WHERE "transaction"."id" = "recorded"."id";

CREATE SEQUENCE "transactions_sequence_seq" AS BIGINT OWNED BY "transactions"."sequence";

SELECT setval('"transactions_sequence_seq"', COALESCE(MAX("sequence"), 0) + 1, false) FROM "transactions";

ALTER TABLE "transactions"
  ALTER COLUMN "sequence" SET DEFAULT nextval('"transactions_sequence_seq"'),
  ALTER COLUMN "sequence" SET NOT NULL;

CREATE UNIQUE INDEX "transactions_sequence_key" ON "transactions"("sequence");

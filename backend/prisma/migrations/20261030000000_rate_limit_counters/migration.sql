-- Rate limit counters move from each process's memory to the database, so every
-- API process counts against the same budgets. A new table only.

-- CreateTable
CREATE TABLE "rate_limit_counters" (
    "key" TEXT NOT NULL,
    "hits" INTEGER NOT NULL,
    "resetAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rate_limit_counters_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "rate_limit_counters_resetAt_idx" ON "rate_limit_counters"("resetAt");

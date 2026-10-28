-- CreateTable
CREATE TABLE "market_quotes" (
    "id" TEXT NOT NULL,
    "price" DECIMAL(38,18) NOT NULL,
    "currency" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL,
    "instrumentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "market_quotes_instrumentId_timestamp_source_key" ON "market_quotes"("instrumentId", "timestamp", "source");

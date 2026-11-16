-- Credit cards a bill or a recurring expense can be charged to. Adds one table and nullable columns: no existing row changes.

-- CreateEnum
CREATE TYPE "CardBrand" AS ENUM ('VISA', 'MASTERCARD');

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "creditCardId" TEXT,
ADD COLUMN     "originalDueDate" DATE;

-- AlterTable
ALTER TABLE "recurring_expenses" ADD COLUMN     "creditCardId" TEXT;

-- CreateTable
CREATE TABLE "credit_cards" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "lastFourDigits" TEXT NOT NULL,
    "brand" "CardBrand" NOT NULL,
    "closingDay" INTEGER NOT NULL,
    "dueDay" INTEGER NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_cards_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "credit_cards_userId_idx" ON "credit_cards"("userId");

-- CreateIndex
CREATE INDEX "expenses_creditCardId_idx" ON "expenses"("creditCardId");

-- CreateIndex
CREATE INDEX "recurring_expenses_creditCardId_idx" ON "recurring_expenses"("creditCardId");


-- Only the last four digits are kept, never a full card number; a statement cannot close and fall due on the same day; and a bill's own due date is kept exactly while it is charged to a card
ALTER TABLE "credit_cards"
  ADD CONSTRAINT "credit_cards_lastFourDigits_check" CHECK ("lastFourDigits" ~ '^[0-9]{4}$'),
  ADD CONSTRAINT "credit_cards_days_check" CHECK ("closingDay" BETWEEN 1 AND 31 AND "dueDay" BETWEEN 1 AND 31 AND "closingDay" <> "dueDay");

ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_creditCard_check" CHECK (("creditCardId" IS NULL) = ("originalDueDate" IS NULL));

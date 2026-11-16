-- An installment plan can be charged to a credit card, as a bill or a recurring expense can. Adds a nullable column: no existing row changes.

-- AlterTable
ALTER TABLE "installment_plans" ADD COLUMN     "creditCardId" TEXT;

-- CreateIndex
CREATE INDEX "installment_plans_creditCardId_idx" ON "installment_plans"("creditCardId");

-- Expense categories go from fourteen to eleven, each named for what the money
-- is for rather than how it is paid: insurance, taxes and debt become
-- FINANCIAL, and personal care joins HEALTH. Every bill, installment plan and
-- recurring expense moves to its new category. The history in finance_events
-- keeps the values it recorded.

-- CreateEnum
CREATE TYPE "ExpenseCategory_new" AS ENUM ('HOUSING', 'UTILITIES', 'FOOD', 'TRANSPORTATION', 'HEALTH', 'EDUCATION', 'LEISURE', 'SUBSCRIPTIONS', 'FINANCIAL', 'SHOPPING', 'OTHER');

-- AlterTable
ALTER TABLE "expenses" ALTER COLUMN "category" TYPE "ExpenseCategory_new" USING (
  CASE "category"::text
    WHEN 'INSURANCE' THEN 'FINANCIAL'
    WHEN 'TAXES' THEN 'FINANCIAL'
    WHEN 'DEBT' THEN 'FINANCIAL'
    WHEN 'PERSONAL_CARE' THEN 'HEALTH'
    ELSE "category"::text
  END
)::"ExpenseCategory_new";

-- AlterTable
ALTER TABLE "installment_plans" ALTER COLUMN "category" TYPE "ExpenseCategory_new" USING (
  CASE "category"::text
    WHEN 'INSURANCE' THEN 'FINANCIAL'
    WHEN 'TAXES' THEN 'FINANCIAL'
    WHEN 'DEBT' THEN 'FINANCIAL'
    WHEN 'PERSONAL_CARE' THEN 'HEALTH'
    ELSE "category"::text
  END
)::"ExpenseCategory_new";

-- AlterTable
ALTER TABLE "recurring_expenses" ALTER COLUMN "category" TYPE "ExpenseCategory_new" USING (
  CASE "category"::text
    WHEN 'INSURANCE' THEN 'FINANCIAL'
    WHEN 'TAXES' THEN 'FINANCIAL'
    WHEN 'DEBT' THEN 'FINANCIAL'
    WHEN 'PERSONAL_CARE' THEN 'HEALTH'
    ELSE "category"::text
  END
)::"ExpenseCategory_new";

-- DropEnum
DROP TYPE "ExpenseCategory";

-- RenameEnum
ALTER TYPE "ExpenseCategory_new" RENAME TO "ExpenseCategory";

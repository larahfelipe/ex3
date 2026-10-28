-- Personal financial management: new tables only. No existing table or row is read or changed.

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('HOUSING', 'UTILITIES', 'FOOD', 'TRANSPORTATION', 'HEALTH', 'EDUCATION', 'LEISURE', 'SUBSCRIPTIONS', 'INSURANCE', 'TAXES', 'DEBT', 'SHOPPING', 'PERSONAL_CARE', 'OTHER');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'BANK_TRANSFER', 'PIX', 'BOLETO', 'DIRECT_DEBIT', 'OTHER');

-- CreateEnum
CREATE TYPE "RecurrenceFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'YEARLY');

-- CreateEnum
CREATE TYPE "FinanceRecordType" AS ENUM ('EXPENSE', 'INSTALLMENT_PLAN', 'RECURRING_EXPENSE');

-- CreateEnum
CREATE TYPE "FinanceEventType" AS ENUM ('CREATED', 'UPDATED', 'CANCELLED', 'RESTORED', 'PAYMENT_RECORDED', 'PAYMENT_CORRECTED', 'PAYMENT_VOIDED', 'RESCHEDULED');

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "subcategory" TEXT,
    "amount" DECIMAL(38,18) NOT NULL,
    "currency" TEXT NOT NULL,
    "entryDate" DATE NOT NULL,
    "dueDate" DATE NOT NULL,
    "paymentMethod" "PaymentMethod",
    "account" TEXT,
    "notes" TEXT,
    "settledAmount" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "settledOn" DATE,
    "cancelledAt" TIMESTAMP(3),
    "installmentPlanId" TEXT,
    "installmentNumber" INTEGER,
    "recurringExpenseId" TEXT,
    "occurrenceDate" DATE,
    "isCustomized" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_payments" (
    "id" TEXT NOT NULL,
    "amount" DECIMAL(38,18) NOT NULL,
    "discount" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "fees" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "paidOn" DATE NOT NULL,
    "method" "PaymentMethod",
    "notes" TEXT,
    "voidedAt" TIMESTAMP(3),
    "expenseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "installment_plans" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "subcategory" TEXT,
    "currency" TEXT NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL DEFAULT 'MONTHLY',
    "principalAmount" DECIMAL(38,18),
    "paymentMethod" "PaymentMethod",
    "account" TEXT,
    "notes" TEXT,
    "entryDate" DATE NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "installment_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "recurring_expenses" (
    "id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "subcategory" TEXT,
    "amount" DECIMAL(38,18) NOT NULL,
    "isVariable" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL,
    "frequency" "RecurrenceFrequency" NOT NULL,
    "startDate" DATE NOT NULL,
    "endDate" DATE,
    "paymentMethod" "PaymentMethod",
    "account" TEXT,
    "notes" TEXT,
    "generatedThrough" DATE NOT NULL,
    "cancelledAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_events" (
    "id" TEXT NOT NULL,
    "recordType" "FinanceRecordType" NOT NULL,
    "recordId" TEXT NOT NULL,
    "type" "FinanceEventType" NOT NULL,
    "changes" JSONB NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "finance_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "finance_settings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reminderLeadDays" INTEGER NOT NULL DEFAULT 3,
    "remindOverdue" BOOLEAN NOT NULL DEFAULT true,
    "remindUpcomingBills" BOOLEAN NOT NULL DEFAULT true,
    "remindUpcomingInstallments" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expenses_userId_dueDate_idx" ON "expenses"("userId", "dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_installmentPlanId_installmentNumber_key" ON "expenses"("installmentPlanId", "installmentNumber");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_recurringExpenseId_occurrenceDate_key" ON "expenses"("recurringExpenseId", "occurrenceDate");

-- CreateIndex
CREATE INDEX "expense_payments_expenseId_idx" ON "expense_payments"("expenseId");

-- CreateIndex
CREATE INDEX "expense_payments_userId_paidOn_idx" ON "expense_payments"("userId", "paidOn");

-- CreateIndex
CREATE INDEX "installment_plans_userId_idx" ON "installment_plans"("userId");

-- CreateIndex
CREATE INDEX "recurring_expenses_userId_idx" ON "recurring_expenses"("userId");

-- CreateIndex
CREATE INDEX "finance_events_recordType_recordId_createdAt_idx" ON "finance_events"("recordType", "recordId", "createdAt");

-- CreateIndex
CREATE INDEX "finance_events_userId_idx" ON "finance_events"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "finance_settings_userId_key" ON "finance_settings"("userId");


-- The invariants the application keeps, held by the database too, so no write path can store a negative amount, an over-settled bill or a row that is both an installment and an occurrence
ALTER TABLE "expenses"
  ADD CONSTRAINT "expenses_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "expenses_settledAmount_check" CHECK ("settledAmount" >= 0 AND "settledAmount" <= "amount"),
  ADD CONSTRAINT "expenses_settledOn_check" CHECK (("settledOn" IS NOT NULL) = ("settledAmount" = "amount")),
  ADD CONSTRAINT "expenses_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "expenses_installment_check" CHECK (("installmentPlanId" IS NULL) = ("installmentNumber" IS NULL) AND ("installmentNumber" IS NULL OR "installmentNumber" >= 1)),
  ADD CONSTRAINT "expenses_occurrence_check" CHECK (("recurringExpenseId" IS NULL) = ("occurrenceDate" IS NULL)),
  ADD CONSTRAINT "expenses_origin_check" CHECK ("installmentPlanId" IS NULL OR "recurringExpenseId" IS NULL);

ALTER TABLE "expense_payments"
  ADD CONSTRAINT "expense_payments_amounts_check" CHECK ("amount" >= 0 AND "discount" >= 0 AND "fees" >= 0 AND "amount" + "discount" > 0);

ALTER TABLE "installment_plans"
  ADD CONSTRAINT "installment_plans_principalAmount_check" CHECK ("principalAmount" IS NULL OR "principalAmount" > 0),
  ADD CONSTRAINT "installment_plans_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$');

ALTER TABLE "recurring_expenses"
  ADD CONSTRAINT "recurring_expenses_amount_check" CHECK ("amount" > 0),
  ADD CONSTRAINT "recurring_expenses_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "recurring_expenses_endDate_check" CHECK ("endDate" IS NULL OR "endDate" >= "startDate");

ALTER TABLE "finance_settings"
  ADD CONSTRAINT "finance_settings_reminderLeadDays_check" CHECK ("reminderLeadDays" BETWEEN 0 AND 30);

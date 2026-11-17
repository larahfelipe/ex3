-- Read and dismissed marks of the finance notifications, which are derived from the bills on every read. Adds one table: no existing row changes.

-- CreateTable
CREATE TABLE "finance_notification_marks" (
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "dismissedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "finance_notification_marks_pkey" PRIMARY KEY ("userId","key")
);


-- A key names one condition of one bill on one due date, and a dismissed notification has been read
ALTER TABLE "finance_notification_marks"
  ADD CONSTRAINT "finance_notification_marks_key_check" CHECK ("key" ~ '^(overdue|due-soon):[0-9a-f-]{36}:[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  ADD CONSTRAINT "finance_notification_marks_dismissed_check" CHECK ("dismissedAt" IS NULL OR "readAt" IS NOT NULL);

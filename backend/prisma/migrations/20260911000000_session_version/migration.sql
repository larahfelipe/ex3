-- AlterTable
ALTER TABLE "users" DROP COLUMN "accessToken",
ADD COLUMN     "sessionVersion" INTEGER NOT NULL DEFAULT 0;


-- CreateEnum
CREATE TYPE "RecurringFrequency" AS ENUM ('WEEKLY', 'MONTHLY', 'QUARTERLY', 'SEMIANNUAL', 'ANNUAL', 'OTHER');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "recurring_group_id" TEXT;

-- CreateTable
CREATE TABLE "recurring_groups" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "merchant_id" TEXT,
    "category_id" TEXT,
    "description" TEXT NOT NULL,
    "frequency" "RecurringFrequency" NOT NULL,
    "typical_amount" DECIMAL(14,2) NOT NULL,
    "last_date" TIMESTAMP(3) NOT NULL,
    "next_estimated_date" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "is_manual" BOOLEAN NOT NULL DEFAULT false,
    "confidence" DECIMAL(4,3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "recurring_groups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "recurring_groups_user_id_idx" ON "recurring_groups"("user_id");

-- CreateIndex
CREATE INDEX "recurring_groups_account_id_idx" ON "recurring_groups"("account_id");

-- CreateIndex
CREATE INDEX "transactions_recurring_group_id_idx" ON "transactions"("recurring_group_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_recurring_group_id_fkey" FOREIGN KEY ("recurring_group_id") REFERENCES "recurring_groups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_groups" ADD CONSTRAINT "recurring_groups_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_groups" ADD CONSTRAINT "recurring_groups_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_groups" ADD CONSTRAINT "recurring_groups_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "recurring_groups" ADD CONSTRAINT "recurring_groups_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

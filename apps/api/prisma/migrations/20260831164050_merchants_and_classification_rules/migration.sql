-- CreateEnum
CREATE TYPE "RuleField" AS ENUM ('DESCRIPTION');

-- CreateEnum
CREATE TYPE "RuleOperator" AS ENUM ('CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'EXACT', 'REGEX');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AuditEventType" ADD VALUE 'RULE_CREATED';
ALTER TYPE "AuditEventType" ADD VALUE 'RULE_UPDATED';
ALTER TYPE "AuditEventType" ADD VALUE 'RULE_DELETED';

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "merchant_id" TEXT;

-- CreateTable
CREATE TABLE "merchants" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "default_category_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "merchants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "merchant_aliases" (
    "id" TEXT NOT NULL,
    "merchant_id" TEXT NOT NULL,
    "pattern" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "merchant_aliases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "classification_rules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "field" "RuleField" NOT NULL DEFAULT 'DESCRIPTION',
    "operator" "RuleOperator" NOT NULL,
    "value" TEXT NOT NULL,
    "account_id" TEXT,
    "min_amount" DECIMAL(14,2),
    "max_amount" DECIMAL(14,2),
    "category_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_via" TEXT NOT NULL DEFAULT 'manual',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "classification_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "merchants_user_id_idx" ON "merchants"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchants_user_id_name_key" ON "merchants"("user_id", "name");

-- CreateIndex
CREATE INDEX "merchant_aliases_merchant_id_idx" ON "merchant_aliases"("merchant_id");

-- CreateIndex
CREATE UNIQUE INDEX "merchant_aliases_merchant_id_pattern_key" ON "merchant_aliases"("merchant_id", "pattern");

-- CreateIndex
CREATE INDEX "classification_rules_user_id_idx" ON "classification_rules"("user_id");

-- CreateIndex
CREATE INDEX "transactions_merchant_id_idx" ON "transactions"("merchant_id");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchants" ADD CONSTRAINT "merchants_default_category_id_fkey" FOREIGN KEY ("default_category_id") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "merchant_aliases" ADD CONSTRAINT "merchant_aliases_merchant_id_fkey" FOREIGN KEY ("merchant_id") REFERENCES "merchants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "classification_rules" ADD CONSTRAINT "classification_rules_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "InternalTransferStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- AlterEnum
ALTER TYPE "AuditEventType" ADD VALUE 'TRANSFER_STATUS_CHANGED';

-- CreateTable
CREATE TABLE "internal_transfers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "outgoing_transaction_id" TEXT NOT NULL,
    "incoming_transaction_id" TEXT NOT NULL,
    "status" "InternalTransferStatus" NOT NULL DEFAULT 'PENDING',
    "confidence" DECIMAL(4,3) NOT NULL,
    "confirmed_via" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internal_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internal_transfers_outgoing_transaction_id_key" ON "internal_transfers"("outgoing_transaction_id");

-- CreateIndex
CREATE UNIQUE INDEX "internal_transfers_incoming_transaction_id_key" ON "internal_transfers"("incoming_transaction_id");

-- CreateIndex
CREATE INDEX "internal_transfers_user_id_idx" ON "internal_transfers"("user_id");

-- AddForeignKey
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_outgoing_transaction_id_fkey" FOREIGN KEY ("outgoing_transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internal_transfers" ADD CONSTRAINT "internal_transfers_incoming_transaction_id_fkey" FOREIGN KEY ("incoming_transaction_id") REFERENCES "transactions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

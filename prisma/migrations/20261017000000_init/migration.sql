-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('ACTIVE', 'ON_HOLD', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ProductionStage" AS ENUM ('ARTWORK', 'PRODUCTION', 'QUALITY_CHECK', 'READY_TO_SHIP');

-- CreateEnum
CREATE TYPE "PrintMethod" AS ENUM ('SCREEN_PRINT', 'EMBROIDERY', 'DTG', 'DTF_TRANSFER', 'LARGE_FORMAT');

-- CreateTable
CREATE TABLE "orders" (
    "id" TEXT NOT NULL,
    "order_number" TEXT NOT NULL,
    "customer" TEXT NOT NULL,
    "product" TEXT NOT NULL,
    "method" "PrintMethod" NOT NULL,
    "quantity" INTEGER NOT NULL,
    "due_date" DATE NOT NULL,
    "status" "OrderStatus" NOT NULL DEFAULT 'ACTIVE',
    "stage" "ProductionStage" NOT NULL DEFAULT 'ARTWORK',
    "rush" BOOLEAN NOT NULL DEFAULT false,
    "artwork_approved" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "orders_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "orders_order_number_key" ON "orders"("order_number");

-- CreateIndex
CREATE INDEX "orders_due_date_idx" ON "orders"("due_date");

-- CreateIndex
CREATE INDEX "orders_status_due_date_idx" ON "orders"("status", "due_date");

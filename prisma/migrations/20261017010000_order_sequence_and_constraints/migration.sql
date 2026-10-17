-- Numeric order sequence, a row-locked counter, and CHECK constraints for
-- data integrity. Hand-edited from `prisma migrate diff` to backfill existing
-- rows; Prisma does not manage CHECK constraints, so they live only here.

-- 1. Numeric sequence column, backfilled from existing "PF-<n>" numbers.
ALTER TABLE "orders" ADD COLUMN "order_seq" INTEGER;
UPDATE "orders" SET "order_seq" = substring("order_number" FROM '^PF-([0-9]+)$')::INTEGER;
ALTER TABLE "orders" ALTER COLUMN "order_seq" SET NOT NULL;
CREATE UNIQUE INDEX "orders_order_seq_key" ON "orders"("order_seq");

-- 2. Bounded text columns.
ALTER TABLE "orders"
  ALTER COLUMN "order_number" SET DATA TYPE VARCHAR(20),
  ALTER COLUMN "customer" SET DATA TYPE VARCHAR(120),
  ALTER COLUMN "product" SET DATA TYPE VARCHAR(200);

-- 3. Counter, started after the highest existing order (or at 10000).
CREATE TABLE "order_number_counters" (
    "name" VARCHAR(32) NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "order_number_counters_pkey" PRIMARY KEY ("name"),
    CONSTRAINT "order_number_counters_value_check" CHECK ("value" >= 0)
);
INSERT INTO "order_number_counters" ("name", "value")
SELECT 'orders', GREATEST(10000, COALESCE(MAX("order_seq"), 0)) FROM "orders";

-- 4. Integrity rules mirrored from src/lib/order-validation.ts.
ALTER TABLE "orders"
  ADD CONSTRAINT "orders_order_seq_check" CHECK ("order_seq" > 0),
  ADD CONSTRAINT "orders_order_number_check" CHECK ("order_number" = 'PF-' || "order_seq"),
  ADD CONSTRAINT "orders_quantity_check" CHECK ("quantity" BETWEEN 1 AND 100000),
  ADD CONSTRAINT "orders_customer_check" CHECK (char_length(btrim("customer")) >= 2),
  ADD CONSTRAINT "orders_product_check" CHECK (char_length(btrim("product")) >= 2),
  -- Production can't start (and an order can't complete) without approved artwork.
  ADD CONSTRAINT "orders_artwork_check" CHECK ("artwork_approved" OR ("stage" = 'ARTWORK' AND "status" <> 'COMPLETED')),
  -- Completed orders sit at the final stage.
  ADD CONSTRAINT "orders_completed_stage_check" CHECK ("status" <> 'COMPLETED' OR "stage" = 'READY_TO_SHIP');

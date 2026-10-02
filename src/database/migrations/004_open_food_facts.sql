-- Migration 004 — Open Food Facts metadata for foods.

ALTER TABLE food ADD COLUMN external_source TEXT;
ALTER TABLE food ADD COLUMN external_id TEXT;
ALTER TABLE food ADD COLUMN barcode TEXT;
ALTER TABLE food ADD COLUMN brand TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_food_barcode_unique
  ON food (barcode)
  WHERE barcode IS NOT NULL AND barcode <> '';

CREATE INDEX IF NOT EXISTS idx_food_external_identity
  ON food (external_source, external_id);

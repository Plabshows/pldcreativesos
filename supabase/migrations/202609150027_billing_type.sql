-- ============================================================
-- Migration 027: Add billing_type column to events
-- Supports 'invoice' (default) and 'cash' payment types
-- Non-destructive: preserves all existing data
-- ============================================================

ALTER TABLE events ADD COLUMN IF NOT EXISTS billing_type TEXT DEFAULT 'invoice'
  CONSTRAINT events_billing_type_check CHECK (billing_type IN ('invoice', 'cash'));

-- Backfill: existing events with invoice_number = 'cash' → billing_type = 'cash'
UPDATE events
SET billing_type = 'cash'
WHERE LOWER(TRIM(COALESCE(invoice_number, ''))) IN ('cash', 'banco y cash')
  AND billing_type = 'invoice';

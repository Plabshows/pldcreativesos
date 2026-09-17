-- Migration: Economic Audit Schema & Invoice Event Allocations
-- Creates invoice_event_allocations and financial_audit_log tables

CREATE TABLE IF NOT EXISTS public.invoice_event_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  event_id UUID REFERENCES public.events(id) ON DELETE SET NULL,
  amount_net_cents BIGINT NOT NULL DEFAULT 0,
  category TEXT NOT NULL DEFAULT 'PERFORMANCE',
  description TEXT NOT NULL DEFAULT '',
  allocation_source TEXT NOT NULL DEFAULT 'PDF_INVOICE',
  confidence TEXT NOT NULL DEFAULT 'VERIFIED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invoice_event_allocations_invoice ON public.invoice_event_allocations(invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_event_allocations_event ON public.invoice_event_allocations(event_id);

CREATE TABLE IF NOT EXISTS public.financial_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entity_type TEXT NOT NULL,
  entity_id UUID NOT NULL,
  field_name TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  source_invoice_number TEXT,
  reason TEXT NOT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_financial_audit_log_entity ON public.financial_audit_log(entity_type, entity_id);

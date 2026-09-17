-- Phase 1: Connect + Clean — Event Single Source of Truth
-- Non-destructive migration adding venue_id reference and indices on events

ALTER TABLE public.events 
  ADD COLUMN IF NOT EXISTS venue_id UUID REFERENCES public.event_places(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_events_client_id ON public.events(client_id);
CREATE INDEX IF NOT EXISTS idx_events_venue_id ON public.events(venue_id);

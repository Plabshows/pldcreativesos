-- Migration: Update Rememberland Thursday events to PROMO and Friday events to REMEMBERLAND AMNESIA
UPDATE public.events
SET event_name = 'PROMO',
    updated_at = NOW()
WHERE client_id IN (SELECT id FROM public.clients WHERE company_name ILIKE '%rememberland%')
  AND EXTRACT(DOW FROM event_date::date) = 4;

UPDATE public.events
SET event_name = 'REMEMBERLAND AMNESIA',
    venue = 'AMNESIA',
    updated_at = NOW()
WHERE client_id IN (SELECT id FROM public.clients WHERE company_name ILIKE '%rememberland%')
  AND EXTRACT(DOW FROM event_date::date) = 5;

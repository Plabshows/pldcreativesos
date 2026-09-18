-- Migration: Update Roller Girls events at Pacha to Flower Power
UPDATE public.events
SET event_name = 'Flower Power',
    updated_at = NOW()
WHERE ILIKE(venue, '%pacha%')
  AND ILIKE(event_name, '%roller%');

-- Migration: Update legacy 'rent' names to 'Alquiler de props'
UPDATE public.events
SET event_name = 'Alquiler de props',
    updated_at = NOW()
WHERE event_name ILIKE 'rent';

UPDATE public.expenses
SET concept = REPLACE(concept, 'rent', 'Alquiler de props'),
    updated_at = NOW()
WHERE concept ILIKE '%rent%';

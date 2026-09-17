-- Migration: Add bank_details column to public.clients
-- Supports storing bank account, IBAN, SWIFT, and banking notes for clients

ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS bank_details TEXT DEFAULT '';

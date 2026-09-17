begin;
alter table public.talent add column skills text[];
comment on column public.talent.skills is 'Explicit skills. NULL uses legacy note suggestions; empty array explicitly means none.';
notify pgrst,'reload schema';
commit;

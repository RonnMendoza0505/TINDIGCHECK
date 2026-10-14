-- TINDIGCHECK! Part 04: Private learner medical files.
-- Run in the Supabase SQL Editor before testing uploads.
-- This migration expects public.learners(id uuid) and public.user_profiles(id uuid, role text).

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'learner-medical-files',
  'learner-medical-files',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update set
  public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.learner_medical_files (
  id uuid primary key default gen_random_uuid(),
  learner_id uuid not null references public.learners(id) on delete cascade,
  original_name text not null,
  storage_path text not null unique,
  mime_type text not null,
  size_bytes bigint not null check (size_bytes > 0 and size_bytes <= 10485760),
  uploaded_by uuid not null default auth.uid() references auth.users(id),
  created_at timestamptz not null default now()
);
create index if not exists learner_medical_files_learner_idx
  on public.learner_medical_files(learner_id, created_at desc);
alter table public.learner_medical_files enable row level security;

-- Security-definer helper avoids relying on frontend role claims and prevents
-- recursive user_profiles RLS checks in storage policies.
create or replace function public.tindig_is_medical_admin()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.user_profiles p
    where p.id = (select auth.uid())
      and p.role in ('Admin', 'Super Admin')
  );
$$;
revoke all on function public.tindig_is_medical_admin() from public;
grant execute on function public.tindig_is_medical_admin() to authenticated;

drop policy if exists "medical_metadata_select_admin" on public.learner_medical_files;
create policy "medical_metadata_select_admin" on public.learner_medical_files
  for select to authenticated using (public.tindig_is_medical_admin());
drop policy if exists "medical_metadata_insert_admin" on public.learner_medical_files;
create policy "medical_metadata_insert_admin" on public.learner_medical_files
  for insert to authenticated with check (
    public.tindig_is_medical_admin()
    and uploaded_by = (select auth.uid())
    and storage_path like learner_id::text || '/%'
  );
drop policy if exists "medical_metadata_delete_admin" on public.learner_medical_files;
create policy "medical_metadata_delete_admin" on public.learner_medical_files
  for delete to authenticated using (public.tindig_is_medical_admin());

drop policy if exists "medical_storage_select_admin" on storage.objects;
create policy "medical_storage_select_admin" on storage.objects
  for select to authenticated using (
    bucket_id = 'learner-medical-files'
    and public.tindig_is_medical_admin()
  );
drop policy if exists "medical_storage_insert_admin" on storage.objects;
create policy "medical_storage_insert_admin" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'learner-medical-files'
    and public.tindig_is_medical_admin()
    and exists (
      select 1 from public.learners l
      where l.id::text = (storage.foldername(name))[1]
    )
  );
drop policy if exists "medical_storage_delete_admin" on storage.objects;
create policy "medical_storage_delete_admin" on storage.objects
  for delete to authenticated using (
    bucket_id = 'learner-medical-files'
    and public.tindig_is_medical_admin()
  );

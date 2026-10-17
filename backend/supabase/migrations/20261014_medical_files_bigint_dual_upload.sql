-- TINDIGCHECK medical files: compatible with public.learners.id BIGINT.
-- Run THIS file only. Previous UUID-based migrations have been renamed .legacy.txt.
-- Files are stored in a PRIVATE Supabase bucket and private Cloudinary assets.
-- File metadata is appended to public.learners.medical_files.

alter table public.learners
  add column if not exists medical_files jsonb not null default '[]'::jsonb;

-- If an earlier attempt added the column as nullable, normalize existing rows.
update public.learners set medical_files = '[]'::jsonb where medical_files is null;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('learner-medical-files', 'learner-medical-files', false, 10485760,
  array['application/pdf','image/jpeg','image/png','image/webp']::text[])
on conflict (id) do update set public = false,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Unique function names avoid conflicting with older UUID-based RPCs.
-- Service role only; Edge Function verifies JWT and role before calling.
create or replace function public.tindig_append_medical_file_bigint(
  p_learner_id bigint, p_file jsonb
) returns void language plpgsql security definer set search_path = '' as $$
begin
  if jsonb_typeof(p_file) is distinct from 'object' then
    raise exception 'Medical file metadata must be an object';
  end if;
  update public.learners
  set medical_files = coalesce(medical_files, '[]'::jsonb) || jsonb_build_array(p_file)
  where id = p_learner_id;
  if not found then raise exception 'Learner not found'; end if;
end;
$$;

create or replace function public.tindig_remove_medical_file_bigint(
  p_learner_id bigint, p_file_id text
) returns void language plpgsql security definer set search_path = '' as $$
begin
  update public.learners l
  set medical_files = coalesce((
    select jsonb_agg(f.value)
    from jsonb_array_elements(coalesce(l.medical_files, '[]'::jsonb)) as f(value)
    where f.value->>'id' is distinct from p_file_id
  ), '[]'::jsonb)
  where l.id = p_learner_id;
  if not found then raise exception 'Learner not found'; end if;
end;
$$;

revoke all on function public.tindig_append_medical_file_bigint(bigint,jsonb) from public, anon, authenticated;
revoke all on function public.tindig_remove_medical_file_bigint(bigint,text) from public, anon, authenticated;
grant execute on function public.tindig_append_medical_file_bigint(bigint,jsonb) to service_role;
grant execute on function public.tindig_remove_medical_file_bigint(bigint,text) to service_role;

-- No learner_medical_files table is needed by this implementation.
-- Do not run the older UUID foreign-key migration.

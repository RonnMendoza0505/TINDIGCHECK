# PHASE 1 — Medical upload: Supabase + Cloudinary

## Important
The upload is not activated by GitHub or by installing React. You must run the SQL migration and deploy the Supabase Edge Function to the same Supabase project referenced by frontend/.env. This package has not been tested with your live accounts.

## 1. Supabase SQL Editor
Run ONLY `backend/supabase/migrations/20261014_medical_files_bigint_dual_upload.sql`. This migration is designed for `public.learners.id` = BIGINT. It adds `public.learners.medical_files` JSONB, ensures the private Storage bucket `learner-medical-files` exists, and defines two service-role-only RPCs. Do not run old migrations referring to `learner_medical_files` or UUID learner IDs.

Check with:
```sql
select column_name, data_type from information_schema.columns
where table_schema='public' and table_name='learners'
  and column_name in ('id','medical_files');
select id, public from storage.buckets where id='learner-medical-files';
select routine_name from information_schema.routines
where routine_schema='public' and routine_name in
('tindig_append_medical_file_bigint','tindig_remove_medical_file_bigint');
```
Expected: BIGINT id, JSONB medical_files, bucket public=false, two RPCs.

## 2. Deploy Edge Function
The source is `backend/supabase/functions/manage-learner-medical/index.ts`.
Use the Supabase dashboard Edge Functions editor to deploy as **manage-learner-medical**, or use the Supabase CLI from the `backend/supabase` folder. Keep JWT verification enabled. If using the dashboard editor, paste the entire `index.ts` source.

Configure server-side Edge Function secrets:
- CLOUDINARY_CLOUD_NAME
- CLOUDINARY_API_KEY
- CLOUDINARY_API_SECRET

These must be Cloudinary's actual account credentials. Do NOT use a Cloudinary unsigned upload preset in place of an API secret. Do NOT put CLOUDINARY_API_SECRET in frontend/.env or GitHub. Supabase's SUPABASE_URL, SUPABASE_ANON_KEY, and SUPABASE_SERVICE_ROLE_KEY are normally injected into hosted Edge Functions; check logs if missing.

## 3. Frontend
Restore your local `frontend/.env` with VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY (or the keys expected by `frontend/src/functions/03-supabase-learner-sections/supabaseClient.ts`). Run `npm install` and `npm run dev` from `frontend/`.

Log in as Admin or Super Admin. In Learner Management, edit an existing learner and upload a small JPG/PDF. Save. The frontend calls `/functions/v1/manage-learner-medical`, not `/rest/v1/learner_medical_files`.

## 4. Confirm upload
- Supabase Storage → `learner-medical-files` → folder named with the learner BIGINT ID.
- Cloudinary Media Library → `tindigcheck/learner-medical/<learner-id>/...`, delivery type **authenticated**.
- Supabase Table Editor → `learners.medical_files` should be a JSON array with file references, not `[]`.
- Learner Directory → Medical files link/button opens the file via a short-lived Supabase signed URL.

## 5. If it fails
Open browser DevTools (F12) → Network → request `manage-learner-medical` → Response. Send the **HTTP status and response.error** (not API keys). Also check Supabase Edge Functions → manage-learner-medical → Logs. A 404 means wrong project or undeployed function; 401/403 means authentication/role; 500 usually shows a Cloudinary/Storage/RPC error. If you still see `/rest/v1/learner_medical_files`, the old frontend is running: open the new extracted frontend and restart Vite.

**Privacy:** Medical records are sensitive student information. Keep both storage services private, limit viewing to authorized staff, and review database RLS on learners.medical_files before real-world use.

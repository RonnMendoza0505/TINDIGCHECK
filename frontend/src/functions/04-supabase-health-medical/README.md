# Medical files (frontend)

`medical-files.ts` calls the deployed `manage-learner-medical` Supabase Edge Function. It does **not** insert into `learner_medical_files`.

The Edge Function uploads each file to **both** the private Supabase Storage bucket `learner-medical-files` and a Cloudinary authenticated asset, then appends the references to `public.learners.medical_files` (JSONB). If either upload fails, it reports an error and attempts cleanup. Admin/Super Admin roles only.

Deploy `backend/supabase/functions/manage-learner-medical/index.ts` and apply `backend/supabase/migrations/20261014_medical_files_bigint_dual_upload.sql`. The old `learner_medical_files` table is not used by this version.

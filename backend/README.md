# TINDIGCHECK Backend

This folder groups the actual server-side resources:

- `supabase/functions/` — Supabase Edge Functions: `get-learner-photo`, `manage-accounts`.
- `supabase/migrations/` — PostgreSQL/Storage/RLS migration for private learner medical documents.
- `cloudinary/` — media integration documentation. The `upload-learner-photo` Edge Function source is not included in this project archive.
- `functions/` — five function-category documentation folders (not executable APIs).

Supabase hosts the authentication, database, RLS, storage, and deployed Edge Functions. Cloudinary hosts profile media.

Frontend code under `frontend/src/functions/` runs in the browser and must stay there. Do not put service-role keys or Cloudinary API secrets in Vite environment variables.

To deploy Supabase functions with the usual CLI project layout, open a terminal in `backend/` and configure/link the Supabase project as needed. The SQL migration is at `backend/supabase/migrations/20261014_learner_medical_files.sql`.

# TINDIGCHECK! — Clean Full Project

This is a **complete replacement** project, not a patch. Extract into a NEW empty directory. Do **not** merge it with older ZIP contents.

## Folders

- `frontend/`: Vite + React app and its client-side Supabase integration; contains `package.json`.
- `backend/supabase/functions/`: deployable Supabase Edge Functions.
- `backend/supabase/migrations/`: current medical upload SQL migration.
- `backend/cloudinary/`: Cloudinary backend notes; API secret is configured only in Supabase.
- `backend/functions/`: documentation for the five capstone function categories; these are not standalone Node services.

The small modules in `frontend/src/lib/` are **compatibility re-exports**, not duplicate implementations. Keep them: existing React imports depend on them.

## Run locally

From the new project root:

```powershell
cd frontend
npm install
npm run dev
```

Restore your own private `frontend/.env` file; it is intentionally not included.

## Medical file upload

This version uses one medical upload implementation: the React client calls the `manage-learner-medical` Supabase Edge Function. The function writes the file to both the private Supabase Storage bucket `learner-medical-files` and an authenticated Cloudinary asset, then appends the reference to `public.learners.medical_files` JSONB. Learner IDs are BIGINT. The older `learner_medical_files` metadata table is **not** used by this implementation.

1. Run **only** `backend/supabase/migrations/20261014_medical_files_bigint_dual_upload.sql` in Supabase SQL Editor.
2. Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` to Supabase Edge Function secrets (not frontend `.env`).
3. Deploy `backend/supabase/functions/manage-learner-medical/index.ts` as `manage-learner-medical` to the **same Supabase project** used by the frontend.
4. Sign in as Admin or Super Admin, upload a small test file, and verify Supabase Storage, Cloudinary, and `learners.medical_files`.

This code has not been verified against your live services. Deployments and security policies must be tested before using real students' sensitive documents.

## Replace the old GitHub repository files safely

Keep the extracted folder as a separate source copy. In a **clone of your existing GitHub repository**, create a backup branch, then replace tracked files with the contents of this ZIP (never copy a `.git` folder). Verify `frontend/package.json` and review `git status` before committing. Never upload `.env`, API secrets, or `node_modules`.

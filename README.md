# TINDIGCHECK! — Frontend / Backend Separation (Updated Five Parts)

## Structure
- `frontend/`: Vite + React + TypeScript app; runnable frontend source.
- `backend/functions/`: five responsibility folders with documentation; these are **not** five running API servers.
- `backend/supabase/functions/`: existing deployable Supabase Edge Functions (`get-learner-photo`, `manage-accounts`).
- `backend/cloudinary/`: media integration documentation.

## Five parts
1. **LOGIN** — `frontend/src/functions/01-login/`
2. **DATA INPUT** — `frontend/src/functions/02-data-input/`
3. **SUPABASE — Learner Basic Info & Section Management** — `frontend/src/functions/03-supabase-learner-sections/`
4. **SUPABASE — Health Records & Medical Files** — `frontend/src/functions/04-supabase-health-medical/`
5. **CLOUDINARY — Profile Pictures & Medical Photos** — `frontend/src/functions/05-cloudinary-upload/`

**Change in this ZIP:** moved the existing `medical-files.ts` placeholder from Part 03 to Part 04, renamed Parts 03/04, updated the `src/lib/medical-files.ts` compatibility export, and aligned backend documentation folders.

**Limitations in the supplied code:** `medical-files.ts` and `cloudinary.ts` are empty placeholders, and the source for the invoked `upload-learner-photo` Edge Function is not present. Moving folders does not implement those uploads. No working functionality was intentionally removed.

## Run in VS Code PowerShell
```powershell
cd frontend
npm install
npm run dev
```

Put your existing `frontend/.env` in place locally. Never commit `.env` or secret keys.

## Verify before pushing
```powershell
cd frontend
npm run build
```

The source is repackaged, but a full build/runtime integration test has not been completed here.

## New: Medical File Upload on Add/Edit Learner

Part 02 (`frontend/src/pages/learners/index.tsx`) now includes an optional multi-file input for medical certificates and documents. Part 04 (`frontend/src/functions/04-supabase-health-medical/medical-files.ts`) implements the actual upload/list/view/remove operations through **private Supabase Storage**, not Cloudinary. Part 05 continues to handle learner profile pictures.

**REQUIRED DATABASE SETUP:** Open your Supabase project's **SQL Editor**, and run `backend/supabase/migrations/`20261014_learner_medical_files.sql` before testing. This creates the private `learner-medical-files` bucket, `learner_medical_files` metadata table and Admin/Super Admin RLS policies. This SQL assumes `public.learners.id` is UUID and `public.user_profiles` has `id` and `role` columns, as used by the existing project; verify against your deployed schema before applying. Viewers are intentionally not allowed to access medical files.

For security, keep `frontend/.env` private and use only the Supabase publishable key. The application has no medical-document Edge Function: the browser uses the authenticated Supabase client, and **Supabase Storage/Postgres policies are the server-side security enforcement**. If a medical upload fails after the learner is saved, the learner remains saved and the form reports the partial failure; reopen Edit Learner to retry the file. Verify the existing Cloudinary profile-photo Edge Function separately; it is not included in the source ZIP.

## Updated physical backend layout (2026-10-14)
- `backend/supabase/functions/`: server-executed Supabase Edge Functions (deploy using Supabase CLI from `backend/`).
- `backend/supabase/migrations/`: database schema, storage and RLS policies. Apply medical-file migration via SQL Editor or migration workflow.
- `backend/cloudinary/`: Cloudinary backend integration documentation. The deployed `upload-learner-photo` Edge Function is NOT included in the supplied source; do not assume it has been restored.
- `backend/functions/01..05`: explanatory grouping only, not five implemented servers.
- `frontend/src/functions/`: browser-executed API clients and application logic. The Supabase publishable key is safe to use with enforced RLS; service-role/API secrets must never go into frontend VITE_ variables.
- Add/Edit Learner's food-allergy checkbox now has a white background and green checked indicator.

Run the React frontend from `frontend/` (`npm install`, `npm run dev`). `backend/` has no Node package.json and is not a separate npm app.

# TINDIGCHECK! Backend — Server-Side Code Only

This directory contains the actual backend resources that run outside the browser.

- `supabase/functions/manage-learner-medical/index.ts`: authenticated medical-file upload, view, list, and delete; stores files in private Supabase Storage and Cloudinary, and updates `learners.medical_files`.
- `supabase/functions/manage-accounts/index.ts`: privileged account-management Edge Function.
- `supabase/functions/get-learner-photo/index.ts`: server-side learner photo access.
- `supabase/migrations/20261014_medical_files_bigint_dual_upload.sql`: BIGINT-compatible medical-file storage migration.
- `cloudinary/`: server-side Cloudinary setup guidance.
- `functions/01-login` through `05-cloudinary-upload`: *documentation only*, not deployed endpoints.

The frontend modules in `frontend/src/functions/` are **browser-side Supabase/Cloudinary callers**, not server-side code; they must stay in the frontend so React imports continue to work. Likewise, the `frontend/src/lib/` compatibility re-export modules remain necessary to avoid breaking existing imports.

**Security:** Never commit `frontend/.env`, Cloudinary API secrets, Supabase service-role keys, or private learner files. Deploy Edge Functions separately from pushing to GitHub. The `upload-learner-photo` function is not included in this archive.

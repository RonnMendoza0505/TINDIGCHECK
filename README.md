# TINDIGCHECK! — Clean two-phase release

This release contains the complete React frontend and Supabase/Cloudinary backend sources, without previous duplicate patch ZIPs.

**Start with `PHASE_1_MEDICAL_UPLOAD.md`**, then use `PHASE_2_GITHUB_UPLOAD.md` to upload the verified source to GitHub.

Project structure:
- `frontend/`: React + Vite frontend, including the medical-file upload caller and Learner Directory links.
- `backend/supabase/functions/manage-learner-medical/`: authenticated upload/view/delete Edge Function. Uploads to private Supabase Storage and authenticated Cloudinary, and stores metadata in `learners.medical_files` JSONB.
- `backend/supabase/migrations/20261014_medical_files_bigint_dual_upload.sql`: BIGINT-compatible database and private bucket setup.
- `backend/cloudinary/`: Cloudinary backend documentation.

**Note:** The supplied backend still needs deployment, server-side Cloudinary secrets, and live validation. Do not use real student medical files before security review.

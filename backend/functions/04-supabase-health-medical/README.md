# Medical files — Supabase + Cloudinary backend

Real backend: `backend/supabase/functions/manage-learner-medical/index.ts`.
Upload/list/view/delete are authenticated and restricted to Admin/Super Admin.
Files are stored privately in Supabase Storage and as authenticated Cloudinary
assets. Metadata is an array in `public.learners.medical_files`.
Apply SQL migrations and deploy the Edge Function; see the root README.

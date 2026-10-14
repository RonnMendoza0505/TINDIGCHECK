# Part 04 — Health Records and Medical Files

**Real backend:** Supabase PostgreSQL, private Supabase Storage and Row Level Security. This folder documents the backend responsibility; it is **not** an independent Node server.

- SQL: `backend/supabase/migrations/`20261014_learner_medical_files.sql`
- React-side storage and database integration: `frontend/src/functions/04-supabase-health-medical/medical-files.ts`
- Add/Edit Learner form: `frontend/src/pages/learners/index.tsx`
- Storage bucket: `learner-medical-files` (**private**)
- Table: `public.learner_medical_files` (references `public.learners.id`)
- Allowed: PDF, JPG, PNG, WEBP, up to 10 MB each
- Permissions: authenticated Admin/Super Admin only; enforced by RLS

Apply the SQL migration using the Supabase SQL Editor before uploading files. Never put a service-role key in `frontend/.env`.

**Note:** Medical file uploads are to Supabase Storage, not Cloudinary. Part 05 continues to handle learner profile pictures.

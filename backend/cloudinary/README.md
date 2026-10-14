# Cloudinary — Medical documents and learner photos

Medical PDFs/images are uploaded as **authenticated** Cloudinary assets by
`backend/supabase/functions/manage-learner-medical/index.ts`. A second private
copy is stored in Supabase Storage. The learner's `medical_files` JSONB column
stores references; never put raw file contents or Cloudinary API secrets there.

Set these **server-side Supabase Edge Function secrets**:
`CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`.
Do not put the API secret in `frontend/.env` or GitHub.

Photo upload uses a separate `upload-learner-photo` Edge Function which is
**not present in the supplied project**; it needs separate implementation.

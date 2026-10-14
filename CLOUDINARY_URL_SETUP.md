# TINDIGCHECK — Save Cloudinary URL in Supabase

The upload Edge Function now saves the **exact Cloudinary `secure_url`** as `cloudinary_url` in each object inside `public.learners.medical_files` (JSONB). It still uploads to private Supabase Storage and authenticated Cloudinary.

## Apply
1. Replace your frontend and backend folders with the folders in this ZIP. Preserve your local `frontend/.env` (not included).
2. In Supabase Dashboard → Edge Functions → `manage-learner-medical`, replace the code with `backend/supabase/functions/manage-learner-medical/index.ts` and **Deploy**.
3. Restart Vite (`npm run dev` in frontend), log in as Admin, upload a NEW small medical document, and save.
4. In Supabase SQL Editor, run:

```sql
SELECT student_id, medical_files FROM public.learners WHERE jsonb_array_length(COALESCE(medical_files, '[]'::jsonb)) > 0;
```

Each new file record now includes `cloudinary_url: https://res.cloudinary.com/...`. Existing uploads will not be retroactively updated; re-upload or migrate them after confirming the existing asset URL.

**Privacy**: This is an authenticated Cloudinary asset. The saved URL may require signed delivery to actually open. The frontend still requests a 60-second Supabase Storage signed URL through the authenticated Edge Function when viewing files, so medical documents are not publicly exposed.

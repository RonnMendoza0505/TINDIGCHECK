# Cloudinary — backend source and deployment

**Actual Cloudinary code:** `supabase/functions/_shared/cloudinary.ts` signs server-side Upload API requests. It is imported by `upload-learner-photo/index.ts` and `manage-learner-medical/index.ts`. `get-learner-photo/index.ts` uses the Cloudinary SDK to create a short-lived authenticated photo URL after Supabase authorization.

**Frontend client:** `frontend/src/lib/learnerPhotos.ts` invokes those deployed Supabase functions. It contains no Cloudinary credentials or signing logic. `frontend/src/lib/medical-files.ts` likewise invokes the protected medical function.

Set **Supabase Edge Function secrets**: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. Set Supabase project secrets `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` as appropriate. Do **not** put API secrets or service-role keys in `frontend/.env` or in GitHub.

From the `backend` directory, with Supabase CLI installed and the project linked:

```sh
supabase functions deploy upload-learner-photo
supabase functions deploy get-learner-photo
supabase functions deploy manage-learner-medical
supabase functions deploy manage-accounts
```

Cloudinary assets are uploaded as **authenticated** resources. Profile-photo references are stored as `cloudinary-authenticated:<public_id>`; the browser asks the protected `get-learner-photo` function for a temporary URL. Database RLS must also restrict viewer access to their assigned grade/section.

**Note:** This is a source-code correction. Actual Cloudinary/Supabase deployment and integration testing must be done with your project's credentials.

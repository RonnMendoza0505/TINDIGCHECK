# Server-side code

- `supabase/functions/manage-accounts/index.ts`: privileged account operations.
- `supabase/functions/manage-learner-medical/index.ts`: authenticated upload/list/view/delete of medical files, private Supabase Storage and Cloudinary.
- `supabase/functions/upload-learner-photo/index.ts`: server-side Cloudinary profile image upload.
- `supabase/functions/get-learner-photo/index.ts`: controlled profile image retrieval.
- `supabase/migrations/20261014_medical_files_bigint_dual_upload.sql`: storage bucket and BIGINT-compatible metadata RPCs.
- `supabase/config.toml`: Edge Function JWT verification settings.

Keep `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDINARY_API_KEY` and `CLOUDINARY_API_SECRET` server-side.

From the project root, with Supabase CLI linked to the correct project:

```sh
supabase functions deploy manage-accounts --workdir backend
supabase functions deploy manage-learner-medical --workdir backend
supabase functions deploy upload-learner-photo --workdir backend
supabase functions deploy get-learner-photo --workdir backend
```

Deploying Edge Functions does not automatically apply SQL migrations; use your Supabase SQL Editor or migration workflow.

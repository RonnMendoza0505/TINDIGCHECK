# TINDIGCHECK! — Clean source structure

This release removes the numbered frontend `functions/01` through `functions/05` folders and their redundant re-export wrappers. **All browser-side Supabase calls and React helpers live directly in `frontend/src/lib/`.** They remain browser-side because they use the current user session and Supabase Row Level Security.

**Actual backend code** lives in `backend/supabase/functions/` (Supabase Edge Functions) and `backend/supabase/migrations/` (PostgreSQL SQL). Cloudinary API secrets must be set only in the Supabase Edge Function secrets, never in the Vite frontend.

## Local setup

1. Copy your existing private `frontend/.env` into this clean release. It is deliberately excluded from the ZIP.
2. From `frontend/`, run `npm ci`, then `npm run dev`.
3. Deploy the functions from `backend/supabase/functions/` to the same Supabase project, preserving function names.
4. Apply migrations only if not already applied. Do not recreate the learners table.

**Do not move `frontend/src/lib/learners.ts` to the server.** It performs user-session-scoped Supabase queries. Authorization must also be enforced with database RLS.

This is a source-code reorganization, not a confirmation of live backend deployment.

## Cloudinary code location

All Cloudinary API signing, authenticated uploads and photo retrieval run in `backend/supabase/functions/`. See `backend/CLOUDINARY_SETUP.md`. The browser-side `frontend/src/lib/learnerPhotos.ts` is only an API caller.


## Cloudinary code ownership (Member 5)

The real, executable Cloudinary integration is in `backend/supabase/functions/_shared/cloudinary/`:
- `config.ts`: reads private server-side Cloudinary credentials
- `types.ts`: request type declarations
- `request.ts`: signs and sends Cloudinary upload/delete API requests
- `photo.ts`: retrieves authenticated photo metadata and signs short-lived photo URLs

The Supabase Edge Functions call these modules with relative imports:
- `upload-learner-photo/index.ts` -> `../_shared/cloudinary/request.ts`
- `get-learner-photo/index.ts` -> `../_shared/cloudinary/photo.ts`
- `manage-learner-medical/index.ts` -> `../_shared/cloudinary/request.ts`

This keeps all Cloudinary server operations separate from the function HTTP handlers while retaining Supabase's deployable `_shared` structure. Never put the Cloudinary API secret in `frontend/`.


## Updated member responsibilities
See [MEMBER_FILE_ASSIGNMENTS.md](MEMBER_FILE_ASSIGNMENTS.md). Actual Cloudinary backend modules are under `backend/cloudinary/` and imported by Supabase Edge Functions.

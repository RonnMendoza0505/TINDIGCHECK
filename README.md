# TINDIGCHECK! — Frontend / Backend Separation (Updated Five Parts)

## Structure
- `frontend/`: Vite + React + TypeScript app; runnable frontend source.
- `backend/functions/`: five responsibility folders with documentation; these are **not** five running API servers.
- `supabase/functions/`: existing deployable Supabase Edge Functions (`get-learner-photo`, `manage-accounts`).
- `cloudinary/`: media integration documentation.

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

# Member 5 — Cloudinary Backend

These TypeScript files contain **working Cloudinary integration code**, not placeholders.

- `config.ts`: server-only Cloudinary secrets.
- `request.ts`: signed Cloudinary upload/destroy requests.
- `photo.ts`: protected photo retrieval and signed access URL.
- `types.ts`: resource/action types.

Supabase Edge Function entry points under `../supabase/functions/` import these modules. Deploy the Supabase functions; do not run this folder as a separate server.

Never expose `CLOUDINARY_API_SECRET` or Supabase service role key to Vite.

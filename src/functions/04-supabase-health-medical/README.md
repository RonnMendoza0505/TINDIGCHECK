# Part 04 — Supabase Health Records and Medical Files

The `medical-files.ts` module now implements actual private Supabase Storage upload, listing, signed viewing links, and deletion, with metadata in `learner_medical_files`. The Add/Edit Learner form lives in Part 02 UI and calls this Part 04 module.

The backend storage bucket, metadata table, and RLS rules are defined in `supabase/migrations/20261014_learner_medical_files.sql`. Apply the migration first. The existing health record modules remain unchanged.

# Part 04 — Supabase: Health Records & Medical Files

Health records, measurements, BMI/reporting helpers, and medical-file database operations belong to this group.

`medical-files.ts` was moved here from Part 03. It is currently an **empty placeholder** in the supplied source; no medical upload implementation was invented.

Medical file content requires an actual configured storage/upload endpoint. Database metadata and references may be stored in Supabase; uploading files to Supabase Storage requires implementing and securing that workflow.

Legacy imports from `src/lib` remain available through compatibility re-exports.

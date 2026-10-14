# Part 05 — Cloudinary: Profile Pictures & Medical Photos

This group contains existing learner profile photo validation and Cloudinary-related integration (`learnerPhotos.ts`).

Medical photo upload to Cloudinary is a **requested responsibility**, not an implemented feature in the supplied code. Medical-file database metadata belongs to Part 04. Do not expose Cloudinary API secrets in browser variables.

The current `uploadLearnerPhoto` client calls a Supabase Edge Function named `upload-learner-photo`; confirm that this function is deployed, as its source is not included in the supplied archive.

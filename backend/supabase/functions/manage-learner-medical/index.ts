import { createClient } from "@supabase/supabase-js";
import { cloudinaryRequest } from "../../../cloudinary/request.ts";


/**
 * Medical files are private in BOTH Supabase Storage and Cloudinary.
 * The learners.medical_files JSONB array holds their references.
 * This function is the ONLY write/delete interface for those references.
 * Deploy with JWT verification enabled and server-only secrets.
 */
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};

const BUCKET = "learner-medical-files";
const MAX = 10 * 1024 * 1024;
const TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);
const LEARNER_ID = /^[1-9][0-9]*$/; // public.learners.id is BIGINT, not UUID
const respond = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" }
});

type MedicalFile = {
  id: string; learner_id: string; original_name: string; storage_path: string;
  cloudinary_public_id: string; cloudinary_resource_type: "raw" | "image";
  cloudinary_url?: string;
  mime_type: string; size_bytes: number; created_at: string; uploaded_by: string;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return respond({ error: "Sign in first." }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const cloud = Deno.env.get("CLOUDINARY_CLOUD_NAME");
    const key = Deno.env.get("CLOUDINARY_API_KEY");
    const secret = Deno.env.get("CLOUDINARY_API_SECRET");
    if (!url || !anon || !service || !cloud || !key || !secret) {
      return respond({ error: "Missing Supabase/Cloudinary server secrets." }, 500);
    }
    const client = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await client.auth.getUser(token);
    if (authError || !auth.user) return respond({ error: "Invalid session." }, 401);
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await admin.from("user_profiles")
      .select("role").eq("id", auth.user.id).single();
    if (profileError || !["admin", "super admin", "super_admin", "superadmin"].includes(String(profile?.role || "").toLowerCase().trim())) {
      return respond({ error: "Only Admin or Super Admin can manage medical files." }, 403);
    }

    const form = await req.formData();
    const action = String(form.get("action") || "");
    const learnerId = String(form.get("learnerId") || "");
    if (!LEARNER_ID.test(learnerId)) return respond({ error: "Invalid learner ID (expected BIGINT)." }, 400);
    const { data: learner, error: learnerError } = await admin.from("learners")
      .select("id, medical_files").eq("id", learnerId).single();
    if (learnerError || !learner) return respond({ error: "Learner not found." }, 404);
    const items: MedicalFile[] = Array.isArray(learner.medical_files) ? learner.medical_files : [];
    if (action === "list") return respond({ files: items });

    if (action === "upload") {
      const file = form.get("file");
      if (!(file instanceof File)) return respond({ error: "Select a medical file." }, 400);
      if (!TYPES.has(file.type) || file.size < 1 || file.size > MAX) {
        return respond({ error: "Use a PDF, JPG, PNG or WEBP file, up to 10 MB." }, 400);
      }
      const id = crypto.randomUUID();
      const ext = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
      const path = `${learnerId}/${id}.${ext}`;
      const resourceType: "raw" | "image" = file.type === "application/pdf" ? "raw" : "image";
      const publicId = `tindigcheck/learner-medical/${learnerId}/${id}`;
      const { error: storageError } = await admin.storage.from(BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
      if (storageError) return respond({ error: `Supabase Storage: ${storageError.message}` }, 500);
      let uploadedToCloud = false;
      try {
        const cloudResult = await cloudinaryRequest(cloud, key, secret, resourceType, "upload", {
          public_id: publicId, type: "authenticated",
        }, file);
        if (cloudResult.public_id !== publicId) throw new Error("Cloudinary returned an unexpected asset ID.");
        uploadedToCloud = true;
        if (typeof cloudResult.secure_url !== "string" || !cloudResult.secure_url.startsWith("https://res.cloudinary.com/")) {
          throw new Error("Cloudinary did not return a secure_url.");
        }
        const record: MedicalFile = {
          id, learner_id: learnerId, original_name: file.name, storage_path: path,
          cloudinary_public_id: publicId, cloudinary_resource_type: resourceType,
          cloudinary_url: String(cloudResult.secure_url || ""),
          mime_type: file.type, size_bytes: file.size, created_at: new Date().toISOString(),
          uploaded_by: auth.user.id,
        };
        // Atomic SQL append: preserves previously uploaded documents.
        const { error: appendError } = await admin.rpc("tindig_append_medical_file_bigint", {
          p_learner_id: learnerId, p_file: record,
        });
        if (appendError) throw new Error(`Could not save learners.medical_files: ${appendError.message}. Run the BIGINT medical SQL migration.`);
        return respond({ file: record });
      } catch (err) {
        await admin.storage.from(BUCKET).remove([path]);
        if (uploadedToCloud) await cloudinaryRequest(cloud, key, secret, resourceType, "destroy", { public_id: publicId, type: "authenticated" }).catch(() => null);
        return respond({ error: `Upload incomplete: ${err instanceof Error ? err.message : String(err)}` }, 500);
      }
    }

    const fileId = String(form.get("fileId") || "");
    const target = items.find((f) => f.id === fileId && f.learner_id === learnerId);
    if (!target) return respond({ error: "Medical file not found." }, 404);
    if (action === "view") {
      const { data, error } = await admin.storage.from(BUCKET).createSignedUrl(target.storage_path, 60);
      if (error || !data?.signedUrl) return respond({ error: error?.message || "Cannot open file." }, 500);
      return respond({ url: data.signedUrl });
    }
    if (action === "delete") {
      // Remove reference first; if cleanup fails, never expose stale metadata.
      const { error: removeError } = await admin.rpc("tindig_remove_medical_file_bigint", {
        p_learner_id: learnerId, p_file_id: fileId,
      });
      if (removeError) return respond({ error: removeError.message }, 500);
      const { error: storageError } = await admin.storage.from(BUCKET).remove([target.storage_path]);
      let cloudError: string | null = null;
      try {
        await cloudinaryRequest(cloud, key, secret, target.cloudinary_resource_type, "destroy", {
          public_id: target.cloudinary_public_id, type: "authenticated", invalidate: "true",
        });
      } catch (err) { cloudError = String(err); }
      if (storageError || cloudError) {
        console.error("Medical file cleanup pending", { fileId, storageError, cloudError });
        return respond({ deleted: true, warning: "Reference removed, but cloud cleanup requires administrator attention." });
      }
      return respond({ deleted: true });
    }
    return respond({ error: "Unknown action." }, 400);
  } catch (err) {
    console.error("manage-learner-medical:", err);
    return respond({ error: err instanceof Error ? err.message : "Medical file request failed." }, 500);
  }
});

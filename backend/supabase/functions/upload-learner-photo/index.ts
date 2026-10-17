import { createClient } from "@supabase/supabase-js";
import { cloudinaryRequest } from "../../../cloudinary/request.ts";

// Server-side Cloudinary authenticated profile photo upload.
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Cache-Control": "no-store",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...headers, "Content-Type": "application/json" },
});

Deno.serve(async (request: Request) => {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (request.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const token = (request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Sign in first." }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const cloud = Deno.env.get("CLOUDINARY_CLOUD_NAME");
    const key = Deno.env.get("CLOUDINARY_API_KEY");
    const secret = Deno.env.get("CLOUDINARY_API_SECRET");
    if (!url || !anon || !service || !cloud || !key || !secret) {
      return reply({ error: "Missing server configuration." }, 500);
    }
    const authClient = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: auth, error: authError } = await authClient.auth.getUser(token);
    if (authError || !auth.user) return reply({ error: "Invalid session." }, 401);
    const admin = createClient(url, service, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await admin.from("user_profiles")
      .select("role").eq("id", auth.user.id).single();
    if (profileError || !["admin", "super admin", "super_admin", "superadmin"].includes(String(profile?.role || "").toLowerCase().trim())) {
      return reply({ error: "Photo uploading requires an authorized Admin account." }, 403);
    }
    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) return reply({ error: "Image file is required." }, 400);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size < 1 || file.size > 2 * 1024 * 1024) {
      return reply({ error: "Upload JPG, PNG or WEBP (maximum 2 MB)." }, 400);
    }
    const result = await cloudinaryRequest(cloud, key, secret, "image", "upload", {
      public_id: `tindigcheck/learner-profiles/${crypto.randomUUID()}`,
      type: "authenticated",
    }, file);
    if (typeof result.public_id !== "string" || !result.public_id.startsWith("tindigcheck/learner-profiles/")) {
      return reply({ error: "Invalid Cloudinary asset ID." }, 502);
    }
    return reply({ photo_url: `cloudinary-authenticated:${result.public_id}` });
  } catch (error) {
    return reply({ error: error instanceof Error ? error.message : "Unexpected error" }, 500);
  }
});

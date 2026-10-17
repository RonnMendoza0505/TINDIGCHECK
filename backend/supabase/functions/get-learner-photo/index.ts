import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedLearnerPhotoUrl } from "../../../cloudinary/photo.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Cache-Control": "no-store",
};
const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { ...cors, "Content-Type": "application/json" },
});

/** Checks Supabase JWT, RLS and viewer assignment before issuing a short-lived URL. */
Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return reply({ error: "Method not allowed" }, 405);
  try {
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
    if (!token) return reply({ error: "Sign in to view photos." }, 401);
    const url = Deno.env.get("SUPABASE_URL");
    const anon = Deno.env.get("SUPABASE_ANON_KEY");
    if (!url || !anon) return reply({ error: "Supabase is not configured." }, 500);
    const supabase = createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const { data: auth, error: authError } = await supabase.auth.getUser(token);
    if (authError || !auth.user) return reply({ error: "Invalid session." }, 401);

    const body = await req.json().catch(() => ({})) as { learnerId?: unknown };
    const learnerId = body.learnerId;
    if (typeof learnerId !== "string" || !/^[1-9][0-9]*$/.test(learnerId)) {
      return reply({ error: "Valid learner ID is required." }, 400);
    }
    const { data: profile, error: profileError } = await supabase.from("user_profiles")
      .select("role, grade, section").eq("id", auth.user.id).single();
    const role = String(profile?.role || "").trim().toLowerCase().replace(/[_\s]+/g, " ");
    if (profileError || !["super admin", "superadmin", "admin", "viewer"].includes(role)) {
      return reply({ error: "Account access denied." }, 403);
    }
    // User-scoped Supabase client enforces the database's learner RLS policy.
    const { data: learner, error: learnerError } = await supabase.from("learners")
      .select("grade, section, photo_url").eq("id", learnerId).maybeSingle();
    if (learnerError || !learner) return reply({ error: "Learner not accessible." }, 404);
    if (role === "viewer" && (
      String(profile.grade) !== String(learner.grade) ||
      String(profile.section) !== String(learner.section)
    )) return reply({ error: "Photo access denied." }, 403);

    const prefix = "cloudinary-authenticated:";
    const reference = learner.photo_url;
    if (typeof reference !== "string" || !reference.startsWith(prefix)) {
      return reply({ error: "No authenticated photo." }, 404);
    }
    const publicId = reference.slice(prefix.length);
    if (!/^tindigcheck\/learner-profiles\/[a-zA-Z0-9_-]+$/.test(publicId)) {
      return reply({ error: "Invalid photo reference." }, 400);
    }
    const signedUrl = await getAuthenticatedLearnerPhotoUrl(publicId);
    return reply({ url: signedUrl });
  } catch (error) {
    console.error("get-learner-photo:", error);
    return reply({ error: "Unable to retrieve learner photo." }, 500);
  }
});

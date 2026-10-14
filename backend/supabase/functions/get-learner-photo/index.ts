import { createSupabaseContext } from "npm:@supabase/server@1";
import { v2 as cloudinary } from "npm:cloudinary@2";

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers":
        "authorization, apikey, content-type, x-client-info, " +
        "x-supabase-client-platform, x-supabase-client-platform-version, " +
        "x-supabase-client-runtime, x-supabase-client-runtime-version",
    "Cache-Control": "no-store"
};

function reply(body: object, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json"
        }
    });
}

/*
    SYSTEM FUNCTION:
    Validates the logged-in account and learner access,
    then generates a five-minute Cloudinary photo URL.
    The Cloudinary API secret never reaches React.
*/
export default {
    async fetch(req: Request): Promise<Response> {
        if (req.method === "OPTIONS") {
            return new Response(null, { status: 204, headers: corsHeaders });
        }
        if (req.method !== "POST") {
            return reply({ error: "Method not allowed" }, 405);
        }

        const { data: ctx, error: authError } =
            await createSupabaseContext(req, { auth: "user" });

        if (authError || !ctx?.userClaims?.id) {
            return reply({ error: "Sign in to view photos." }, 401);
        }

        try {
            const body = await req.json();
            const learnerId = body?.learnerId;

            if (typeof learnerId !== "string" || !learnerId.trim()) {
                return reply({ error: "Learner ID is required." }, 400);
            }

            // The user-scoped client respects Supabase RLS policies.
            const { data: profile, error: profileError } =
                await ctx.supabase
                    .from("user_profiles")
                    .select("role, grade, section")
                    .eq("id", ctx.userClaims.id)
                    .single();

            if (profileError || !profile ||
                !["Super Admin", "Admin", "Viewer"].includes(profile.role)) {
                return reply({ error: "Account access denied." }, 403);
            }

            const { data: learner, error: learnerError } =
                await ctx.supabase
                    .from("learners")
                    .select("grade, section, photo_url")
                    .eq("id", learnerId)
                    .maybeSingle();

            if (learnerError || !learner) {
                return reply({ error: "Learner not accessible." }, 404);
            }

            if (profile.role === "Viewer" && (
                String(profile.grade) !== String(learner.grade) ||
                String(profile.section) !== String(learner.section)
            )) {
                return reply({ error: "Photo access denied." }, 403);
            }

            const prefix = "cloudinary-authenticated:";
            const reference = learner.photo_url;
            if (typeof reference !== "string" ||
                !reference.startsWith(prefix)) {
                return reply({ error: "No authenticated photo." }, 404);
            }

            const publicId = reference.slice(prefix.length);
            if (!publicId.startsWith("tindigcheck/learner-profiles/")) {
                return reply({ error: "Unexpected photo reference." }, 400);
            }

            const cloudName = Deno.env.get("CLOUDINARY_CLOUD_NAME");
            const apiKey = Deno.env.get("CLOUDINARY_API_KEY");
            const apiSecret = Deno.env.get("CLOUDINARY_API_SECRET");

            if (!cloudName || !apiKey || !apiSecret) {
                return reply({ error: "Cloudinary is not configured." }, 500);
            }

            cloudinary.config({
                cloud_name: cloudName,
                api_key: apiKey,
                api_secret: apiSecret,
                secure: true
            });

            // Read the image format; the reference intentionally omits it.
            const asset = await cloudinary.api.resource(publicId, {
                resource_type: "image",
                type: "authenticated"
            });

            if (!asset?.format) {
                return reply({ error: "Photo format not found." }, 404);
            }

            const url = cloudinary.utils.private_download_url(
                publicId,
                asset.format,
                {
                    resource_type: "image",
                    type: "authenticated",
                    attachment: false,
                    expires_at: Math.floor(Date.now() / 1000) + 300
                }
            );

            return reply({ url });
        } catch (error) {
            console.error("get-learner-photo failed:", error);
            return reply({ error: "Unable to retrieve learner photo." }, 500);
        }
    }
};

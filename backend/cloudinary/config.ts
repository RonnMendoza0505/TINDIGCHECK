/** Cloudinary server integration. NEVER import this file from the React frontend. */
export type CloudinaryConfig = { cloud: string; key: string; secret: string };

export function cloudinaryConfig(): CloudinaryConfig {
  const cloud = Deno.env.get("CLOUDINARY_CLOUD_NAME");
  const key = Deno.env.get("CLOUDINARY_API_KEY");
  const secret = Deno.env.get("CLOUDINARY_API_SECRET");
  if (!cloud || !key || !secret) throw new Error("Cloudinary server secrets are not configured.");
  return { cloud, key, secret };
}


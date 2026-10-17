import type { CloudinaryResourceType, CloudinaryAction } from "./types.ts";

/** Cloudinary Upload API requests must be signed on the server. */
export async function cloudinaryRequest(
  cloud: string, key: string, secret: string,
  resourceType: CloudinaryResourceType, action: CloudinaryAction,
  fields: Record<string, string>, file?: File,
): Promise<Record<string, unknown>> {
  const params = { ...fields, timestamp: String(Math.floor(Date.now() / 1000)) };
  const signingText = Object.entries(params)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, value]) => `${name}=${value}`).join("&") + secret;
  const digest = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(signingText));
  const signature = Array.from(new Uint8Array(digest), b => b.toString(16).padStart(2, "0")).join("");
  const form = new FormData();
  for (const [name, value] of Object.entries(params)) form.set(name, value);
  form.set("api_key", key);
  form.set("signature", signature);
  if (file) form.set("file", file, file.name);
  const response = await fetch(
    `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloud)}/${resourceType}/${action}`,
    { method: "POST", body: form },
  );
  const result = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok || result.error) {
    const error = result.error as { message?: string } | undefined;
    throw new Error(`Cloudinary ${action}: ${error?.message || `HTTP ${response.status}`}`);
  }
  return result;
}

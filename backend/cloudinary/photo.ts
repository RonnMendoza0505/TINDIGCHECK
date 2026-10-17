/** Cloudinary authenticated photo signing and resource lookup (server only). */
import { v2 as cloudinary } from "cloudinary";
import { cloudinaryConfig } from "./config.ts";

export async function getAuthenticatedLearnerPhotoUrl(publicId: string): Promise<string> {
  const { cloud, key, secret } = cloudinaryConfig();
  cloudinary.config({ cloud_name: cloud, api_key: key, api_secret: secret, secure: true });
  const asset = await cloudinary.api.resource(publicId, {
    resource_type: "image", type: "authenticated",
  });
  if (typeof asset?.format !== "string") throw new Error("Photo format not found.");
  return cloudinary.utils.private_download_url(publicId, asset.format, {
    resource_type: "image", type: "authenticated", attachment: false,
    expires_at: Math.floor(Date.now() / 1000) + 300,
  });
}

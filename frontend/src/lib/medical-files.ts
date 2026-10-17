import { supabase } from "./supabase";

/** Private medical file references are stored in learners.medical_files JSONB.
 * Uploads go through a protected Supabase Edge Function, which writes to
 * BOTH private Supabase Storage and authenticated Cloudinary assets. */
export const MAX_MEDICAL_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export type LearnerMedicalFile = {
  id: string;
  learner_id: string;
  original_name: string;
  storage_path: string;
  cloudinary_public_id: string;
  cloudinary_url?: string;
  cloudinary_resource_type: "raw" | "image";
  mime_type: string;
  size_bytes: number;
  created_at: string;
  uploaded_by: string;
};

export function validateMedicalFile(file: File): void {
  if (!ACCEPTED_MIME_TYPES.has(file.type)) throw new Error(`Unsupported medical file: ${file.name}. Use PDF, JPG, PNG or WEBP.`);
  if (file.size < 1 || file.size > MAX_MEDICAL_FILE_BYTES) throw new Error(`Medical file ${file.name} must be between 1 byte and 10 MB.`);
}

async function invokeMedical<T>(form: FormData): Promise<T> {
  const { data, error } = await supabase.functions.invoke<T>("manage-learner-medical", { body: form });
  if (error) {
    const context = (error as { context?: Response }).context;
    let serverMessage = "";
    if (context && typeof context.clone === "function") {
      try {
        const payload = await context.clone().json() as { error?: string; message?: string };
        serverMessage = payload.error || payload.message || "";
      } catch { /* The response may not be JSON. */ }
    }
    if (serverMessage) throw new Error(serverMessage);
    const message = error.message || "Unknown error";
    if (/failed to send|failed to fetch|not found|404/i.test(message)) {
      throw new Error(`Medical upload backend is unavailable. Deploy the manage-learner-medical Edge Function, then retry. (${message})`);
    }
    throw new Error(`Medical upload failed: ${message}`);
  }
  if (!data) throw new Error("The medical upload backend returned no data. Check Edge Function logs.");
  return data;
}

function medicalForm(action: string, learnerId: string, fileId?: string): FormData {
  const form = new FormData();
  form.set("action", action);
  form.set("learnerId", learnerId);
  if (fileId) form.set("fileId", fileId);
  return form;
}

export async function uploadMedicalFile(learnerId: string, file: File): Promise<LearnerMedicalFile> {
  validateMedicalFile(file);
  const form = medicalForm("upload", learnerId);
  form.set("file", file);
  const result = await invokeMedical<{ file: LearnerMedicalFile }>(form);
  return result.file;
}

export async function fetchMedicalFiles(learnerId: string): Promise<LearnerMedicalFile[]> {
  const result = await invokeMedical<{ files: LearnerMedicalFile[] }>(medicalForm("list", learnerId));
  return result.files;
}

export async function getMedicalFileUrl(file: LearnerMedicalFile): Promise<string> {
  const result = await invokeMedical<{ url: string }>(medicalForm("view", file.learner_id, file.id));
  return result.url;
}

export async function deleteMedicalFile(file: LearnerMedicalFile): Promise<void> {
  await invokeMedical<{ deleted: boolean }>(medicalForm("delete", file.learner_id, file.id));
}

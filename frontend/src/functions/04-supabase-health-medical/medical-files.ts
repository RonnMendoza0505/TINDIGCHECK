import { supabase } from "../../lib/supabase";

/** Part 04: private Supabase Storage uploads and database metadata. */
export const MEDICAL_BUCKET = "learner-medical-files";
export const MAX_MEDICAL_FILE_BYTES = 10 * 1024 * 1024;
const ACCEPTED_MIME_TYPES = new Set(["application/pdf", "image/jpeg", "image/png", "image/webp"]);

export type LearnerMedicalFile = {
    id: string;
    learner_id: string;
    original_name: string;
    storage_path: string;
    mime_type: string;
    size_bytes: number;
    created_at: string;
};

export function validateMedicalFile(file: File): void {
    if (!ACCEPTED_MIME_TYPES.has(file.type)) {
        throw new Error(`Unsupported medical file: ${file.name}. Use PDF, JPG, PNG or WEBP.`);
    }
    if (file.size === 0 || file.size > MAX_MEDICAL_FILE_BYTES) {
        throw new Error(`Medical file ${file.name} must be between 1 byte and 10 MB.`);
    }
}

/** A learner must exist first so the object and metadata can reference its UUID. */
export async function uploadMedicalFile(learnerId: string, file: File): Promise<LearnerMedicalFile> {
    validateMedicalFile(file);
    const suffix = file.name.split(".").pop()?.toLowerCase() || "bin";
    const path = `${learnerId}/${crypto.randomUUID()}.${suffix}`;
    const { error: uploadError } = await supabase.storage
        .from(MEDICAL_BUCKET)
        .upload(path, file, { contentType: file.type, upsert: false });
    if (uploadError) throw new Error(`Medical upload failed: ${uploadError.message}`);

    const { data, error } = await supabase
        .from("learner_medical_files")
        .insert({
            learner_id: learnerId,
            storage_path: path,
            original_name: file.name,
            mime_type: file.type,
            size_bytes: file.size
        })
        .select("id, learner_id, original_name, storage_path, mime_type, size_bytes, created_at")
        .single();
    if (error) {
        // Best effort cleanup: do not leave an unreferenced file if metadata insert fails.
        await supabase.storage.from(MEDICAL_BUCKET).remove([path]);
        throw new Error(`Medical file metadata could not be saved: ${error.message}`);
    }
    return data as LearnerMedicalFile;
}

export async function fetchMedicalFiles(learnerId: string): Promise<LearnerMedicalFile[]> {
    const { data, error } = await supabase
        .from("learner_medical_files")
        .select("id, learner_id, original_name, storage_path, mime_type, size_bytes, created_at")
        .eq("learner_id", learnerId)
        .order("created_at", { ascending: false });
    if (error) throw error;
    return (data ?? []) as LearnerMedicalFile[];
}

/** Signed links expire after 60 seconds; the bucket is never public. */
export async function getMedicalFileUrl(file: LearnerMedicalFile): Promise<string> {
    const { data, error } = await supabase.storage
        .from(MEDICAL_BUCKET)
        .createSignedUrl(file.storage_path, 60);
    if (error || !data?.signedUrl) throw new Error(error?.message || "Unable to open medical file.");
    return data.signedUrl;
}

export async function deleteMedicalFile(file: LearnerMedicalFile): Promise<void> {
    // Delete the private object first; if this fails, keep its metadata intact.
    const { error: storageError } = await supabase.storage
        .from(MEDICAL_BUCKET)
        .remove([file.storage_path]);
    if (storageError) throw storageError;
    const { error } = await supabase.from("learner_medical_files").delete().eq("id", file.id);
    if (error) throw error;
}

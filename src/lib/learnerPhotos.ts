
import { supabase } from "./supabase";

/*
    SYSTEM FUNCTION:
    Defines the response returned
    by the Supabase photo upload function.
*/
type PhotoUploadResult = {
    photo_url: string;
};

/*
    SYSTEM FUNCTION:
    Validates the selected profile picture
    before sending it to Cloudinary.
*/
export function validateLearnerPhoto(file: File): void {
    const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
    ];

    if (!allowedTypes.includes(file.type)) {
        throw new Error(
            "Only JPG, PNG, and WEBP images are allowed."
        );
    }

    if (file.size > 2 * 1024 * 1024) {
        throw new Error(
            "Profile picture must not exceed 2 MB."
        );
    }
}

/*
    SYSTEM FUNCTION:
    Sends the learner profile picture
    to the Supabase Edge Function.

    The Edge Function uploads the image
    to Cloudinary and returns its
    protected asset reference.
*/
export async function uploadLearnerPhoto(
    file: File
): Promise<string> {

    validateLearnerPhoto(file);

    const formData = new FormData();
    formData.append("file", file);

    const { data, error } =
        await supabase.functions.invoke<PhotoUploadResult>(
            "upload-learner-photo",
            {
                body: formData
            }
        );

    if (error) {
        throw new Error(
            `Photo upload failed: ${error.message}`
        );
    }

    if (!data?.photo_url) {
        throw new Error(
            "Photo upload did not return a reference."
        );
    }

    return data.photo_url;
}

/*
    SYSTEM FUNCTION:
    Requests a short-lived HTTPS viewing link for
    a learner's authenticated Cloudinary photo.
    The Supabase Edge Function checks account access.
*/
export async function getLearnerPhotoUrl(
    learnerId: string
): Promise<string> {
    const { data, error } = await supabase.functions.invoke<{ url: string }>(
        "get-learner-photo",
        { body: { learnerId } }
    );

    if (error) {
        throw new Error(`Could not load learner photo: ${error.message}`);
    }

    if (!data?.url) {
        throw new Error("No photo viewing URL was returned.");
    }

    return data.url;
}

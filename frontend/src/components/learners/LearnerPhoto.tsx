import { useEffect, useState } from "react";
import { getLearnerPhotoUrl } from "../../lib/learnerPhotos";

type Props = {
    learnerId: string;
    photoReference: string | null;
    size?: number;
};

/*
    SYSTEM FUNCTION:
    Displays a saved authenticated Cloudinary photo
    using a temporary viewing URL from Supabase.
*/
export default function LearnerPhoto({
    learnerId,
    photoReference,
    size = 48
}: Props) {
    const [url, setUrl] = useState<string | null>(null);
    const [status, setStatus] = useState<
        "empty" | "loading" | "ready" | "error"
    >("empty");

    useEffect(() => {
        let active = true;

        setUrl(null);
        if (!photoReference) {
            setStatus("empty");
            return;
        }

        setStatus("loading");
        void getLearnerPhotoUrl(learnerId)
            .then(photoUrl => {
                if (!active) return;
                setUrl(photoUrl);
                setStatus("ready");
            })
            .catch(error => {
                if (!active) return;
                console.error("Learner photo load failed:", error);
                setStatus("error");
            });

        return () => {
            active = false;
        };
    }, [learnerId, photoReference]);

    if (status === "empty") return <small>No photo</small>;
    if (status === "loading") return <small>Loading...</small>;
    if (status === "error" || !url) return <small>Unavailable</small>;

    return (
        <img
            src={url}
            alt="Learner profile"
            width={size}
            height={size}
            style={{
                width: size,
                height: size,
                objectFit: "cover",
                borderRadius: 8
            }}
            onError={() => setStatus("error")}
        />
    );
}

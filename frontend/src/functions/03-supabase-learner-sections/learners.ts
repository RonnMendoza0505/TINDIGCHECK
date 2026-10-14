
import { supabase } from "../../lib/supabase";
import type { UserProfile } from "../../types";

/*
    SYSTEM FUNCTION:
    Defines learner information retrieved
    from the Supabase learners table.

    photo_url stores the location of a
    previously uploaded profile picture.
*/
export type Learner = {
    id: string;
    student_id: string;
    last_name: string;
    first_name: string;
    middle_name: string | null;
    age: number;
    sex: string;
    grade: number;
    section: string;
    photo_url: string | null;
    has_food_allergy: boolean;
    allergies: string;
    date_of_birth: string | null;
};

/*
    SYSTEM FUNCTION:
    Defines the information used when
    creating or updating learner records.

    photo_url is optional so existing forms
    can continue working without a photo.

    When editing a learner without uploading
    a replacement image, the existing photo
    URL remains unchanged.
*/
export type LearnerInput =
    Omit<Learner, "id" | "photo_url"> & {
        photo_url?: string | null;
    };

/*
    SYSTEM FUNCTION:
    Retrieves learner records from Supabase.

    Viewer accounts only request learner
    records belonging to their assigned
    Grade and Section.

    Supabase Row Level Security must also
    enforce these access restrictions.
*/
export async function fetchLearners(
    user: UserProfile
): Promise<Learner[]> {

    let query = supabase
        .from("learners")
        .select(
            "id, student_id, last_name, first_name, middle_name, age, sex, grade, section, photo_url, has_food_allergy, allergies, date_of_birth"
        )
        .order("last_name", {
            ascending: true
        })
        .order("first_name", {
            ascending: true
        });

    /*
        SYSTEM FUNCTION:
        Restricts Viewer accounts to the
        assigned Grade and Section.
    */
    if (user.role === "Viewer") {

        if (!user.grade || !user.section) {
            return [];
        }

        query = query
            .eq("grade", Number(user.grade))
            .eq("section", user.section);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    /*
        SYSTEM FUNCTION:
        Converts database records into
        the structure used by the React
        Learner Management component.
    */
    return (data || []).map(row => ({
        id: String(row.id),

        student_id: String(
            row.student_id ?? ""
        ),

        last_name: String(
            row.last_name ?? ""
        ),

        first_name: String(
            row.first_name ?? ""
        ),

        middle_name:
            row.middle_name == null
                ? null
                : String(row.middle_name),

        age: Number(row.age),

        sex: String(
            row.sex ?? ""
        ),

        grade: Number(row.grade),

        section: String(
            row.section ?? ""
        ),

        photo_url:
            row.photo_url == null
                ? null
                : String(row.photo_url),

        has_food_allergy: row.has_food_allergy === true,
        allergies: String(row.allergies ?? ""),
        date_of_birth: row.date_of_birth == null ? null : String(row.date_of_birth)
    }));
}

/*
    SYSTEM FUNCTION:
    Checks whether the entered Learner ID
    already exists in Supabase.

    During editing, the current learner
    is excluded from the duplicate check.
*/
export async function checkDuplicateLearnerId(
    studentId: string,
    excludeId?: string
): Promise<boolean> {

    let query = supabase
        .from("learners")
        .select("id")
        .eq("student_id", studentId);

    if (excludeId) {
        query = query.neq("id", excludeId);
    }

    const { data, error } = await query;

    if (error) {
        throw error;
    }

    return (data || []).length > 0;
}

/*
    SYSTEM FUNCTION:
    Inserts a new learner profile
    into the Supabase learners table.

    If an uploaded photo URL is supplied,
    it will be saved with the profile.
*/
export async function createLearner(
    input: LearnerInput
): Promise<string> {

    const { data, error } = await supabase
        .from("learners")
        .insert(input)
        .select("id")
        .single();

    if (error) throw error;
    return String(data.id);
}

/*
    SYSTEM FUNCTION:
    Updates an existing learner profile
    using the learner's database ID.

    If photo_url is not included in input,
    the existing photograph is preserved.
*/
export async function updateLearner(
    id: string,
    input: LearnerInput
): Promise<void> {

    const { error } = await supabase
        .from("learners")
        .update(input)
        .eq("id", id);

    if (error) {
        throw error;
    }
}

/*
    SYSTEM FUNCTION:
    Deletes the selected learner profile
    from the Supabase learners table.

    Related health records may restrict
    deletion depending on foreign keys.
*/
export async function deleteLearner(
    id: string
): Promise<void> {

    const { error } = await supabase
        .from("learners")
        .delete()
        .eq("id", id);

    if (error) {
        throw error;
    }
}

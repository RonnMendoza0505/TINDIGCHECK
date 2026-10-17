/** Member 3 — writes learner basic information into Supabase.
 * Member 2 owns the manual input forms; database RLS enforces authorization. */
import { supabase } from "./supabase";
import type { LearnerInput } from "./learners";

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


import { supabase } from "./supabase";

/*
    SYSTEM FUNCTION:
    Describes an existing Section record
    using the verified Supabase columns.
*/
export type SchoolSection = {
    id: number;
    grade: number;
    section_name: string;
    created_at: string | null;
};

/*
    SYSTEM FUNCTION:
    Retrieves Sections from the existing
    public.sections table.

    Results are organized by Grade
    and Section name.
*/
/*
    SYSTEM FUNCTION:
    Retrieves section records from Supabase
    and checks whether the database query succeeds.
*/
export async function fetchSections(): Promise<SchoolSection[]> {
    const { data, error } = await supabase
        .from("sections")
        .select("id, grade, section_name")
        .order("grade")
        .order("section_name");

    console.log("SECTION QUERY DATA:", data);
    console.log("SECTION QUERY ERROR:", error);

    if (error) {
        throw error;
    }

    return (data || []) as SchoolSection[];
}

/*
    SYSTEM FUNCTION:
    Returns Section records belonging
    to the specified Grade.
*/
export function getSectionsForGrade(
    sections: SchoolSection[],
    grade: number
): SchoolSection[] {
    return sections.filter(
        section => section.grade === grade
    );
}

/*
    SYSTEM FUNCTION:
    Adds a new Section to Supabase.

    The id column is deliberately omitted
    because the database should generate it.
    Verify that id is an identity/sequence
    column before using this function.
*/
export async function createSection(
    grade: number,
    sectionName: string
): Promise<void> {

    const { data, error } = await supabase
        .from("sections")
        .insert({
            grade,
            section_name: sectionName.trim()
        })
        .select("id")
        .single();

    if (error) {
        throw error;
    }

    if (!data) {
        throw new Error(
            "Section creation could not be confirmed."
        );
    }
}

/*
    SYSTEM FUNCTION:
    Updates the Grade and Section name
    for an existing Section record.
*/
export async function updateSection(
    id: number,
    grade: number,
    sectionName: string
): Promise<void> {

    const { data, error } = await supabase
        .from("sections")
        .update({
            grade,
            section_name: sectionName.trim()
        })
        .eq("id", id)
        .select("id")
        .single();

    if (error) {
        throw error;
    }

    if (!data) {
        throw new Error(
            "Section update could not be confirmed."
        );
    }
}

/*
    SYSTEM FUNCTION:
    Deletes a Section record by ID.

    Existing relationships may prevent
    deletion, depending on database rules.
*/
export async function deleteSection(
    id: number
): Promise<void> {

    const { data, error } = await supabase
        .from("sections")
        .delete()
        .eq("id", id)
        .select("id")
        .single();

    if (error) {
        throw error;
    }

    if (!data) {
        throw new Error(
            "Section deletion could not be confirmed."
        );
    }
}

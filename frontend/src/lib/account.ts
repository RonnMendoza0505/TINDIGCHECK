
import { supabase } from "./supabase";
import type {
    UserProfile,
    UserRole
} from "../types";

/*
    SYSTEM FUNCTION:
    Defines the valid account roles
    supported by the application.
*/
const VALID_ROLES: UserRole[] = [
    "Super Admin",
    "Admin",
    "Viewer"
];

/*
    SYSTEM FUNCTION:
    Retrieves the authenticated user's
    email, name, role, assigned Grade,
    and assigned Section from Supabase.
*/
export async function loadUserProfile():
    Promise<UserProfile | null> {

    const { data: authData, error: authError } =
        await supabase.auth.getUser();

    if (authError || !authData.user) {
        return null;
    }

    const user = authData.user;

    const { data, error } = await supabase
        .from("user_profiles")
        .select("id, full_name, role, grade, section")
        .eq("id", user.id)
        .single();

    if (error || !data) {
        throw new Error(
            "Unable to load user profile: " +
            (error?.message || "Profile not found")
        );
    }

    /*
        SYSTEM FUNCTION:
        Rejects unknown roles rather than
        granting access to an unrecognized account.
    */
    if (!VALID_ROLES.includes(data.role as UserRole)) {
        throw new Error(
            "Your account has an invalid role."
        );
    }

    const role = data.role as UserRole;

    /*
        SYSTEM FUNCTION:
        Requires assigned Grade and Section
        for Viewer accounts.
    */
    if (
        role === "Viewer" &&
        (data.grade == null || !data.section)
    ) {
        throw new Error(
            "Viewer Grade and Section are not assigned."
        );
    }

    return {
        id: user.id,
        email: user.email || "",
        full_name: data.full_name || user.email || "USER",
        role,
        grade: data.grade == null
            ? null
            : String(data.grade),
        section: data.section == null
            ? null
            : String(data.section)
    };
}


/*
    SYSTEM FUNCTION:
    Defines the three account roles
    supported by TINDIGCHECK! 2.0.
*/
export type UserRole =
    | "Super Admin"
    | "Admin"
    | "Viewer";

/*
    SYSTEM FUNCTION:
    Defines the authenticated user's
    information from the Supabase
    user_profiles table.
*/
export type UserProfile = {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    grade: string | null;
    section: string | null;
};

/*
    SYSTEM FUNCTION:
    Defines the available application
    page identifiers.
*/


/*
    SYSTEM FUNCTION:
    Defines all available application pages
    for TINDIGCHECK! 2.0 navigation.
*/
export type PageId =
    | "dashboard"
    | "learners"
    | "sections"
    | "health-monitoring"
    | "health-plot"
    | "recent-health-records"
    | "health-records"
    | "meal-recommendations"
    | "account-management"
    | "activity-logs"
    | "system-diagnostics"
    | "learner-tools"
    | "learner-excel"
    | "learner-report";

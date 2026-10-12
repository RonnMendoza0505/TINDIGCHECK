
import type {
    PageId,
    UserProfile,
    UserRole
} from "../types";

/*
    SYSTEM FUNCTION:
    Defines which application pages
    each account role can access.
*/
const ROLE_PAGES: Record<UserRole, PageId[]> = {
    "Super Admin": [
        "dashboard",
        "learners",
        "learner-tools",
        "learner-excel",
        "sections",
        "health-monitoring",
        "health-plot",
        "recent-health-records",
        "activity-logs",
        "health-records",
        "meal-recommendations",
        "system-diagnostics",
        "account-management"
    ],

    "Admin": [
        "dashboard",
        "learners",
        "learner-tools",
        "learner-excel",
        "sections",
        "health-monitoring",
        "health-plot",
        "recent-health-records",
        "health-records",
        "meal-recommendations",
        "account-management"
    ],

    "Viewer": [
        "dashboard",
        "learners",
        "health-plot",
        "recent-health-records",
        "health-records",
        "meal-recommendations"
    ]
};

/*
    SYSTEM FUNCTION:
    Checks whether a user can
    access a selected page.
*/
export function canAccessPage(
    role: UserRole,
    page: PageId
): boolean {
    return ROLE_PAGES[role].includes(page);
}

/*
    SYSTEM FUNCTION:
    Determines if an account can
    add or modify learner records.
*/
export function canManageLearners(
    role: UserRole
): boolean {
    return role === "Super Admin" ||
        role === "Admin";
}

/*
    SYSTEM FUNCTION:
    Determines whether an account
    can manage Grade and Section records.
*/
export function canManageSections(
    role: UserRole
): boolean {
    return role === "Super Admin";
}

/*
    SYSTEM FUNCTION:
    Determines whether the logged-in
    user may create the requested role.
*/
export function canCreateRole(
    currentRole: UserRole,
    targetRole: UserRole
): boolean {
    if (currentRole === "Super Admin") {
        return true;
    }

    return currentRole === "Admin" &&
        targetRole === "Viewer";
}

/*
    SYSTEM FUNCTION:
    Checks whether a learner belongs
    to the Viewer's assigned Grade
    and Section.

    Administrative accounts can view
    learners across all sections.
*/
export function canViewLearner(
    user: UserProfile,
    learnerGrade: string,
    learnerSection: string
): boolean {
    if (user.role !== "Viewer") {
        return true;
    }

    return user.grade === learnerGrade &&
        user.section === learnerSection;
}

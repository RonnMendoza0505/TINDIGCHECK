import type { PageId } from "../types";

/*
    SYSTEM FUNCTION:
    Defines each navigation item shown
    in the sidebar and its page identifier.
*/
export const NAVIGATION: {
    id: PageId;
    label: string;
    icon: string;
}[] = [
    {
        id: "dashboard",
        label: "Dashboard",
        icon: "▦"
    },
    {
        id: "learners",
        label: "Learner Management",
        icon: "♙"
    },
    {
        id: "learner-tools",
        label: "Add Learner & Excel",
        icon: "+"
    },
    { id: "learner-excel", label: "Import & Export Excel", icon: "▤" },
    { id: "learner-report", label: "Print Health Report", icon: "▣" },
    /*
    SYSTEM FUNCTION:
    Adds Section Management
    to the application sidebar.
    */
    {
        id: "sections",
        label: "Section Management",
        icon: "▦"
    },
    {
        id: "health-monitoring",
        label: "Health Monitoring",
        icon: "♡"
    },
    {
        id: "health-plot",
        label: "Health Plot",
        icon: "▥"
    },
    {
        id: "health-records",
        label: "Health Records",
        icon: "▤"
    },
    {
        id: "meal-recommendations",
        label: "Meal Recommendations",
        icon: "♧"
    },
    {
        id: "account-management",
        label: "Account Management",
        icon: "⚙"
    },
    {
        id: "activity-logs",
        label: "Activity Logs",
        icon: "◷"
    },
    {
        id: "system-diagnostics",
        label: "System Diagnostics",
        icon: "▣"
    }
];

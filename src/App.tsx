import LearnerManagement from "./pages/learners";
import { useEffect, useState } from "react";

import { supabase } from "./lib/supabase";
import { loadUserProfile } from "./lib/account";

import Login from "./pages/login";
import Sidebar from "./components/Sidebar";

import { NAVIGATION } from "./constants/navigation";
import { canAccessPage } from "./providers/access-control";
import SectionManagement from "./pages/sections";

import type {
    PageId,
    UserProfile
} from "./types";

import "./App.css";
import "./styles/tindig-professional.css";
import "./styles/tindig-green-admin-headings.css";

/*
    SYSTEM FUNCTION:
    Controls authentication, account profiles,
    navigation, and the main React interface.
*/
export default function App() {

    /*
        SYSTEM FUNCTION:
        Stores the authenticated account,
        current page, loading status, and errors.
    */
    const [user, setUser] =
        useState<UserProfile | null>(null);

    const [activePage, setActivePage] =
        useState<PageId>("dashboard");

    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    /*
        SYSTEM FUNCTION:
        Loads the user's Supabase account profile
        and verifies their assigned role.
    */
    async function refreshAccount() {
        setLoading(true);
        setError("");

        try {
            const profile = await loadUserProfile();

            setUser(profile);
            setActivePage("dashboard");

        } catch (err) {
            setUser(null);

            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load account."
            );
        } finally {
            setLoading(false);
        }
    }

    /*
        SYSTEM FUNCTION:
        Restores an existing login session
        when the application starts.
    */
    useEffect(() => {
        void refreshAccount();
    }, []);

    /*
        SYSTEM FUNCTION:
        Allows page navigation only when
        the current user has permission.
    */
    function navigateTo(page: PageId) {
        if (!user) return;

        if (!canAccessPage(user.role, page)) {
            return;
        }

        setActivePage(page);
    }

    /*
        SYSTEM FUNCTION:
        Signs the user out of Supabase
        and returns to the Login page.
    */
    async function handleLogout() {
        const { error: logoutError } =
            await supabase.auth.signOut();

        if (logoutError) {
            setError(logoutError.message);
            return;
        }

        setUser(null);
        setActivePage("dashboard");
        setError("");
    }

    /*
        SYSTEM FUNCTION:
        Displays a loading message while
        checking the user's account.
    */
    if (loading) {
        return (
            <div className="loading-screen">
                Loading TINDIGCHECK! 2.0...
            </div>
        );
    }

    /*
        SYSTEM FUNCTION:
        Displays the login screen when
        there is no authenticated profile.
    */
    if (!user) {
        return (
            <>
                {error && (
                    <p className="startup-error" role="alert">
                        {error}
                    </p>
                )}

                <Login onLoginSuccess={refreshAccount} />
            </>
        );
    }

    /*
        SYSTEM FUNCTION:
        Retrieves the title of the selected
        page for temporary module placeholders.
    */
    const currentPage = NAVIGATION.find(
        item => item.id === activePage
    );

    /*
        SYSTEM FUNCTION:
        Displays the full application layout
        after successful authentication.
    */
    return (
        <div className="app-layout">

            <Sidebar
                user={user}
                activePage={activePage}
                onNavigate={navigateTo}
                onLogout={handleLogout}
            />

            <main className="app-content">

                {error && (
                    <p role="alert" className="startup-error">
                        {error}
                    </p>
                )}

                


{/*
    SYSTEM FUNCTION:
    For this development milestone, only Learner Management
    and Section Management are connected to working modules.
    All other sidebar destinations show a large page heading
    with an otherwise blank content area.

    Authentication, logout, navigation, and existing role
    restrictions remain unchanged.
*/}
{activePage === "learners" ||
 activePage === "learner-tools" ||
 activePage === "learner-excel" ? (
    <LearnerManagement
        user={user}
        mode={
            activePage === "learner-excel"
                ? "excel"
                : activePage === "learner-tools"
                    ? "tools"
                    : "directory"
        }
        onNavigateToTools={() => navigateTo("learner-tools")}
    />
) : activePage === "sections" ? (
    <SectionManagement user={user} />
) : (
    <section className="tdc-empty-module" aria-label={currentPage?.label || "Module"}>
        <h1 className="tdc-empty-module__title">
            {currentPage?.label || "Module"}
        </h1>
    </section>
)}


            </main>

        </div>
    );
}

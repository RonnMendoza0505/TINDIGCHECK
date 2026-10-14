import "./learner-menu.css";
import { useEffect, useState } from "react";
import { NAVIGATION } from "../constants/navigation";
import { canAccessPage } from "../providers/access-control";
import type { PageId, UserProfile } from "../types";

type SidebarProps = {
    user: UserProfile;
    activePage: PageId;
    onNavigate: (page: PageId) => void;
    onLogout: () => Promise<void>;
};

/** Responsive navigation. Keep a short primary menu; put extra modules under More. */
export default function Sidebar({ user, activePage, onNavigate, onLogout }: SidebarProps) {
    const [mobileOpen, setMobileOpen] = useState(false);
    const [moreOpen, setMoreOpen] = useState(false);
    const [learnersOpen, setLearnersOpen] = useState(activePage === "learners" || activePage === "learner-tools" || activePage === "learner-excel" || activePage === "learner-report");
    const allowedPages = NAVIGATION.filter(item => canAccessPage(user.role, item.id));
    const learnerPages = allowedPages.filter(item => item.id === "learners" || item.id === "learner-tools" || item.id === "learner-excel" || item.id === "learner-report");
    const regularPages = allowedPages.filter(item => item.id !== "learners" && item.id !== "learner-tools" && item.id !== "learner-excel" && item.id !== "learner-report");
    const primaryPages = regularPages.slice(0, 6);
    const morePages = regularPages.slice(6);
    const activeIsMore = morePages.some(item => item.id === activePage);

    useEffect(() => {
        setMobileOpen(false);
        setMoreOpen(false);
        if (activePage === "learners" || activePage === "learner-tools" || activePage === "learner-excel" || activePage === "learner-report") setLearnersOpen(true);
    }, [activePage]);

    function goTo(page: PageId) {
        onNavigate(page);
        setMobileOpen(false);
        setMoreOpen(false);
    }

    function renderNavLink(item: (typeof NAVIGATION)[number]) {
        return (
            <button
                key={item.id}
                type="button"
                className={activePage === item.id ? "nav-link active" : "nav-link"}
                onClick={() => goTo(item.id)}
                aria-current={activePage === item.id ? "page" : undefined}
            >
                <span className="nav-symbol" aria-hidden="true">{item.icon}</span>
                <span>{item.label}</span>
            </button>
        );
    }

    return (
        <>
            <aside className={`sidebar${mobileOpen ? " sidebar--open" : ""}`}>
                <div className="sidebar-brand">
                    <div className="brand-symbol" aria-hidden="true">+</div>
                    <div>
                        <h2>TINDIGCHECK!</h2>
                        <p>School Health Monitoring</p>
                    </div>
                </div>
                <button
                    type="button"
                    className="tdc-sidebar-mobile-toggle"
                    aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
                    aria-expanded={mobileOpen}
                    aria-controls="tdc-main-navigation"
                    onClick={() => setMobileOpen(open => !open)}
                >
                    {mobileOpen ? "×" : "☰"}
                </button>
                <nav id="tdc-main-navigation" className="sidebar-navigation" aria-label="Main navigation">
                    {primaryPages[0] && renderNavLink(primaryPages[0])}
                    {learnerPages.length > 0 && (
                        <div className="tdc-learner-menu">
                            <button
                                type="button"
                                className={activePage === "learners" || activePage === "learner-tools" || activePage === "learner-excel" || activePage === "learner-report" ? "nav-link active" : "nav-link"}
                                aria-expanded={learnersOpen}
                                aria-controls="tdc-learner-submenu"
                                onClick={() => setLearnersOpen(open => !open)}
                            >
                                <span className="nav-symbol" aria-hidden="true">♙</span>
                                <span>Learner Management {learnersOpen ? "▴" : "▾"}</span>
                            </button>
                            {learnersOpen && (
                                <div id="tdc-learner-submenu" className="tdc-learner-submenu">
                                    {learnerPages.map(item => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className={activePage === item.id ? "nav-link active" : "nav-link"}
                                            onClick={() => goTo(item.id)}
                                            aria-current={activePage === item.id ? "page" : undefined}
                                        >
                                            <span className="nav-symbol" aria-hidden="true">{item.id === "learners" ? "▤" : item.id === "learner-tools" ? "+" : item.id === "learner-excel" ? "▣" : "▤"}</span>
                                            <span>{item.id === "learners" ? "Learner Directory" : item.id === "learner-tools" ? "Add Learner" : item.id === "learner-excel" ? "Import & Export Excel" : "Print Health Report"}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {primaryPages.slice(1).map(renderNavLink)}
                    {morePages.length > 0 && (
                        <div className="tdc-sidebar-more">
                            <button
                                type="button"
                                className={activeIsMore ? "nav-link active" : "nav-link"}
                                aria-expanded={moreOpen}
                                onClick={() => setMoreOpen(open => !open)}
                            >
                                <span className="nav-symbol" aria-hidden="true">⋯</span>
                                <span>More modules {moreOpen ? "▴" : "▾"}</span>
                            </button>
                            {moreOpen && (
                                <div className="tdc-sidebar-more-menu" aria-label="Additional modules">
                                    {morePages.map(renderNavLink)}
                                </div>
                            )}
                        </div>
                    )}
                </nav>
                <div className="sidebar-footer">
                    <div className="account-summary">
                        <strong>{user.full_name}</strong>
                        <span>{user.role}</span>
                        {user.role === "Viewer" && (
                            <small>Grade {user.grade} — {user.section}</small>
                        )}
                    </div>
                    <button type="button" className="logout-button" onClick={() => void onLogout()}>
                        Logout
                    </button>
                </div>
            </aside>
            {mobileOpen && (
                <button
                    type="button"
                    className="tdc-sidebar-backdrop"
                    aria-label="Close navigation"
                    onClick={() => setMobileOpen(false)}
                />
            )}
        </>
    );
}

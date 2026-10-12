import { useEffect, useState } from "react";
import { fetchDashboardSnapshot } from "../../lib/dashboardAnalytics";
import type { DashboardHealthRecord, DashboardSnapshot } from "../../lib/dashboardAnalytics";
import type { PageId, UserProfile } from "../../types";
import "./index.css";

/* PHASE 9 — Live Dashboard Analytics. Existing navigation remains unchanged. */
type DashboardProps = {
    user: UserProfile;
    onNavigate: (page: PageId) => void;
};

function formatDate(value: string | null): string {
    if (!value) return "—";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "—";
    return new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit"
    }).format(date);
}

function displayNumber(value: number | null, unit = ""): string {
    return value === null ? "—" : `${Number(value.toFixed(2))}${unit}`;
}

function learnerName(record: DashboardHealthRecord, snapshot: DashboardSnapshot): string {
    const learner = snapshot.learnersById[record.learner_id];
    if (!learner) return "Learner unavailable";
    return `${learner.last_name}, ${learner.first_name}`;
}

const SHORTCUTS: {
    page: PageId;
    icon: string;
    title: string;
    description: string;
    staffOnly?: boolean;
}[] = [
    { page: "learners", icon: "♙", title: "Learner Management", description: "Profiles, Grade, Section and allergies" },
    { page: "health-monitoring", icon: "♡", title: "Health Monitoring", description: "Save measurements", staffOnly: true },
    { page: "health-plot", icon: "▥", title: "Health Plot", description: "Explore measurement trends" },
    { page: "health-records", icon: "▤", title: "Health Records", description: "Review recorded results" },
    { page: "meal-recommendations", icon: "♧", title: "Meal Recommendations", description: "Review meal examples and allergies" },
    { page: "account-management", icon: "⚙", title: "Account Management", description: "Manage permitted user accounts", staffOnly: true }
];

export default function Dashboard({ user, onNavigate }: DashboardProps) {
    const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        let active = true;
        fetchDashboardSnapshot(user)
            .then(result => {
                if (!active) return;
                setSnapshot(result);
                setError("");
            })
            .catch(reason => {
                if (!active) return;
                setSnapshot(null);
                setError(reason instanceof Error ? reason.message : "Unable to load dashboard statistics.");
            })
            .finally(() => {
                if (active) setLoading(false);
            });
        return () => { active = false; };
    }, [user, refreshKey]);

    function refresh() {
        setLoading(true);
        setError("");
        setRefreshKey(value => value + 1);
    }

    const maxGradeCount = Math.max(1, ...(snapshot?.gradeCounts.map(item => item.count) ?? [1]));
    const viewer = user.role === "Viewer";

    return (
        <div className="dashboard-page tdc-dashboard">
            <header className="dashboard-heading tdc-dashboard-header">
                <div>
                    <p className="eyebrow">SCHOOL HEALTH MONITORING SYSTEM</p>
                    <h1>HI {user.full_name}! TINDIGCHECK!</h1>
                    <p>Live overview of accessible learner profiles and recorded measurements.</p>
                </div>
                <div className="tdc-dashboard-header-actions">
                    <div className="role-card">
                        <span>Account Role</span>
                        <strong>{user.role}</strong>
                    </div>
                    <button type="button" className="tdc-refresh-button" onClick={refresh} disabled={loading}>
                        {loading ? "Refreshing…" : "↻ Refresh data"}
                    </button>
                </div>
            </header>

            {viewer && (
                <div className="assigned-section" aria-label="Viewer assigned section">
                    Assigned Grade: {user.grade ?? "Not assigned"} | Section: {user.section ?? "Not assigned"}
                </div>
            )}

            {error && (
                <div className="tdc-dashboard-error" role="alert">
                    <strong>Dashboard data could not be loaded.</strong>
                    <p>{error}</p>
                    <p>Check the Supabase connection and Phase 8 RLS policies. Do not disable RLS to fix this.</p>
                </div>
            )}

            {loading && !snapshot && <p className="tdc-dashboard-loading" role="status">Loading dashboard statistics from Supabase…</p>}

            {snapshot && (
                <>
                    <div className="tdc-dashboard-subheading">
                        <h2 className="section-heading">Monitoring Overview</h2>
                        <small>Updated {formatDate(snapshot.updatedAt)} · Philippine time</small>
                    </div>
                    <div className="tdc-dashboard-stats">
                        <div className="tdc-stat-card">
                            <span>Accessible learners</span>
                            <strong>{snapshot.learnerCount.toLocaleString()}</strong>
                            <small>{viewer ? "Your assigned Grade and Section" : "Across authorized Grades and Sections"}</small>
                        </div>
                        <div className="tdc-stat-card">
                            <span>{viewer ? "Visible health records" : "Total health records"}</span>
                            <strong>{snapshot.healthRecordCount.toLocaleString()}</strong>
                            <small>{viewer ? "Latest two per learner, enforced by RLS" : "All accessible saved measurements"}</small>
                        </div>
                        <div className="tdc-stat-card">
                            <span>Measurements · last 7 days</span>
                            <strong>{snapshot.recordsLast7Days.toLocaleString()}</strong>
                            <small>{viewer ? "Within your visible records" : "Rolling seven-day period"}</small>
                        </div>
                        <div className="tdc-stat-card">
                            <span>Measurements · last 30 days</span>
                            <strong>{snapshot.recordsLast30Days.toLocaleString()}</strong>
                            <small>{viewer ? "Within your visible records" : "Rolling thirty-day period"}</small>
                        </div>
                    </div>

                    <div className="tdc-dashboard-panels">
                        <section className="tdc-dashboard-panel" aria-label="Grade distribution">
                            <h2>Number of Learners by Grade</h2>
                            <p>Based on accessible learner profiles.</p>
                            <div className="tdc-grade-bars">
                                {snapshot.gradeCounts.map(item => (
                                    <div className="tdc-grade-row" key={item.grade}>
                                        <span>Grade {item.grade}</span>
                                        <div className="tdc-grade-track" aria-hidden="true">
                                            <div style={{ width: `${(item.count / maxGradeCount) * 100}%` }} />
                                        </div>
                                        <strong>{item.count}</strong>
                                    </div>
                                ))}
                            </div>
                        </section>
                        <section className="tdc-dashboard-panel" aria-label="Profile data completeness">
                            <h2>Learner Profile Overview</h2>
                            <p>Administrative data counts, not medical diagnoses.</p>
                            <div className="tdc-profile-stat">
                                <div>
                                    <strong>Food allergy indicated</strong>
                                    <small>Profiles with the food-allergy checkbox selected</small>
                                </div>
                                <b>{snapshot.knownAllergyCount}</b>
                            </div>
                            <div className="tdc-profile-stat">
                                <div>
                                    <strong>Date of Birth missing</strong>
                                    <small>These profiles cannot be reliably classified by BMI-for-age</small>
                                </div>
                                <b>{snapshot.missingBirthDateCount}</b>
                            </div>
                            <p className="tdc-profile-note">
                                An unchecked allergy box does not confirm that a learner has no allergies.
                                BMI status is a screening category, not a diagnosis.
                            </p>
                        </section>
                    </div>

                    <section className="tdc-dashboard-panel tdc-latest-panel" aria-label="Latest measurements">
                        <div className="tdc-latest-heading">
                            <div>
                                <h2>Latest Measurements</h2>
                                <p>Most recent eight accessible records. Open Health Records for the full permitted history.</p>
                            </div>
                            <button type="button" className="tdc-outline-button" onClick={() => onNavigate("health-records")}>Open Health Records →</button>
                        </div>
                        {snapshot.latestRecords.length === 0 ? (
                            <p className="tdc-empty">No saved health measurements are available for your account.</p>
                        ) : (
                            <div className="tdc-dashboard-table-scroll">
                                <table className="tdc-dashboard-table">
                                    <thead>
                                        <tr>
                                            <th>Recorded (PHT)</th>
                                            <th>Learner</th>
                                            <th>Weight</th>
                                            <th>Height</th>
                                            <th>Heart Rate</th>
                                            <th>SpO₂</th>
                                            <th>BMI</th>
                                            <th>BMI Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {snapshot.latestRecords.map(record => (
                                            <tr key={record.id}>
                                                <td>{formatDate(record.recorded_at)}</td>
                                                <td>{learnerName(record, snapshot)}</td>
                                                <td>{displayNumber(record.weight, " kg")}</td>
                                                <td>{displayNumber(record.height, " cm")}</td>
                                                <td>{displayNumber(record.heart_rate, " bpm")}</td>
                                                <td>{displayNumber(record.spo2, "%")}</td>
                                                <td>{displayNumber(record.bmi)}</td>
                                                <td>{record.bmi_status}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </>
            )}

            <h2 className="section-heading tdc-shortcut-heading">System Modules</h2>
            <div className="dashboard-grid">
                {SHORTCUTS.filter(item => !item.staffOnly || !viewer).map(item => (
                    <button
                        key={item.page}
                        type="button"
                        className="module-card"
                        onClick={() => onNavigate(item.page)}
                    >
                        <span className="module-icon" aria-hidden="true">{item.icon}</span>
                        <strong>{item.title}</strong>
                        <small>{item.description}</small>
                    </button>
                ))}
            </div>
        </div>
    );
}

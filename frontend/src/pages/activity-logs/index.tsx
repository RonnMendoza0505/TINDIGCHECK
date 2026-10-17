import { useEffect, useState, type FormEvent } from "react";
import type { UserProfile } from "../../types";
import {
    fetchActivityLogs,
    type ActivityAction,
    type ActivityEntity,
    type ActivityFilters,
    type ActivityPage
} from "../../lib/activityLogs";
import "./index.css";

type Props = { user: UserProfile };

const DEFAULT_FILTERS: ActivityFilters = {
    action: "all",
    entity: "all",
    learnerId: "",
    fromDate: "",
    toDate: "",
    page: 0
};

function formatDateTime(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        year: "numeric", month: "short", day: "numeric",
        hour: "numeric", minute: "2-digit", second: "2-digit"
    }).format(date);
}

function eventLabel(action: ActivityAction): string {
    return action === "INSERT" ? "Created" : action === "UPDATE" ? "Updated" : "Deleted";
}

function entityLabel(entity: ActivityEntity): string {
    return entity === "learner" ? "Learner profile" : entity === "section" ? "Section" : entity === "account" ? "Staff account" : "Health record";
}

export default function ActivityLogs({ user }: Props) {
    const [draft, setDraft] = useState<ActivityFilters>({ ...DEFAULT_FILTERS });
    const [filters, setFilters] = useState<ActivityFilters>({ ...DEFAULT_FILTERS });
    const [result, setResult] = useState<ActivityPage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refreshKey, setRefreshKey] = useState(0);

    useEffect(() => {
        if (user.role !== "Super Admin") return;
        let active = true;
        fetchActivityLogs(filters)
            .then(data => {
                if (!active) return;
                setResult(data);
                setError("");
            })
            .catch(reason => {
                if (!active) return;
                setResult(null);
                setError(reason instanceof Error ? reason.message : "Unable to load activity logs.");
            })
            .finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [filters, refreshKey, user.role]);

    if (user.role !== "Super Admin") {
        return <section className="tdc-activity"><h1>Access denied</h1><p>Activity Logs are available only to Super Admin.</p></section>;
    }

    function applyFilters(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (draft.fromDate && draft.toDate && draft.fromDate > draft.toDate) {
            setError("The start date must be on or before the end date.");
            return;
        }
        setError("");
        setLoading(true);
        setFilters({ ...draft, learnerId: draft.learnerId.trim(), page: 0 });
    }

    function resetFilters() {
        setDraft({ ...DEFAULT_FILTERS });
        setFilters({ ...DEFAULT_FILTERS });
        setLoading(true);
        setError("");
        setRefreshKey(value => value + 1);
    }

    function changePage(nextPage: number) {
        setLoading(true);
        setFilters(previous => ({ ...previous, page: nextPage }));
    }

    const total = result?.total ?? 0;
    const totalPages = Math.max(1, Math.ceil(total / (result?.pageSize ?? 25)));
    const currentPage = filters.page + 1;

    return (
        <section className="tdc-activity">
            <header className="tdc-activity-heading">
                <div>
                    <p className="tdc-activity-eyebrow">TINDIGCHECK! 2.0 · SUPER ADMIN</p>
                    <h1>System Activity Logs</h1>
                    <p>Review changes to learner profiles, health records, class sections, and staff accounts. No measurement values or allergy details are copied into these logs.</p>
                </div>
                <button type="button" className="tdc-activity-primary" disabled={loading}
                    onClick={() => { setLoading(true); setRefreshKey(value => value + 1); }}>
                    {loading ? "Loading…" : "↻ Refresh"}
                </button>
            </header>

            <form className="tdc-activity-filters" onSubmit={applyFilters}>
                <label>Record type
                    <select value={draft.entity} onChange={e => setDraft(prev => ({ ...prev, entity: e.target.value as ActivityFilters["entity"], learnerId: (e.target.value === "section" || e.target.value === "account") ? "" : prev.learnerId }))}>
                        <option value="all">All records</option>
                        <option value="learner">Learner profiles</option>
                        <option value="health_record">Health records</option>
                        <option value="section">Sections</option>
                        <option value="account">Staff accounts</option>
                    </select>
                </label>
                <label>Action
                    <select value={draft.action} onChange={e => setDraft(prev => ({ ...prev, action: e.target.value as ActivityFilters["action"] }))}>
                        <option value="all">All actions</option>
                        <option value="INSERT">Created</option>
                        <option value="UPDATE">Updated</option>
                        <option value="DELETE">Deleted</option>
                    </select>
                </label>
                <label>Learner database ID
                    <input type="text" inputMode="numeric" pattern="[0-9]*" placeholder="Optional numeric ID"
                        value={draft.learnerId} disabled={draft.entity === "section" || draft.entity === "account"} onChange={e => setDraft(prev => ({ ...prev, learnerId: e.target.value }))}/>
                </label>
                <label>From date
                    <input type="date" value={draft.fromDate} onChange={e => setDraft(prev => ({ ...prev, fromDate: e.target.value }))}/>
                </label>
                <label>To date
                    <input type="date" value={draft.toDate} onChange={e => setDraft(prev => ({ ...prev, toDate: e.target.value }))}/>
                </label>
                <div className="tdc-activity-filter-buttons">
                    <button type="submit" className="tdc-activity-primary" disabled={loading}>Apply filters</button>
                    <button type="button" className="tdc-activity-secondary" onClick={resetFilters} disabled={loading}>Clear</button>
                </div>
            </form>

            {error && <div className="tdc-activity-error" role="alert">{error}<p>Check that the Phase 11 SQL migration succeeded. Do not disable RLS.</p></div>}

            <div className="tdc-activity-panel">
                <div className="tdc-activity-panel-header">
                    <h2>Recorded events</h2>
                    <span>{loading ? "Loading…" : `${total.toLocaleString()} matching event${total === 1 ? "" : "s"}`}</span>
                </div>
                {loading ? <p className="tdc-activity-empty" role="status">Loading activity history…</p>
                    : result?.records.length === 0 ? <p className="tdc-activity-empty">No events found. Only changes made after Phase 11 installation are logged.</p>
                    : result && <div className="tdc-activity-table-scroll"><table className="tdc-activity-table">
                        <thead><tr>
                            <th>Date / Time (PH)</th><th>Action</th><th>Record</th><th>Performed by</th><th>Grade / Section</th><th>Changed fields</th>
                        </tr></thead>
                        <tbody>{result.records.map(item => (
                            <tr key={item.id}>
                                <td className="tdc-activity-date">{formatDateTime(item.event_at)}</td>
                                <td><span className={`tdc-activity-action tdc-activity-action-${item.action.toLowerCase()}`}>{eventLabel(item.action)}</span></td>
                                <td><strong>{entityLabel(item.entity_type)}{item.entity_type === "account" ? "" : ` #${item.record_id ?? "—"}`}</strong>
                                    {item.entity_type === "account"
                                        ? <small>Account ID: {item.target_account_id ?? "—"}</small>
                                        : item.entity_type === "section"
                                            ? <small>Section database record</small>
                                            : <small>Learner DB ID: {item.learner_id ?? "—"}</small>}</td>
                                <td><strong>{item.actor_name}</strong>
                                    <small>{item.actor_id ? `Account ${item.actor_id.slice(0, 8)}…` : "No user JWT available"}</small></td>
                                <td>{item.grade ? `Grade ${item.grade}` : "—"}<small>{item.section ?? ""}</small></td>
                                <td>{item.changed_fields.length ? item.changed_fields.join(", ") : "—"}</td>
                            </tr>
                        ))}</tbody>
                    </table></div>}
                <footer className="tdc-activity-footer">
                    <span>Page {currentPage} of {totalPages} · 25 events per page</span>
                    <div>
                        <button type="button" className="tdc-activity-secondary" disabled={loading || filters.page === 0} onClick={() => changePage(filters.page - 1)}>← Previous</button>
                        <button type="button" className="tdc-activity-secondary" disabled={loading || currentPage >= totalPages} onClick={() => changePage(filters.page + 1)}>Next →</button>
                    </div>
                </footer>
            </div>
            <p className="tdc-activity-note">Logs show new changes only. Actions made using the SQL Editor or service-role key may appear as “System / privileged operation” because no end-user JWT is available. Activity Logs do not track who viewed a record.</p>
        </section>
    );
}

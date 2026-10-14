import { useEffect, useMemo, useState } from "react";
import type { UserProfile } from "../../types";
import {
    fetchSystemDiagnostics,
    type DiagnosticFinding,
    type DiagnosticsSnapshot
} from "../../lib/systemDiagnostics";
import "./index.css";

type Props = { user: UserProfile };
type Filter = "all" | "attention" | "review" | "info";

const numberFormat = new Intl.NumberFormat("en-PH");

function dateLabel(value: string): string {
    return new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short"
    }).format(new Date(value));
}

function findingLabel(finding: DiagnosticFinding): string {
    if (finding.level === "attention") return "Needs attention";
    if (finding.level === "review") return "Review";
    return "Information";
}

export default function SystemDiagnostics({ user }: Props) {
    const [snapshot, setSnapshot] = useState<DiagnosticsSnapshot | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [refresh, setRefresh] = useState(0);
    const [filter, setFilter] = useState<Filter>("all");
    const [includeClear, setIncludeClear] = useState(false);

    useEffect(() => {
        if (user.role !== "Super Admin") return;
        let active = true;
        fetchSystemDiagnostics(user).then(result => {
            if (!active) return;
            setSnapshot(result);
            setError("");
        }).catch(reason => {
            if (!active) return;
            setSnapshot(null);
            setError(reason instanceof Error ? reason.message : "Unable to run diagnostics.");
        }).finally(() => { if (active) setLoading(false); });
        return () => { active = false; };
    }, [refresh, user.id, user.role]);

    const findings = useMemo(() => snapshot?.findings.filter(item =>
        (filter === "all" || item.level === filter) && (includeClear || item.count > 0)
    ) ?? [], [snapshot, filter, includeClear]);

    if (user.role !== "Super Admin") {
        return <section className="tdc-diagnostics"><h1>Access denied</h1><p>Only Super Admin can view System Diagnostics.</p></section>;
    }

    const attention = snapshot?.findings.filter(item => item.level === "attention" && item.count > 0).length ?? 0;
    const review = snapshot?.findings.filter(item => item.level === "review" && item.count > 0).length ?? 0;
    const informational = snapshot?.findings.filter(item => item.level === "info" && item.count > 0).length ?? 0;

    return <section className="tdc-diagnostics">
        <header className="tdc-diag-heading">
            <div>
                <p className="tdc-diag-eyebrow">TINDIGCHECK! 2.0 · PHASE 12</p>
                <h1>System Diagnostics</h1>
                <p>Review learner and health-record data quality without changing saved information.</p>
            </div>
            <button className="tdc-diag-button" type="button" disabled={loading}
                onClick={() => { setLoading(true); setRefresh(previous => previous + 1); }}>
                {loading ? "Checking…" : "↻ Run checks again"}
            </button>
        </header>

        <div className="tdc-diag-note" role="note">
            <strong>Read-only checks.</strong> Findings are data-quality indicators, not diagnoses. These checks do not verify database RLS or replace testing with actual Admin and Viewer accounts.
        </div>

        {error && <div className="tdc-diag-error" role="alert">
            <strong>Diagnostics could not complete.</strong> {error}
            <p>Verify your Supabase schema and Phase 8 RLS. Do not disable RLS to clear this error.</p>
        </div>}

        {loading && <p className="tdc-diag-loading" role="status">Loading and checking authorized Supabase records…</p>}

        {!loading && snapshot && <>
            <div className="tdc-diag-cards">
                <article className="tdc-diag-card"><span>Learner profiles</span><strong>{numberFormat.format(snapshot.learnerCount)}</strong></article>
                <article className="tdc-diag-card"><span>Health records</span><strong>{numberFormat.format(snapshot.healthRecordCount)}</strong></article>
                <article className="tdc-diag-card"><span>Checks needing attention</span><strong>{attention}</strong></article>
                <article className="tdc-diag-card"><span>Checks needing review</span><strong>{review}</strong></article>
            </div>
            <p className="tdc-diag-updated">Last checked: {dateLabel(snapshot.checkedAt)} (Philippine time) · {informational} informational check(s) with findings</p>

            <div className="tdc-diag-panel">
                <div className="tdc-diag-panel-heading">
                    <div><h2>Data quality findings</h2><p>Counts may overlap because a record can need more than one correction.</p></div>
                    <div className="tdc-diag-filters">
                        <label htmlFor="tdc-diag-filter">Show</label>
                        <select id="tdc-diag-filter" value={filter} onChange={event => setFilter(event.target.value as Filter)}>
                            <option value="all">All categories</option>
                            <option value="attention">Needs attention</option>
                            <option value="review">Review</option>
                            <option value="info">Information</option>
                        </select>
                        <label className="tdc-diag-checkbox"><input type="checkbox" checked={includeClear}
                            onChange={event => setIncludeClear(event.target.checked)}/> Include checks with zero findings</label>
                    </div>
                </div>
                {findings.length === 0
                    ? <p className="tdc-diag-empty">No findings match your current filters. This does not certify clinical accuracy or database security.</p>
                    : <div className="tdc-diag-findings">{findings.map(item =>
                        <article className="tdc-diag-finding" key={item.id}>
                            <div className="tdc-diag-finding-top">
                                <span className={`tdc-diag-level tdc-diag-level-${item.level}`}>{findingLabel(item)}</span>
                                <strong className="tdc-diag-count">{numberFormat.format(item.count)} <small>record(s)</small></strong>
                            </div>
                            <h3>{item.label}</h3>
                            <p>{item.description}</p>
                            {item.sampleIds.length > 0 && <p className="tdc-diag-samples">
                                Sample {item.recordType === "learner" ? "learner" : "health record"} database IDs for review: {item.sampleIds.join(", ")}
                            </p>}
                        </article>
                    )}</div>}
            </div>
            <p className="tdc-diag-footnote">No names, allergy descriptions, or measurement values are displayed in this diagnostics page. Use Learner Management or Health Records to verify and correct individual entries. Database permissions must be tested separately.</p>
        </>}
    </section>;
}

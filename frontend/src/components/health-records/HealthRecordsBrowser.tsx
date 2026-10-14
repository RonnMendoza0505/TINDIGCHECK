import { useEffect, useMemo, useState } from "react";
import { fetchLearners, type Learner } from "../../lib/learners";
import {
    fetchLearnerHistoryPage,
    fetchRecentRecordsAcrossLearners,
    RECENT_RECORDS_LIMIT,
    type HistoryRecord
} from "../../lib/healthRecordHistory";
import type { UserProfile } from "../../types";
import "./healthRecordsBrowser.css";

type Props = {
    user: UserProfile;
    mode: "recent" | "history";
};

function displayName(learner: Learner): string {
    return `${learner.last_name}, ${learner.first_name}${learner.middle_name ? ` ${learner.middle_name}` : ""}`;
}

function displayDate(date: string | null): string {
    if (!date) return "—";
    const parsed = new Date(date);
    if (Number.isNaN(parsed.getTime())) return "—";
    return new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short"
    }).format(parsed);
}

function displayNumber(value: number | null, decimals = 0): string {
    return value === null ? "—" : value.toFixed(decimals);
}

/*
    SYSTEM FUNCTION:
    Shared read-only display for Recent Health Records and Health Records.
    Viewer Grade/Section filters are applied automatically and hidden from UI.
*/
export default function HealthRecordsBrowser({ user, mode }: Props) {
    const viewer = user.role === "Viewer";
    const [learners, setLearners] = useState<Learner[]>([]);
    const [learnersLoading, setLearnersLoading] = useState(true);
    const [learnersError, setLearnersError] = useState("");
    const [grade, setGrade] = useState("All");
    const [section, setSection] = useState("All");
    const [sex, setSex] = useState("All");
    const [search, setSearch] = useState("");
    const [selectedLearnerId, setSelectedLearnerId] = useState("");
    const [page, setPage] = useState(0);
    const [records, setRecords] = useState<HistoryRecord[]>([]);
    const [hasMore, setHasMore] = useState(false);
    const [recordsLoading, setRecordsLoading] = useState(false);
    const [recordsError, setRecordsError] = useState("");
    const [refresh, setRefresh] = useState(0);

    useEffect(() => {
        let active = true;
        fetchLearners(user)
            .then(result => {
                if (active) {
                    setLearners(result);
                    setLearnersError("");
                }
            })
            .catch(err => {
                if (active) setLearnersError(err instanceof Error ? err.message : "Unable to load learners.");
            })
            .finally(() => { if (active) setLearnersLoading(false); });
        return () => { active = false; };
    }, [user]);

    const learnerById = useMemo(
        () => new Map(learners.map(learner => [learner.id, learner])),
        [learners]
    );

    const sections = useMemo(() => Array.from(new Set(
        learners.filter(learner => grade === "All" || String(learner.grade) === grade)
            .map(learner => learner.section)
    )).sort((a, b) => a.localeCompare(b)), [learners, grade]);

    const filteredLearners = useMemo(() => learners.filter(learner => {
        const matchesSearch = `${learner.student_id} ${displayName(learner)}`
            .toLowerCase().includes(search.trim().toLowerCase());
        return matchesSearch &&
            (viewer || grade === "All" || String(learner.grade) === grade) &&
            (viewer || section === "All" || learner.section === section) &&
            (sex === "All" || learner.sex.toLowerCase() === sex.toLowerCase());
    }), [learners, viewer, grade, section, sex, search]);

    // Recent page loads records for all accessible learners. History page
    // loads only the selected learner and pages through records for admins.
    useEffect(() => {
        if (learnersLoading || learnersError) return;
        if (mode === "history" && (!selectedLearnerId || !learnerById.has(selectedLearnerId))) {
            return;
        }
        let active = true;
        const run = async () => {
            try {
                const result = mode === "recent"
                    ? { records: await fetchRecentRecordsAcrossLearners(user, learners), hasMore: false }
                    : await fetchLearnerHistoryPage(user, selectedLearnerId, page);
                if (active) {
                    setRecords(result.records);
                    setHasMore(result.hasMore);
                    setRecordsError("");
                }
            } catch (err) {
                if (active) {
                    setRecords([]);
                    setHasMore(false);
                    setRecordsError(err instanceof Error ? err.message : "Unable to load health records.");
                }
            } finally {
                if (active) setRecordsLoading(false);
            }
        };
        void run();
        return () => { active = false; };
    }, [mode, user, learners, learnersLoading, learnersError, learnerById, selectedLearnerId, page, refresh]);

    const displayedRecords = useMemo(() => {
        if (mode === "history") return records;
        const permitted = new Set(filteredLearners.map(learner => learner.id));
        return records.filter(record => permitted.has(record.learner_id));
    }, [mode, records, filteredLearners]);

    function selectLearner(id: string) {
        setSelectedLearnerId(id);
        setPage(0);
        setRecords([]);
        setRecordsError("");
        setRecordsLoading(Boolean(id));
    }

    const currentLearner = learnerById.get(selectedLearnerId);

    return (
        <section className="tdc-records-page">
            <header className="tdc-records-header">
                <div>
                    <p className="eyebrow">TINDIGCHECK! 2.0</p>
                    <h1>{mode === "recent" ? "Recent Health Records" : "Health Records"}</h1>
                    <p>{mode === "recent"
                        ? "Review the latest measurements saved in Supabase."
                        : "View measurements recorded for a selected learner."}</p>
                </div>
                <button type="button" className="tdc-records-refresh" onClick={() => {
                    setRecordsLoading(true);
                    setRefresh(value => value + 1);
                }} disabled={recordsLoading || learnersLoading}>Refresh records</button>
            </header>

            {viewer && (
                <p className="tdc-records-assignment">
                    Viewer access: Grade {user.grade}, Section {user.section}. Only the two newest records per learner are displayed.
                </p>
            )}

            <div className="tdc-records-panel">
                <h2>{mode === "recent" ? "Filter results" : "Choose learner"}</h2>
                {learnersLoading ? <p>Loading learners...</p> : learnersError ? (
                    <p className="tdc-records-error" role="alert">{learnersError}</p>
                ) : (
                    <div className="tdc-records-filters">
                        {!viewer && (
                            <>
                                <label>Grade
                                    <select value={grade} onChange={event => { setGrade(event.target.value); setSection("All"); }}>
                                        <option value="All">All grades</option>
                                        {[1, 2, 3, 4, 5, 6].map(value => <option key={value} value={value}>Grade {value}</option>)}
                                    </select>
                                </label>
                                <label>Section
                                    <select value={section} onChange={event => setSection(event.target.value)}>
                                        <option value="All">All sections</option>
                                        {sections.map(value => <option key={value} value={value}>{value}</option>)}
                                    </select>
                                </label>
                            </>
                        )}
                        <label>Sex
                            <select value={sex} onChange={event => setSex(event.target.value)}>
                                <option value="All">All</option>
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </label>
                        <label>Search by learner name or ID
                            <input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Search learner..." />
                        </label>
                        {mode === "history" && (
                            <label className="tdc-records-learner-select">Learner
                                <select value={selectedLearnerId} onChange={event => selectLearner(event.target.value)}>
                                    <option value="">Select a learner</option>
                                    {filteredLearners.map(learner => (
                                        <option key={learner.id} value={learner.id}>
                                            {displayName(learner)} — {learner.student_id}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        )}
                    </div>
                )}
            </div>

            <div className="tdc-records-panel">
                <div className="tdc-records-table-heading">
                    <h2>{mode === "recent" ? "Latest measurements" : currentLearner ? displayName(currentLearner) : "Learner history"}</h2>
                    <span>{displayedRecords.length} record{displayedRecords.length === 1 ? "" : "s"} shown</span>
                </div>
                {mode === "history" && !selectedLearnerId ? (
                    <p className="tdc-records-empty">Select a learner above to view their measurements.</p>
                ) : recordsLoading || learnersLoading ? (
                    <p className="tdc-records-empty">Loading health records...</p>
                ) : recordsError ? (
                    <p className="tdc-records-error" role="alert">{recordsError}</p>
                ) : displayedRecords.length === 0 ? (
                    <p className="tdc-records-empty">No matching health records found.</p>
                ) : (
                    <div className="tdc-records-table-scroll">
                        <table className="tdc-records-table">
                            <thead><tr>
                                <th>Date &amp; Time (PH)</th>
                                <th>Learner</th>
                                <th>Grade / Section</th>
                                <th>Weight</th>
                                <th>Height</th>
                                <th>Heart Rate</th>
                                <th>SpO₂</th>
                                <th>BMI</th>
                                <th>BMI Status</th>
                            </tr></thead>
                            <tbody>{displayedRecords.map(record => {
                                const learner = learnerById.get(record.learner_id);
                                return <tr key={record.id}>
                                    <td>{displayDate(record.recorded_at)}</td>
                                    <td>{learner ? displayName(learner) : "Unknown learner"}</td>
                                    <td>{learner ? `Grade ${learner.grade} / ${learner.section}` : "—"}</td>
                                    <td>{displayNumber(record.weight, 1)} kg</td>
                                    <td>{displayNumber(record.height, 1)} cm</td>
                                    <td>{displayNumber(record.heart_rate)} bpm</td>
                                    <td>{displayNumber(record.spo2)}%</td>
                                    <td>{displayNumber(record.bmi, 2)}</td>
                                    <td>{record.bmi_status}</td>
                                </tr>;
                            })}</tbody>
                        </table>
                    </div>
                )}
                {mode === "history" && !viewer && selectedLearnerId && !recordsError && (
                    <div className="tdc-records-pagination">
                        <button type="button" disabled={page === 0 || recordsLoading} onClick={() => { setPage(value => value - 1); setRecordsLoading(true); }}>Previous</button>
                        <span>Page {page + 1}</span>
                        <button type="button" disabled={!hasMore || recordsLoading} onClick={() => { setPage(value => value + 1); setRecordsLoading(true); }}>Next</button>
                    </div>
                )}
                <p className="tdc-records-footnote">
                    {viewer
                        ? "Read-only. Viewer access is limited to the assigned Grade and Section and the last two records per learner."
                        : mode === "recent"
                            ? `Read-only. Shows up to ${RECENT_RECORDS_LIMIT} newest records before filters. Use Health Records to browse a learner's complete history.`
                            : "Read-only. Use Health Monitoring to enter measurements or correct same-day records."}
                </p>
            </div>
        </section>
    );
}

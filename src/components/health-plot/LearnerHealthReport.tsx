import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { Learner } from "../../lib/learners";
import type { HistoryRecord } from "../../lib/healthRecordHistory";
import type { PlotPeriod } from "../../lib/healthPlot";
import type { UserProfile } from "../../types";
import "./learnerHealthReport.css";

type Props = {
    learner: Learner;
    user: UserProfile;
    records: HistoryRecord[];
    period: PlotPeriod;
    truncated: boolean;
    onClose: () => void;
};

const PERIOD_LABEL: Record<PlotPeriod, string> = {
    "30": "Last 30 days",
    "90": "Last 90 days",
    "365": "Last 12 months",
    all: "All available dates"
};

const dateTimeFormatter = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila",
    dateStyle: "medium",
    timeStyle: "short"
});

const dateFormatter = new Intl.DateTimeFormat("en-PH", {
    timeZone: "UTC",
    year: "numeric",
    month: "long",
    day: "numeric"
});

function dateTime(value: string | null): string {
    if (!value) return "Not recorded";
    const date = new Date(value);
    return Number.isFinite(date.getTime()) ? dateTimeFormatter.format(date) : "Invalid date";
}

function birthDate(value: string | null): string {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "Not recorded";
    const date = new Date(`${value}T00:00:00Z`);
    return Number.isFinite(date.getTime()) ? dateFormatter.format(date) : "Not recorded";
}

function measurement(value: number | null, unit: string, decimals: number): string {
    return typeof value === "number" && Number.isFinite(value)
        ? `${value.toFixed(decimals)}${unit ? ` ${unit}` : ""}`
        : "—";
}

/**
 * Phase 10: local-only, print-ready preview.
 * Uses ONLY records already fetched for the signed-in user's Health Plot.
 * It does not query, modify, or upload any learner information.
 */
export default function LearnerHealthReport({
    learner, user, records, period, truncated, onClose
}: Props) {
    const [includeAllergies, setIncludeAllergies] = useState(false);
    const closeButton = useRef<HTMLButtonElement>(null);
    const generatedAt = useRef(new Date().toISOString());
    const latest = records[records.length - 1];
    const newestFirst = [...records].reverse();
    const name = `${learner.last_name}, ${learner.first_name}${learner.middle_name ? ` ${learner.middle_name}` : ""}`;

    useEffect(() => {
        const previousOverflow = document.body.style.overflow;
        document.body.style.overflow = "hidden";
        closeButton.current?.focus();
        function onKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") onClose();
        }
        window.addEventListener("keydown", onKeyDown);
        return () => {
            document.body.style.overflow = previousOverflow;
            window.removeEventListener("keydown", onKeyDown);
        };
    }, [onClose]);

    // A Viewer must not print more than two rows, even if a caller passes extra.
    // Phase 8 Supabase RLS must independently enforce the same restriction.
    const printableRecords = user.role === "Viewer" ? newestFirst.slice(0, 2) : newestFirst;
    const displayedLatest = printableRecords[0] ?? latest;

    return createPortal(
        <div className="tdc-report-overlay" role="presentation">
            <div className="tdc-report-modal" role="dialog" aria-modal="true" aria-label="Learner health report preview">
                <div className="tdc-report-actions">
                    <div>
                        <strong>Health report preview</strong>
                        <span>Print or select “Save as PDF” in your browser's print dialog.</span>
                    </div>
                    <div className="tdc-report-action-buttons">
                        <button type="button" className="tdc-report-secondary" ref={closeButton} onClick={onClose}>Close</button>
                        <button type="button" className="tdc-report-primary" onClick={() => window.print()}>
                            Print / Save as PDF
                        </button>
                    </div>
                </div>

                <div className="tdc-report-options">
                    <label>
                        <input type="checkbox" checked={includeAllergies}
                            onChange={event => setIncludeAllergies(event.target.checked)} />
                        Include food-allergy information (sensitive)
                    </label>
                    <small>Reports contain confidential learner information. Print or save only to an authorized, secure location.</small>
                </div>

                <article className="tdc-report-paper" aria-label="Printable learner health report">
                    <header className="tdc-report-letterhead">
                        <p className="tdc-report-system">TINDIGCHECK! 2.0</p>
                        <h1>Learner Health Monitoring Report</h1>
                        <p>Lourdes Northwest Elementary School</p>
                    </header>

                    <div className="tdc-report-meta">
                        <div><span>Report prepared</span><strong>{dateTime(generatedAt.current)} (PH)</strong></div>
                        <div><span>Measurement period</span><strong>{PERIOD_LABEL[period]}</strong></div>
                        <div><span>Prepared by</span><strong>{user.full_name} · {user.role}</strong></div>
                        <div><span>Measurements included</span><strong>{printableRecords.length}</strong></div>
                    </div>

                    <section className="tdc-report-section">
                        <h2>Learner information</h2>
                        <div className="tdc-report-info">
                            <div><span>Full name</span><strong>{name}</strong></div>
                            <div><span>Learner ID</span><strong>{learner.student_id}</strong></div>
                            <div><span>Grade / Section</span><strong>Grade {learner.grade} / {learner.section}</strong></div>
                            <div><span>Sex</span><strong>{learner.sex || "Not recorded"}</strong></div>
                            <div><span>Date of birth</span><strong>{birthDate(learner.date_of_birth)}</strong></div>
                        </div>
                    </section>

                    {includeAllergies && <section className="tdc-report-section">
                        <h2>Food-allergy information (recorded profile)</h2>
                        <p className="tdc-report-allergy">
                            {learner.has_food_allergy
                                ? learner.allergies.trim() || "Food allergy flagged; specific allergens not recorded."
                                : "No food allergy flagged in the profile. This does not confirm absence of allergies."}
                        </p>
                        <p className="tdc-report-small">This information is taken from the saved learner profile and has not been independently verified.</p>
                    </section>}

                    <section className="tdc-report-section">
                        <h2>Most recent measurement in selected period</h2>
                        <div className="tdc-report-latest">
                            <div><span>Weight</span><strong>{measurement(displayedLatest?.weight ?? null, "kg", 1)}</strong></div>
                            <div><span>Height</span><strong>{measurement(displayedLatest?.height ?? null, "cm", 1)}</strong></div>
                            <div><span>Heart rate</span><strong>{measurement(displayedLatest?.heart_rate ?? null, "bpm", 0)}</strong></div>
                            <div><span>SpO₂</span><strong>{measurement(displayedLatest?.spo2 ?? null, "%", 0)}</strong></div>
                            <div><span>BMI</span><strong>{measurement(displayedLatest?.bmi ?? null, "kg/m²", 2)}</strong></div>
                            <div><span>BMI status</span><strong>{displayedLatest?.bmi_status ?? "Not assessed"}</strong></div>
                        </div>
                        <p className="tdc-report-small">Recorded: {dateTime(displayedLatest?.recorded_at ?? null)}</p>
                    </section>

                    <section className="tdc-report-section">
                        <h2>Measurement history</h2>
                        <div className="tdc-report-table-wrap">
                            <table className="tdc-report-table">
                                <thead><tr>
                                    <th>Date / time (PH)</th><th>Weight</th><th>Height</th>
                                    <th>Heart rate</th><th>SpO₂</th><th>BMI</th><th>BMI status</th>
                                </tr></thead>
                                <tbody>{printableRecords.map(record => <tr key={record.id}>
                                    <td>{dateTime(record.recorded_at)}</td>
                                    <td>{measurement(record.weight, "kg", 1)}</td>
                                    <td>{measurement(record.height, "cm", 1)}</td>
                                    <td>{measurement(record.heart_rate, "bpm", 0)}</td>
                                    <td>{measurement(record.spo2, "%", 0)}</td>
                                    <td>{measurement(record.bmi, "", 2)}</td>
                                    <td>{record.bmi_status || "Not assessed"}</td>
                                </tr>)}</tbody>
                            </table>
                        </div>
                        {truncated && <p className="tdc-report-warning">
                            This report includes only the newest records loaded by Health Plot. Older records may exist.
                        </p>}
                    </section>

                    <footer className="tdc-report-footer">
                        <p>For authorized school health monitoring use only. Contains confidential learner information.</p>
                        <p>BMI-for-age status, where available, is a screening result and not a medical diagnosis. Values reflect saved measurements and may require professional review.</p>
                    </footer>
                </article>
            </div>
        </div>,
        document.body
    );
}

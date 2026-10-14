import { useEffect, useMemo, useState, type FormEvent } from "react";

import { fetchLearners, type Learner } from "../../lib/learners";
import {
    fetchRecentHealthRecords,
    removeTodayHealthRecord,
    saveHealthRecord,
    type HealthRecord
} from "../../lib/healthRecords";
import type { UserProfile } from "../../types";
import { cdcReferenceReady, getBmiAssessment, type BmiStatus } from "../../lib/bmiStatus";
import { reassessLearnerBmiStatuses } from "../../lib/bmiRepair";
import "./index.css";

/* SYSTEM FUNCTION: Accepts the authenticated account's role. */
type Props = {
    user: UserProfile;
};

type MeasurementForm = {
    weight: string;
    height: string;
    heartRate: string;
    spo2: string;
};

type MeasurementPreview = {
    learnerId: string;
    learnerName: string;
    weight: number;
    height: number;
    heartRate: number;
    spo2: number;
    bmi: number;
    bmiStatus: BmiStatus;
    bmiReason: string | null;
};

const EMPTY_MEASUREMENTS: MeasurementForm = {
    weight: "",
    height: "",
    heartRate: "",
    spo2: ""
};

const GRADES = [1, 2, 3, 4, 5, 6];

function learnerName(learner: Learner): string {
    const middle = learner.middle_name?.trim();
    return `${learner.last_name}, ${learner.first_name}${middle ? ` ${middle}` : ""}`;
}

/* SYSTEM FUNCTION: Displays Philippine local date/time for recorded entries. */
function formatRecordedAt(isoDate: string): string {
    return new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila",
        dateStyle: "medium",
        timeStyle: "short"
    }).format(new Date(isoDate));
}

/* SYSTEM FUNCTION: Compares calendar days in the Philippines, not UTC. */
function manilaCalendarDay(date: Date): string {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
    }).formatToParts(date);
    const get = (name: string) => parts.find(part => part.type === name)?.value ?? "";
    return `${get("year")}-${get("month")}-${get("day")}`;
}

function isTodayInManila(isoDate: string): boolean {
    return manilaCalendarDay(new Date(isoDate)) === manilaCalendarDay(new Date());
}

/*
    SYSTEM FUNCTION:
    Loads real learners, validates measurements, saves them in Supabase,
    displays recent results, and supports same-day corrections.
*/
export default function HealthMonitoring({ user }: Props) {
    const [learners, setLearners] = useState<Learner[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [grade, setGrade] = useState("All");
    const [section, setSection] = useState("All");
    const [sex, setSex] = useState("All");
    const [search, setSearch] = useState("");
    const [learnerId, setLearnerId] = useState("");

    const [measurements, setMeasurements] = useState<MeasurementForm>({ ...EMPTY_MEASUREMENTS });
    const [preview, setPreview] = useState<MeasurementPreview | null>(null);
    const [formError, setFormError] = useState("");
    const [saveMessage, setSaveMessage] = useState("");
    const [saving, setSaving] = useState(false);

    const [records, setRecords] = useState<HealthRecord[]>([]);
    const [recordsLoading, setRecordsLoading] = useState(false);
    const [recordsError, setRecordsError] = useState("");
    const [recordsVersion, setRecordsVersion] = useState(0);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [reassessing, setReassessing] = useState(false);
    const [reassessMessage, setReassessMessage] = useState("");

    const canEnterRecords = user.role === "Super Admin" || user.role === "Admin";

    /* SYSTEM FUNCTION: Loads learners from the existing Supabase learners table. */
    useEffect(() => {
        let active = true;
        async function load() {
            setLoading(true);
            setError("");
            try {
                const result = await fetchLearners(user);
                if (active) setLearners(result);
            } catch (err) {
                if (active) {
                    setError(err instanceof Error ? err.message : "Unable to load learners.");
                }
            } finally {
                if (active) setLoading(false);
            }
        }
        void load();
        return () => { active = false; };
    }, [user]);

    /* SYSTEM FUNCTION: Fetches recent records whenever the learner changes or data changes. */
    useEffect(() => {
        if (!learnerId || !canEnterRecords) return;
        let active = true;
        async function loadRecords() {
            setRecordsLoading(true);
            setRecordsError("");
            try {
                const result = await fetchRecentHealthRecords(learnerId);
                if (active) setRecords(result);
            } catch (err) {
                if (active) {
                    setRecords([]);
                    setRecordsError(err instanceof Error ? err.message : "Unable to load records.");
                }
            } finally {
                if (active) setRecordsLoading(false);
            }
        }
        void loadRecords();
        return () => { active = false; };
    }, [learnerId, canEnterRecords, recordsVersion]);

    const sections = useMemo(() => [
        ...new Set(
            learners
                .filter(item => grade === "All" || String(item.grade) === grade)
                .map(item => item.section)
                .filter(Boolean)
        )
    ].sort((a, b) => a.localeCompare(b)), [learners, grade]);

    const filteredLearners = useMemo(() => {
        const term = search.trim().toLowerCase();
        return learners.filter(item => {
            const matchesGrade = grade === "All" || String(item.grade) === grade;
            const matchesSection = section === "All" || item.section === section;
            const matchesSex = sex === "All" || item.sex === sex;
            const matchesSearch = !term ||
                `${learnerName(item)} ${item.student_id}`.toLowerCase().includes(term);
            return matchesGrade && matchesSection && matchesSex && matchesSearch;
        });
    }, [learners, grade, section, sex, search]);

    const selectedLearner = learners.find(item => item.id === learnerId);

    function resetSelection() {
        setLearnerId("");
        setPreview(null);
        setFormError("");
        setSaveMessage("");
        setRecords([]);
        setRecordsError("");
        setRecordsLoading(false);
        setReassessMessage("");
    }

    function changeMeasurement(field: keyof MeasurementForm, value: string) {
        setMeasurements(previous => ({ ...previous, [field]: value }));
        setPreview(null);
        setFormError("");
        setSaveMessage("");
    }

    /* SYSTEM FUNCTION: Validates measurements before saving and previews BMI. */
    function handlePreview(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setFormError("");
        setSaveMessage("");
        setPreview(null);

        if (!canEnterRecords) {
            setFormError("This account cannot enter health measurements.");
            return;
        }
        if (!selectedLearner) {
            setFormError("Select a learner first.");
            return;
        }

        const { weight, height, heartRate, spo2 } = measurements;
        if ([weight, height, heartRate, spo2].some(value => value.trim() === "")) {
            setFormError("Complete all four measurement fields.");
            return;
        }

        const [weightKg, heightCm, heartRateBpm, oxygenPercent] =
            [weight, height, heartRate, spo2].map(Number);

        if (
            ![weightKg, heightCm, heartRateBpm, oxygenPercent].every(Number.isFinite) ||
            weightKg < 0.1 || weightKg > 300 ||
            heightCm < 30 || heightCm > 250 ||
            !Number.isInteger(heartRateBpm) || heartRateBpm < 1 || heartRateBpm > 300 ||
            !Number.isInteger(oxygenPercent) || oxygenPercent < 0 || oxygenPercent > 100
        ) {
            setFormError(
                "Check measurements: weight 0.1–300 kg, height 30–250 cm, " +
                "heart rate 1–300 bpm, and SpO₂ 0–100% (whole numbers for HR/SpO₂)."
            );
            return;
        }

        const heightMeters = heightCm / 100;
        const bmi = weightKg / (heightMeters * heightMeters);

        const assessment = getBmiAssessment({
            bmi,
            sex: selectedLearner.sex,
            dateOfBirth: selectedLearner.date_of_birth,
            measurementDate: new Date()
        });

        setPreview({
            learnerId: selectedLearner.id,
            learnerName: learnerName(selectedLearner),
            weight: weightKg,
            height: heightCm,
            heartRate: heartRateBpm,
            spo2: oxygenPercent,
            bmi,
            bmiStatus: assessment.status,
            bmiReason: assessment.reason
        });
    }

    /* SYSTEM FUNCTION: Saves the confirmed preview to Supabase. */
    async function handleSave() {
        if (!preview || !selectedLearner || preview.learnerId !== selectedLearner.id || saving) {
            setFormError("Preview the measurements for the selected learner first.");
            return;
        }
        setSaving(true);
        setFormError("");
        setSaveMessage("");
        try {
            const saved = await saveHealthRecord({
                learner_id: preview.learnerId,
                weight_kg: preview.weight,
                height_cm: preview.height,
                heart_rate_bpm: preview.heartRate,
                spo2_percent: preview.spo2
            });
            setSaveMessage(
                `Health record saved successfully on ${formatRecordedAt(saved.recorded_at)}. ` +
                `BMI: ${saved.bmi.toFixed(2)} (${saved.bmi_status}).`
            );
            setPreview(null);
            setMeasurements({ ...EMPTY_MEASUREMENTS });
            setRecordsVersion(value => value + 1);
        } catch (err) {
            setFormError(err instanceof Error ? err.message : "Unable to save health record.");
        } finally {
            setSaving(false);
        }
    }

    /* SYSTEM FUNCTION: Removes a wrong record entered today, with confirmation. */
    async function handleDelete(record: HealthRecord) {
        if (!isTodayInManila(record.recorded_at) || deletingId) return;
        if (!window.confirm("Remove this health record? This action cannot be undone.")) return;
        setDeletingId(record.id);
        setRecordsError("");
        setSaveMessage("");
        try {
            await removeTodayHealthRecord(record.id);
            setSaveMessage("Today's incorrect record was removed.");
            setRecordsVersion(value => value + 1);
        } catch (err) {
            setRecordsError(err instanceof Error ? err.message : "Unable to remove record.");
        } finally {
            setDeletingId(null);
        }
    }

    /** Recalculate historical statuses after installing the CDC data or adding DOB. */
    async function handleReassess() {
        if (!selectedLearner || reassessing || !canEnterRecords) return;
        if (!window.confirm(
            `Recalculate saved BMI statuses for ${learnerName(selectedLearner)}? ` +
            "Only the BMI status column will be updated."
        )) return;
        setReassessing(true);
        setReassessMessage("");
        setRecordsError("");
        try {
            const result = await reassessLearnerBmiStatuses(selectedLearner.id);
            setReassessMessage(
                `Checked ${result.checked} records; updated ${result.updated}; ` +
                `${result.skipped} could not be assessed.`
            );
            setRecordsVersion(version => version + 1);
        } catch (err) {
            setRecordsError(err instanceof Error ? err.message : "Could not reassess BMI statuses.");
        } finally {
            setReassessing(false);
        }
    }

    if (!canEnterRecords) {
        return (
            <section className="health-monitoring-page">
                <h1>Health Monitoring</h1>
                <p role="alert">Only Super Admin and Admin accounts can enter health records.</p>
            </section>
        );
    }

    return (
        <section className="health-monitoring-page">
            <header className="health-monitoring-heading">
                <p className="eyebrow">TINDIGCHECK! 2.0</p>
                <h1>Health Monitoring</h1>
                <p>Record weight, height, heart rate, and SpO₂ for a registered learner.</p>
            </header>

            {error && <p className="health-monitoring-error" role="alert">{error}</p>}
            {!cdcReferenceReady && (
                <div className="tdc-bmi-notice" role="status">
                    <strong>BMI status needs the CDC reference.</strong> The current reference file
                    is empty or incomplete. In the VS Code terminal run
                    {" "}<code>node scripts/download-cdc-bmi.mjs</code>, then restart Vite.
                    Numerical BMI and other health measurements can still be saved.
                </div>
            )}

            <div className="health-monitoring-panel">
                <h2>Select Learner</h2>
                <div className="health-monitoring-grid">
                    <label className="health-monitoring-field">
                        <span>Grade</span>
                        <select disabled={saving} value={grade} onChange={event => {
                            setGrade(event.target.value);
                            setSection("All");
                            resetSelection();
                        }}>
                            <option value="All">All Grades</option>
                            {GRADES.map(value => <option key={value} value={value}>Grade {value}</option>)}
                        </select>
                    </label>
                    <label className="health-monitoring-field">
                        <span>Section</span>
                        <select disabled={saving} value={section} onChange={event => {
                            setSection(event.target.value);
                            resetSelection();
                        }}>
                            <option value="All">All Sections</option>
                            {sections.map(value => <option key={value} value={value}>{value}</option>)}
                        </select>
                    </label>
                    <label className="health-monitoring-field">
                        <span>Sex</span>
                        <select disabled={saving} value={sex} onChange={event => {
                            setSex(event.target.value);
                            resetSelection();
                        }}>
                            <option value="All">All</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                    </label>
                    <label className="health-monitoring-field">
                        <span>Search Name / Learner ID</span>
                        <input type="search" disabled={saving} value={search}
                            onChange={event => {
                                setSearch(event.target.value);
                                resetSelection();
                            }}
                            placeholder="Type a learner's name or ID" />
                    </label>
                    <label className="health-monitoring-field health-monitoring-wide">
                        <span>Learner</span>
                        <select value={learnerId} disabled={loading || !!error || saving}
                            onChange={event => {
                                setLearnerId(event.target.value);
                                setPreview(null);
                                setFormError("");
                                setSaveMessage("");
                                setRecords([]);
                            }}>
                            <option value="">{loading ? "Loading learners..." : "Select learner"}</option>
                            {filteredLearners.map(item => (
                                <option key={item.id} value={item.id}>
                                    {learnerName(item)} — {item.student_id}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>
                {!loading && !error && filteredLearners.length === 0 && (
                    <p className="health-monitoring-note">No learners match these filters.</p>
                )}
                {selectedLearner && !selectedLearner.date_of_birth && (
                    <div className="tdc-bmi-notice" role="status">
                        This learner has no Date of Birth. Add it in Learner Management
                        before BMI-for-age status can be calculated.
                    </div>
                )}
                {selectedLearner && (
                    <p className="health-monitoring-selected">
                        Selected: <strong>{learnerName(selectedLearner)}</strong> ·
                        Grade {selectedLearner.grade} · {selectedLearner.section} ·
                        {selectedLearner.sex} · Age {selectedLearner.age}
                    </p>
                )}
            </div>

            <form className="health-monitoring-panel" onSubmit={handlePreview}>
                <h2>Enter Measurements</h2>
                <div className="health-monitoring-grid">
                    <label className="health-monitoring-field">
                        <span>Weight (kg)</span>
                        <input type="number" min="0.1" max="300" step="0.01" required disabled={saving}
                            value={measurements.weight}
                            onChange={event => changeMeasurement("weight", event.target.value)}
                            placeholder="e.g. 25.5" />
                    </label>
                    <label className="health-monitoring-field">
                        <span>Height (cm)</span>
                        <input type="number" min="30" max="250" step="0.01" required disabled={saving}
                            value={measurements.height}
                            onChange={event => changeMeasurement("height", event.target.value)}
                            placeholder="e.g. 120.5" />
                    </label>
                    <label className="health-monitoring-field">
                        <span>Heart Rate (bpm)</span>
                        <input type="number" min="1" max="300" step="1" required disabled={saving}
                            value={measurements.heartRate}
                            onChange={event => changeMeasurement("heartRate", event.target.value)}
                            placeholder="e.g. 85" />
                    </label>
                    <label className="health-monitoring-field">
                        <span>SpO₂ (%)</span>
                        <input type="number" min="0" max="100" step="1" required disabled={saving}
                            value={measurements.spo2}
                            onChange={event => changeMeasurement("spo2", event.target.value)}
                            placeholder="e.g. 98" />
                    </label>
                </div>
                {formError && <p className="health-monitoring-error" role="alert">{formError}</p>}
                {saveMessage && <p className="health-monitoring-success" role="status">{saveMessage}</p>}
                <div className="health-monitoring-actions">
                    <button type="submit" className="primary-button" disabled={saving || !selectedLearner}>
                        Validate &amp; Preview
                    </button>
                    <button type="button" className="health-monitoring-clear" disabled={saving}
                        onClick={() => {
                            setMeasurements({ ...EMPTY_MEASUREMENTS });
                            setPreview(null);
                            setFormError("");
                            setSaveMessage("");
                        }}>Clear</button>
                </div>
                <p className="health-monitoring-note">
                    Measurements are saved only after you review the preview and click Save Health Record.
                </p>
            </form>

            {preview && (
                <div className="health-monitoring-panel health-monitoring-preview">
                    <h2>Confirm Measurement Preview</h2>
                    <p><strong>{preview.learnerName}</strong></p>
                    <div className="health-monitoring-results">
                        <div><span>Weight</span><strong>{preview.weight} kg</strong></div>
                        <div><span>Height</span><strong>{preview.height} cm</strong></div>
                        <div><span>Heart Rate</span><strong>{preview.heartRate} bpm</strong></div>
                        <div><span>SpO₂</span><strong>{preview.spo2}%</strong></div>
                        <div><span>BMI (preview)</span><strong>{preview.bmi.toFixed(2)}</strong></div>
                        <div><span>BMI Status</span><strong>{preview.bmiStatus}</strong></div>
                    </div>
                    {preview.bmiReason && (
                        <div className="tdc-bmi-notice" role="status">
                            <strong>Why is BMI not assessed?</strong> {preview.bmiReason}
                        </div>
                    )}
                    <div className="health-monitoring-actions">
                        <button type="button" className="primary-button" disabled={saving} onClick={() => void handleSave()}>
                            {saving ? "Saving..." : "Save Health Record"}
                        </button>
                    </div>
                    <p className="health-monitoring-note">
                        BMI status is a screening category using CDC BMI-for-age reference data, sex, and date of birth. It is not a diagnosis. If required information is missing, status is Not assessed.
                    </p>
                </div>
            )}

            <div className="health-monitoring-panel">
                <h2>Recent Health Records</h2>
                {selectedLearner && (
                    <div className="tdc-bmi-actions">
                        <button type="button" className="tdc-bmi-reassess"
                            disabled={reassessing || !cdcReferenceReady || !selectedLearner.date_of_birth}
                            onClick={() => void handleReassess()}>
                            {reassessing ? "Recalculating..." : "Recalculate saved BMI statuses"}
                        </button>
                        {reassessMessage && <span className="tdc-bmi-message" role="status">{reassessMessage}</span>}
                    </div>
                )}
                {!selectedLearner ? (
                    <p className="health-monitoring-note">Select a learner to view their latest measurements.</p>
                ) : recordsLoading ? (
                    <p className="health-monitoring-note">Loading health records...</p>
                ) : (
                    <>
                        {recordsError && <p className="health-monitoring-error" role="alert">{recordsError}</p>}
                        {!recordsError && records.length === 0 ? (
                            <p className="health-monitoring-note">No health records saved for this learner yet.</p>
                        ) : !recordsError && (
                            <div className="health-monitoring-table-scroll">
                                <table className="health-monitoring-table">
                                    <thead>
                                        <tr>
                                            <th>Date &amp; Time (PH)</th>
                                            <th>Weight</th>
                                            <th>Height</th>
                                            <th>Heart Rate</th>
                                            <th>SpO₂</th>
                                            <th>BMI</th>
                                            <th>BMI Status</th>
                                            <th>Correction</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {records.map(record => (
                                            <tr key={record.id}>
                                                <td>{formatRecordedAt(record.recorded_at)}</td>
                                                <td>{record.weight_kg} kg</td>
                                                <td>{record.height_cm} cm</td>
                                                <td>{record.heart_rate_bpm} bpm</td>
                                                <td>{record.spo2_percent}%</td>
                                                <td>{record.bmi.toFixed(2)}</td>
                                                <td>{record.bmi_status}</td>
                                                <td>
                                                    {isTodayInManila(record.recorded_at) ? (
                                                        <button type="button" className="health-monitoring-delete"
                                                            disabled={!!deletingId || saving}
                                                            onClick={() => void handleDelete(record)}>
                                                            {deletingId === record.id ? "Removing..." : "Remove today's record"}
                                                        </button>
                                                    ) : <span className="health-monitoring-note">Past record</span>}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </>
                )}
                <p className="health-monitoring-note">
                    Showing up to 10 recent records for the selected learner. Deletion is limited to records entered today (Philippine time).
                </p>
            </div>
        </section>
    );
}

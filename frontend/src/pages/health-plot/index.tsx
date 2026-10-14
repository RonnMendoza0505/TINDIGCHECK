import { useEffect, useMemo, useState } from "react";
import { fetchLearners, type Learner } from "../../lib/learners";
import {
    fetchHealthPlotRecords,
    MAX_PLOT_RECORDS,
    type PlotPeriod
} from "../../lib/healthPlot";
import type { HistoryRecord } from "../../lib/healthRecordHistory";
import type { UserProfile } from "../../types";
import LearnerHealthReport from "../../components/health-plot/LearnerHealthReport";
import "./index.css";

type Props = { user: UserProfile; mode?: "plot" | "report" };
type MetricKey = "weight" | "height" | "heart_rate" | "spo2" | "bmi";

type MetricDefinition = {
    key: MetricKey;
    label: string;
    unit: string;
    decimals: number;
    color: string;
};

const METRICS: MetricDefinition[] = [
    { key: "weight", label: "Weight", unit: "kg", decimals: 1, color: "#16784b" },
    { key: "height", label: "Height", unit: "cm", decimals: 1, color: "#3777b8" },
    { key: "heart_rate", label: "Heart Rate", unit: "bpm", decimals: 0, color: "#b45661" },
    { key: "spo2", label: "SpO₂", unit: "%", decimals: 0, color: "#7953b5" },
    { key: "bmi", label: "BMI", unit: "kg/m²", decimals: 2, color: "#bb7428" }
];

const DATE_FORMAT = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", year: "numeric", month: "short", day: "numeric"
});
const DATE_TIME_FORMAT = new Intl.DateTimeFormat("en-PH", {
    timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short"
});

function learnerName(learner: Learner): string {
    return `${learner.last_name}, ${learner.first_name}${learner.middle_name ? ` ${learner.middle_name}` : ""}`;
}

function formatDate(value: string | null, includeTime = false): string {
    if (!value) return "—";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "—";
    return includeTime ? DATE_TIME_FORMAT.format(date) : DATE_FORMAT.format(date);
}

function valueLabel(value: number | null, metric: MetricDefinition): string {
    return value === null ? "—" : `${value.toFixed(metric.decimals)} ${metric.unit}`;
}

function getValue(record: HistoryRecord, key: MetricKey): number | null {
    const value = record[key];
    return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Pure SVG trend plot; no additional npm dependencies. */
function TrendChart({ records, metric }: { records: HistoryRecord[]; metric: MetricDefinition }) {
    const samples = records.flatMap(record => {
        const value = getValue(record, metric.key);
        const time = record.recorded_at ? new Date(record.recorded_at).getTime() : NaN;
        return value === null || !Number.isFinite(time)
            ? []
            : [{ id: record.id, value, time, date: record.recorded_at! }];
    });

    if (samples.length === 0) {
        return <div className="tdc-plot-empty">No dated {metric.label.toLowerCase()} measurements are available for this period.</div>;
    }

    const width = 920;
    const height = 320;
    const left = 72;
    const right = 30;
    const top = 24;
    const bottom = 56;
    const chartWidth = width - left - right;
    const chartHeight = height - top - bottom;

    const values = samples.map(point => point.value);
    const minValue = Math.min(...values);
    const maxValue = Math.max(...values);
    const padding = Math.max((maxValue - minValue) * 0.12, Math.abs(maxValue) * 0.02, 0.5);
    const yMin = Math.max(0, minValue - padding);
    const yMax = metric.key === "spo2"
        ? Math.min(100, Math.max(maxValue, maxValue + padding))
        : maxValue + padding;
    const safeYMax = yMax > yMin ? yMax : yMin + 1;
    const minTime = Math.min(...samples.map(point => point.time));
    const maxTime = Math.max(...samples.map(point => point.time));
    const x = (point: (typeof samples)[number], index: number): number => {
        if (maxTime !== minTime) return left + (point.time - minTime) / (maxTime - minTime) * chartWidth;
        if (samples.length === 1) return left + chartWidth / 2;
        return left + index / (samples.length - 1) * chartWidth;
    };
    const y = (value: number): number => top + (safeYMax - value) / (safeYMax - yMin) * chartHeight;
    const path = samples.map((point, index) => `${index === 0 ? "M" : "L"}${x(point, index).toFixed(2)},${y(point.value).toFixed(2)}`).join(" ");

    const tickIndices = Array.from(new Set(
        [0, 1, 2, 3, 4].map(step => Math.round(step * (samples.length - 1) / 4))
    ));

    return <div className="tdc-plot-chart-wrap">
        <svg className="tdc-plot-chart" viewBox={`0 0 ${width} ${height}`} role="img"
            aria-label={`${metric.label} history chart with ${samples.length} dated measurements`}>
            <title>{metric.label} history</title>
            {Array.from({ length: 5 }, (_, index) => {
                const tickValue = safeYMax - index * (safeYMax - yMin) / 4;
                const tickY = top + index * chartHeight / 4;
                return <g key={index}>
                    <line x1={left} y1={tickY} x2={width - right} y2={tickY} stroke="#e3ebe6" strokeDasharray={index === 4 ? "0" : "4 5"} />
                    <text x={left - 12} y={tickY + 4} textAnchor="end" fill="#61786a" fontSize="12">
                        {tickValue.toFixed(metric.decimals)}
                    </text>
                </g>;
            })}
            {tickIndices.map(index => {
                const point = samples[index];
                return <text key={index} x={x(point, index)} y={height - 22} textAnchor="middle"
                    fill="#61786a" fontSize="12">{formatDate(point.date)}</text>;
            })}
            {samples.length > 1 && <path d={path} fill="none" stroke={metric.color}
                strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" />}
            {samples.map((point, index) => <circle key={point.id} cx={x(point, index)} cy={y(point.value)}
                r="5" fill={metric.color} stroke="#ffffff" strokeWidth="2">
                <title>{`${formatDate(point.date, true)}: ${valueLabel(point.value, metric)}`}</title>
            </circle>)}
            <text x={width / 2} y={height - 2} fill="#61786a" fontSize="12" textAnchor="middle">Measurement date (Philippine time)</text>
        </svg>
        <p className="tdc-plot-chart-help">Each dot represents a saved measurement. Hover over a dot for its value, or use the history table below.</p>
    </div>;
}

export default function HealthPlot({ user, mode = "plot" }: Props) {
    const viewer = user.role === "Viewer";
    const [learners, setLearners] = useState<Learner[]>([]);
    const [loadingLearners, setLoadingLearners] = useState(true);
    const [learnerError, setLearnerError] = useState("");
    const [grade, setGrade] = useState("All");
    const [section, setSection] = useState("All");
    const [sex, setSex] = useState("All");
    const [search, setSearch] = useState("");
    const [learnerId, setLearnerId] = useState("");
    const [period, setPeriod] = useState<PlotPeriod>("90");
    const [metricKey, setMetricKey] = useState<MetricKey>("weight");
    const [records, setRecords] = useState<HistoryRecord[]>([]);
    const [truncated, setTruncated] = useState(false);
    const [loadingRecords, setLoadingRecords] = useState(false);
    const [recordError, setRecordError] = useState("");
    const [refresh, setRefresh] = useState(0);
    const [showReport, setShowReport] = useState(false);

    useEffect(() => {
        let active = true;
        setLoadingLearners(true);
        void fetchLearners(user).then(data => {
            if (active) { setLearners(data); setLearnerError(""); }
        }).catch(error => {
            if (active) setLearnerError(error instanceof Error ? error.message : "Unable to load learners.");
        }).finally(() => { if (active) setLoadingLearners(false); });
        return () => { active = false; };
    }, [user]);

    const sections = useMemo(() => Array.from(new Set(
        learners.filter(learner => grade === "All" || String(learner.grade) === grade)
            .map(learner => learner.section)
    )).sort((a, b) => a.localeCompare(b)), [learners, grade]);

    const filteredLearners = useMemo(() => learners.filter(learner => {
        const query = search.trim().toLowerCase();
        return (!query || `${learner.student_id} ${learnerName(learner)}`.toLowerCase().includes(query)) &&
            (viewer || grade === "All" || String(learner.grade) === grade) &&
            (viewer || section === "All" || learner.section === section) &&
            (sex === "All" || learner.sex.toLowerCase() === sex.toLowerCase());
    }), [learners, viewer, grade, section, sex, search]);

    const selectedLearner = learners.find(learner => learner.id === learnerId);

    useEffect(() => {
        if (!learnerId || loadingLearners || !selectedLearner) return;
        let active = true;
        setLoadingRecords(true);
        void fetchHealthPlotRecords(user, learnerId, learners, period).then(result => {
            if (active) {
                setRecords(result.records);
                setTruncated(result.truncated);
                setRecordError("");
            }
        }).catch(error => {
            if (active) {
                setRecords([]);
                setTruncated(false);
                setRecordError(error instanceof Error ? error.message : "Unable to load plot history.");
            }
        }).finally(() => { if (active) setLoadingRecords(false); });
        return () => { active = false; };
    }, [user, learnerId, learners, period, refresh, loadingLearners, selectedLearner?.id]);

    const latest = records.length ? records[records.length - 1] : null;
    const metric = METRICS.find(item => item.key === metricKey) ?? METRICS[0];
    const newestFirst = useMemo(() => [...records].reverse().slice(0, 12), [records]);

    function chooseLearner(value: string) {
        setShowReport(false);
        setLearnerId(value);
        setRecords([]);
        setTruncated(false);
        setRecordError("");
        setLoadingRecords(Boolean(value));
    }

    return <section className="tdc-plot-page">
        <header className="tdc-plot-header">
            <div>
                <p className="eyebrow">TINDIGCHECK! 2.0</p>
                <h1>{mode === "report" ? "Print Health Report" : "Health Plot"}</h1>
                <p>{mode === "report" ? "Select a learner and date range, then preview and print the health report." : "Visualize a learner's recorded measurements over time."}</p>
            </div>
            <button className="tdc-plot-button" type="button" disabled={loadingLearners || loadingRecords}
                onClick={() => { setLoadingRecords(Boolean(learnerId)); setRefresh(value => value + 1); }}>
                Refresh data
            </button>
        </header>

        {viewer && <p className="tdc-plot-assignment">
            Viewer: Grade {user.grade ?? "—"}, Section {user.section ?? "—"}. Only the latest two records per learner are requested.
        </p>}

        <div className="tdc-plot-panel">
            <h2>Select learner and date range</h2>
            {learnerError && <p role="alert" className="tdc-plot-error">{learnerError}</p>}
            <div className="tdc-plot-filters">
                {!viewer && <>
                    <label>Grade
                        <select value={grade} onChange={event => { setGrade(event.target.value); setSection("All"); chooseLearner(""); }}>
                            <option value="All">All grades</option>
                            {[1, 2, 3, 4, 5, 6].map(value => <option key={value} value={value}>Grade {value}</option>)}
                        </select>
                    </label>
                    <label>Section
                        <select value={section} onChange={event => { setSection(event.target.value); chooseLearner(""); }}>
                            <option value="All">All sections</option>
                            {sections.map(value => <option key={value} value={value}>{value}</option>)}
                        </select>
                    </label>
                </>}
                <label>Sex
                    <select value={sex} onChange={event => { setSex(event.target.value); chooseLearner(""); }}>
                        <option value="All">All</option>
                        <option value="Male">Male</option>
                        <option value="Female">Female</option>
                    </select>
                </label>
                <label>Search learner
                    <input type="search" value={search} placeholder="Name or Learner ID"
                        onChange={event => { setSearch(event.target.value); chooseLearner(""); }} />
                </label>
                <label>Learner
                    <select value={learnerId} onChange={event => chooseLearner(event.target.value)} disabled={loadingLearners}>
                        <option value="">{loadingLearners ? "Loading learners..." : "Select a learner"}</option>
                        {filteredLearners.map(learner => <option key={learner.id} value={learner.id}>
                            {learnerName(learner)} — {learner.student_id}
                        </option>)}
                    </select>
                </label>
                <label>Date range
                    <select value={period} onChange={event => { setShowReport(false); setPeriod(event.target.value as PlotPeriod); setRecords([]); setLoadingRecords(Boolean(learnerId)); }}>
                        <option value="30">Last 30 days</option>
                        <option value="90">Last 90 days</option>
                        <option value="365">Last 12 months</option>
                        <option value="all">All available dates</option>
                    </select>
                </label>
            </div>
            {selectedLearner && <p className="tdc-plot-learner-note">
                {learnerName(selectedLearner)} · Grade {selectedLearner.grade} / {selectedLearner.section} · {selectedLearner.sex}
            </p>}
        </div>

        {!learnerId ? <div className="tdc-plot-panel tdc-plot-empty">Select a learner to view their health trends.</div>
            : loadingRecords || loadingLearners ? <div className="tdc-plot-panel tdc-plot-empty">Loading measurements...</div>
            : recordError ? <div className="tdc-plot-panel"><p role="alert" className="tdc-plot-error">{recordError}</p></div>
            : records.length === 0 ? <div className="tdc-plot-panel tdc-plot-empty">No measurements were recorded in the selected date range.</div>
            : <>
                {mode === "report" && <div className="tdc-plot-panel tdc-report-launch">
                    <div>
                        <h2>Printable Learner Health Report</h2>
                        <p>Preview the selected learner's measurements, then print or save a PDF.</p>
                    </div>
                    <button className="tdc-plot-button" type="button" onClick={() => setShowReport(true)}>
                        Print Health Report
                    </button>
                </div>}
                {mode !== "report" && <>
                <div className="tdc-plot-cards" aria-label="Latest measurements">
                    {METRICS.map(item => {
                        const current = latest ? getValue(latest, item.key) : null;
                        const lastWithValue = [...records].reverse().find(record => getValue(record, item.key) !== null);
                        const displayed = current ?? (lastWithValue ? getValue(lastWithValue, item.key) : null);
                        return <button key={item.key} type="button"
                            className={`tdc-plot-card${metricKey === item.key ? " tdc-plot-card-active" : ""}`}
                            style={{ borderTopColor: item.color }}
                            aria-pressed={metricKey === item.key}
                            onClick={() => setMetricKey(item.key)}>
                            <span>{item.label}</span>
                            <strong>{valueLabel(displayed, item)}</strong>
                            <small>{current === null && displayed !== null ? "Most recent available" : "Latest measurement"}</small>
                        </button>;
                    })}
                </div>

                <div className="tdc-plot-panel">
                    <div className="tdc-plot-panel-heading">
                        <div>
                            <h2>{metric.label} trend</h2>
                            <p>{records.length} record{records.length === 1 ? "" : "s"} in the selected period</p>
                        </div>
                        <span className="tdc-plot-bmi-status">Latest BMI status: <strong>{latest?.bmi_status ?? "Not assessed"}</strong></span>
                    </div>
                    <TrendChart records={records} metric={metric} />
                    {truncated && <p className="tdc-plot-notice">Showing the newest {MAX_PLOT_RECORDS} records in this period. Older measurements may be omitted.</p>}
                </div>

                <div className="tdc-plot-panel">
                    <div className="tdc-plot-panel-heading">
                        <h2>Measurement history</h2>
                        <span className="tdc-plot-count">Latest {newestFirst.length} record{newestFirst.length === 1 ? "" : "s"}</span>
                    </div>
                    <div className="tdc-plot-table-scroll">
                        <table className="tdc-plot-table">
                            <thead><tr>
                                <th>Date &amp; Time (PH)</th>
                                <th>Weight</th>
                                <th>Height</th>
                                <th>Heart Rate</th>
                                <th>SpO₂</th>
                                <th>BMI</th>
                                <th>BMI Status</th>
                            </tr></thead>
                            <tbody>{newestFirst.map(record => <tr key={record.id}>
                                <td>{formatDate(record.recorded_at, true)}</td>
                                {METRICS.map(item => <td key={item.key}>{valueLabel(getValue(record, item.key), item)}</td>)}
                                <td>{record.bmi_status}</td>
                            </tr>)}</tbody>
                        </table>
                    </div>
                </div>
                </>}
            </>}

        {showReport && selectedLearner && records.length > 0 && !loadingRecords && !recordError && (
            <LearnerHealthReport
                learner={selectedLearner}
                user={user}
                records={records}
                period={period}
                truncated={truncated}
                onClose={() => setShowReport(false)}
            />
        )}

        <p className="tdc-plot-disclaimer">
            These plots show recorded values, not diagnoses. BMI status is an age- and sex-specific screening result when available.
            Viewer limits shown in this interface must also be enforced by Supabase Row Level Security or a secure server endpoint.
        </p>
    </section>;
}

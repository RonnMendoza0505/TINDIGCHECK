import { useEffect, useState, type ChangeEvent } from "react";
import { fetchSections, type SchoolSection } from "../../lib/sections";
import { downloadLearnerTemplate, importNewLearners, previewLearnerImport,
    type ImportPreview } from "../../lib/learnerImport";
import { exportLearnerWorkbook } from "../../lib/learnerExport";
import type { UserProfile } from "../../types";
import "./learnerDataTransfer.css";

type Props = { user: UserProfile; onImported: () => Promise<void> };
const GRADES = [1, 2, 3, 4, 5, 6];

export default function LearnerDataTransfer({ user, onImported }: Props) {
    const [sections, setSections] = useState<SchoolSection[]>([]);
    const [grade, setGrade] = useState("All");
    const [section, setSection] = useState("All");
    const [includeHealth, setIncludeHealth] = useState(true);
    const [preview, setPreview] = useState<ImportPreview | null>(null);
    const [busy, setBusy] = useState(false);
    const [confirmed, setConfirmed] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");
    const canManage = user.role === "Super Admin" || user.role === "Admin";

    useEffect(() => {
        if (!canManage) return;
        let active = true;
        fetchSections().then(data => {
            if (active) setSections(data);
        }).catch(err => {
            if (active) setError(err instanceof Error ? err.message : "Could not load Sections.");
        });
        return () => { active = false; };
    }, [canManage]);

    if (!canManage) return null;

    const availableSections = [...new Set(sections
        .filter(item => grade === "All" || Number(item.grade) === Number(grade))
        .map(item => item.section_name))].sort();

    async function run(action: () => Promise<void>): Promise<void> {
        setBusy(true);
        setError("");
        setMessage("");
        try { await action(); }
        catch (err) { setError(err instanceof Error ? err.message : "Operation failed."); }
        finally { setBusy(false); }
    }

    function onFileSelected(event: ChangeEvent<HTMLInputElement>): void {
        const file = event.target.files?.[0];
        setPreview(null);
        setConfirmed(false);
        if (!file) return;
        void run(async () => {
            const result = await previewLearnerImport(user, file, sections);
            setPreview(result);
            setMessage("File checked. Review the preview before importing.");
        });
        // Selecting the same file again should re-run validation.
        event.target.value = "";
    }

    return (
        <section className="tdt-panel" aria-label="Learner Excel import and export">
            <div className="tdt-heading">
                <div>
                    <h2>Excel Import &amp; Export</h2>
                    <p>Authorized administrators only. Downloaded files contain confidential learner data.</p>
                </div>
            </div>
            <div className="tdt-grid">
                <div className="tdt-card">
                    <h3>Export data</h3>
                    <div className="tdt-fields">
                        <label>Grade
                            <select value={grade} disabled={busy} onChange={event => {
                                setGrade(event.target.value);
                                setSection("All");
                            }}>
                                <option value="All">All Grades</option>
                                {GRADES.map(item => <option key={item} value={String(item)}>Grade {item}</option>)}
                            </select>
                        </label>
                        <label>Section
                            <select value={section} disabled={busy} onChange={event => setSection(event.target.value)}>
                                <option value="All">All Sections</option>
                                {availableSections.map(item => <option key={item} value={item}>{item}</option>)}
                            </select>
                        </label>
                    </div>
                    <label className="tdt-check">
                        <input type="checkbox" checked={includeHealth} disabled={busy}
                            onChange={event => setIncludeHealth(event.target.checked)} />
                        Include health records and BMI status
                    </label>
                    <button type="button" disabled={busy} onClick={() => void run(async () => {
                        const result = await exportLearnerWorkbook(user, { grade, section, includeHealth });
                        setMessage(`Exported ${result.learners} learner(s) and ${result.healthRecords} health record(s).`);
                    })}>Export Excel (.xlsx)</button>
                    <p className="tdt-note">Separate worksheets per Grade/Section. Also includes a combined import-ready learner sheet.</p>
                </div>
                <div className="tdt-card">
                    <h3>Import new learners</h3>
                    <button type="button" disabled={busy} className="tdt-secondary" onClick={() => void run(async () => {
                        await downloadLearnerTemplate(user);
                        setMessage("Excel template downloaded.");
                    })}>Download Excel template</button>
                    <label className="tdt-file">Choose completed Excel workbook
                        <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                            disabled={busy} onChange={onFileSelected} />
                    </label>
                    <p className="tdt-note">Maximum 1,000 learners / 3 MB. Existing Learner IDs are skipped; no profiles are overwritten.</p>
                </div>
            </div>
            {preview && (
                <div className="tdt-preview">
                    <h3>Import preview: {preview.filename}</h3>
                    <p>Rows: {preview.totalDataRows} · New: {preview.rows.length} · Already registered: {preview.existingIds.length} · Errors: {preview.issues.length}</p>
                    {preview.existingIds.length > 0 && (
                        <p className="tdt-note">Existing IDs skipped: {preview.existingIds.slice(0, 12).join(", ")}{preview.existingIds.length > 12 ? "…" : ""}</p>
                    )}
                    {preview.issues.length > 0 && (
                        <div className="tdt-errors" role="alert">
                            <strong>Correct these errors and upload again:</strong>
                            <ul>{preview.issues.slice(0, 15).map((issue, index) => <li key={index}>{issue}</li>)}</ul>
                            {preview.issues.length > 15 && <p>Plus {preview.issues.length - 15} more errors.</p>}
                        </div>
                    )}
                    {preview.rows.length > 0 && (
                        <div className="tdt-table-scroll"><table>
                            <thead><tr><th>Learner ID</th><th>Name</th><th>Grade</th><th>Section</th><th>Allergies</th></tr></thead>
                            <tbody>{preview.rows.slice(0, 10).map(row => <tr key={row.student_id}>
                                <td>{row.student_id}</td><td>{row.last_name}, {row.first_name}</td>
                                <td>{row.grade}</td><td>{row.section}</td><td>{row.has_food_allergy ? row.allergies : "Not reported"}</td>
                            </tr>)}</tbody>
                        </table></div>
                    )}
                    <label className="tdt-check">
                        <input type="checkbox" checked={confirmed} disabled={busy || preview.issues.length > 0}
                            onChange={event => setConfirmed(event.target.checked)} />
                        I have reviewed the learner details and am authorized to import them.
                    </label>
                    <button type="button" disabled={busy || !confirmed || preview.issues.length > 0 || preview.rows.length === 0}
                        onClick={() => void run(async () => {
                            const result = await importNewLearners(user, preview);
                            setPreview(null);
                            setConfirmed(false);
                            await onImported();
                            setMessage(`Import complete: ${result.created} learner(s) added; ${result.skipped} duplicate(s) skipped.`);
                        })}>Confirm Import to Supabase</button>
                </div>
            )}
            {busy && <p role="status">Processing Excel file…</p>}
            {message && <p className="tdt-success" role="status">{message}</p>}
            {error && <p className="tdt-error" role="alert">{error}</p>}
        </section>
    );
}

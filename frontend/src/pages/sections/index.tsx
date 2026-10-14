import "./index.css";
import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type FormEvent
} from "react";

import type { UserProfile } from "../../types";
import {
    fetchSections,
    createSection,
    updateSection,
    deleteSection,
    type SchoolSection
} from "../../lib/sections";

type Props = {
    user: UserProfile;
};

const GRADES = [1, 2, 3, 4, 5, 6];
const PAGE_SIZE = 8;

/**
 * Section Management: responsive directory with paginated results.
 * Keeps the existing Supabase CRUD functions and Super Admin permissions.
 */
export default function SectionManagement({ user }: Props) {
    const [sections, setSections] = useState<SchoolSection[]>([]);
    const [gradeFilter, setGradeFilter] = useState("All");
    const [search, setSearch] = useState("");
    const [page, setPage] = useState(1);
    const [grade, setGrade] = useState(1);
    const [sectionName, setSectionName] = useState("");
    const [editingId, setEditingId] = useState<number | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const sectionInputRef = useRef<HTMLInputElement>(null);

    const canManage = user.role === "Super Admin";

    const loadSections = useCallback(async () => {
        setLoading(true);
        setError("");
        try {
            const records = await fetchSections();
            setSections(records);
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Unable to load sections."
            );
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        void loadSections();
    }, [loadSections]);

    const normalizedSearch = search.trim().toLowerCase();
    const visibleSections = sections
        .filter(section =>
            (gradeFilter === "All" || String(section.grade) === gradeFilter) &&
            (
                normalizedSearch.length === 0 ||
                section.section_name.toLowerCase().includes(normalizedSearch) ||
                `grade ${section.grade}`.includes(normalizedSearch)
            )
        )
        .sort((a, b) =>
            a.grade - b.grade ||
            a.section_name.localeCompare(b.section_name, undefined, { numeric: true })
        );

    const totalPages = Math.max(1, Math.ceil(visibleSections.length / PAGE_SIZE));
    const currentPage = Math.min(page, totalPages);
    const pageStart = (currentPage - 1) * PAGE_SIZE;
    const pageSections = visibleSections.slice(pageStart, pageStart + PAGE_SIZE);
    const gradeCount = new Set(sections.map(section => section.grade)).size;

    function resetForm() {
        setGrade(1);
        setSectionName("");
        setEditingId(null);
    }

    function startEditing(section: SchoolSection) {
        if (!canManage || saving) return;
        setEditingId(section.id);
        setGrade(section.grade);
        setSectionName(section.section_name);
        setError("");
        setMessage("");
        // Focus the editor when the user selects a row to edit.
        sectionInputRef.current?.focus();
    }

    async function handleSave(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canManage || saving) return;

        const name = sectionName.trim();
        if (!name) {
            setError("Enter a section name.");
            return;
        }
        if (!GRADES.includes(grade)) {
            setError("Select a valid grade.");
            return;
        }

        const duplicate = sections.some(section =>
            section.grade === grade &&
            section.section_name.toLowerCase() === name.toLowerCase() &&
            section.id !== editingId
        );
        if (duplicate) {
            setError("This section already exists for the selected grade.");
            return;
        }

        setSaving(true);
        setError("");
        setMessage("");
        try {
            if (editingId !== null) {
                await updateSection(editingId, grade, name);
                setMessage("Section updated successfully.");
            } else {
                await createSection(grade, name);
                setMessage("Section added successfully.");
            }
            resetForm();
            await loadSections();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Unable to save section."
            );
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete(section: SchoolSection) {
        if (!canManage || saving) return;
        const confirmed = window.confirm(
            `Delete Grade ${section.grade}, Section ${section.section_name}?`
        );
        if (!confirmed) return;

        setSaving(true);
        setError("");
        setMessage("");
        try {
            await deleteSection(section.id);
            setMessage("Section deleted successfully.");
            if (editingId === section.id) resetForm();
            await loadSections();
        } catch (err) {
            setError(
                err instanceof Error ? err.message : "Unable to delete section."
            );
        } finally {
            setSaving(false);
        }
    }

    return (
        <section className="sections-page">
            <header className="sections-page-header">
                <div>
                    <p className="sections-kicker">TINDIGCHECK! 2.0 / SCHOOL ADMINISTRATION</p>
                    <h1>Section Management</h1>
                    <p className="sections-description">
                        Manage class sections across Grades 1–6 in one organized directory.
                    </p>
                </div>
                <button
                    className="sections-refresh"
                    type="button"
                    onClick={() => void loadSections()}
                    disabled={loading || saving}
                >
                    <span aria-hidden="true">↻</span>
                    {loading ? "Loading..." : "Refresh"}
                </button>
            </header>

            <div className="sections-summary" aria-label="Section overview">
                <div className="sections-summary-card">
                    <span>Total Sections</span>
                    <strong>{sections.length}</strong>
                    <small>Across all grades</small>
                </div>
                <div className="sections-summary-card">
                    <span>Grades with Sections</span>
                    <strong>{gradeCount} <em>/ 6</em></strong>
                    <small>Grade levels represented</small>
                </div>
                <div className="sections-summary-card">
                    <span>Matching Results</span>
                    <strong>{visibleSections.length}</strong>
                    <small>Based on active filters</small>
                </div>
            </div>

            {error && <p className="sections-alert sections-alert--error" role="alert">{error}</p>}
            {message && <p className="sections-alert sections-alert--success" role="status">{message}</p>}

            <div className={`sections-workspace${canManage ? "" : " sections-workspace--readonly"}`}>
                <div className="sections-directory">
                    <div className="sections-card-heading">
                        <div>
                            <h2>Section Directory</h2>
                            <p>Browse and find existing class sections</p>
                        </div>
                        <span className="sections-count">{visibleSections.length} sections</span>
                    </div>

                    <div className="sections-filters">
                        <label className="sections-search-field">
                            <span>Search sections</span>
                            <input
                                type="search"
                                value={search}
                                placeholder="Search section or grade..."
                                onChange={event => {
                                    setSearch(event.target.value);
                                    setPage(1);
                                }}
                            />
                        </label>
                        <label className="sections-grade-field">
                            <span>Grade level</span>
                            <select
                                value={gradeFilter}
                                onChange={event => {
                                    setGradeFilter(event.target.value);
                                    setPage(1);
                                }}
                            >
                                <option value="All">All Grades</option>
                                {GRADES.map(item => (
                                    <option key={item} value={String(item)}>
                                        Grade {item}
                                    </option>
                                ))}
                            </select>
                        </label>
                    </div>

                    <div className="sections-table-wrap">
                        <table className="sections-table">
                            <caption className="sections-visually-hidden">
                                Sections matching the selected grade and search filters
                            </caption>
                            <thead>
                                <tr>
                                    <th scope="col">Grade</th>
                                    <th scope="col">Section</th>
                                    {canManage && <th scope="col">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr><td className="sections-empty" colSpan={canManage ? 3 : 2}>
                                        Loading sections...
                                    </td></tr>
                                ) : pageSections.length === 0 ? (
                                    <tr><td className="sections-empty" colSpan={canManage ? 3 : 2}>
                                        No sections match your filters.
                                    </td></tr>
                                ) : pageSections.map(section => (
                                    <tr key={section.id}>
                                        <td><span className="sections-grade-badge">Grade {section.grade}</span></td>
                                        <td><strong className="sections-name">{section.section_name}</strong></td>
                                        {canManage && (
                                            <td>
                                                <div className="sections-row-actions">
                                                    <button
                                                        type="button"
                                                        className="sections-edit"
                                                        onClick={() => startEditing(section)}
                                                        disabled={saving}
                                                        aria-label={`Edit Grade ${section.grade}, Section ${section.section_name}`}
                                                    >Edit</button>
                                                    <button
                                                        type="button"
                                                        className="sections-delete"
                                                        onClick={() => void handleDelete(section)}
                                                        disabled={saving}
                                                        aria-label={`Delete Grade ${section.grade}, Section ${section.section_name}`}
                                                    >Delete</button>
                                                </div>
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="sections-pagination">
                        <span>
                            {visibleSections.length === 0
                                ? "0 sections"
                                : `Showing ${pageStart + 1}–${Math.min(pageStart + PAGE_SIZE, visibleSections.length)} of ${visibleSections.length}`}
                        </span>
                        <div className="sections-pagination-controls">
                            <button
                                type="button"
                                onClick={() => setPage(currentPage - 1)}
                                disabled={currentPage === 1 || loading}
                                aria-label="Previous page"
                            >‹</button>
                            <span>Page {currentPage} of {totalPages}</span>
                            <button
                                type="button"
                                onClick={() => setPage(currentPage + 1)}
                                disabled={currentPage === totalPages || loading}
                                aria-label="Next page"
                            >›</button>
                        </div>
                    </div>
                </div>

                {canManage && (
                    <form className="section-editor" onSubmit={handleSave}>
                        <div className="sections-editor-icon" aria-hidden="true">+</div>
                        <h2>{editingId !== null ? "Edit Section" : "Add New Section"}</h2>
                        <p className="sections-editor-description">
                            {editingId !== null
                                ? "Update the selected section and save your changes."
                                : "Create a section for any Grade 1–6 class."}
                        </p>

                        <label className="sections-editor-field">
                            <span>Grade Level</span>
                            <select
                                value={grade}
                                onChange={event => setGrade(Number(event.target.value))}
                                disabled={saving}
                            >
                                {GRADES.map(item => (
                                    <option key={item} value={item}>Grade {item}</option>
                                ))}
                            </select>
                        </label>

                        <label className="sections-editor-field">
                            <span>Section Name</span>
                            <input
                                ref={sectionInputRef}
                                value={sectionName}
                                onChange={event => setSectionName(event.target.value)}
                                placeholder="e.g. A, B, Rizal"
                                maxLength={80}
                                disabled={saving}
                                required
                            />
                        </label>

                        <button className="sections-save" type="submit" disabled={saving}>
                            {saving
                                ? "Saving..."
                                : editingId !== null ? "Save Changes" : "+ Add Section"}
                        </button>
                        {editingId !== null && (
                            <button
                                className="sections-cancel"
                                type="button"
                                onClick={resetForm}
                                disabled={saving}
                            >Cancel Editing</button>
                        )}
                        <p className="sections-editor-note">
                            Only Super Admin accounts can add, edit, or delete sections.
                        </p>
                    </form>
                )}
            </div>
        </section>
    );
}

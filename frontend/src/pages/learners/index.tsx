import "./learner-menu-layout.css";
import "./learner-side-panel.css";

import {
    useCallback,
    useEffect,
    useState,
    type FormEvent
} from "react";

import {
    fetchSections,
    type SchoolSection
} from "../../lib/sections";

/*
    SYSTEM FUNCTION:
    Uploads learner profile photographs
    through the Supabase Edge Function.
*/
import {
    uploadLearnerPhoto
} from "../../lib/learnerPhotos";

import {
    uploadMedicalFile,
    fetchMedicalFiles,
    getMedicalFileUrl,
    deleteMedicalFile,
    validateMedicalFile,
    type LearnerMedicalFile
} from "../../lib/medical-files";

import LearnerPhoto from "../../components/learners/LearnerPhoto";
import LearnerDataTransfer from "../../components/learners/LearnerDataTransfer";

import type { UserProfile } from "../../types";

import {
    fetchLearners,
    checkDuplicateLearnerId,
    createLearner,
    updateLearner,
    deleteLearner,
    type Learner,
    type LearnerInput
} from "../../lib/learners";

/*
    SYSTEM FUNCTION:
    Defines the authenticated user's
    account information and permissions.
*/
type Props = {
    user: UserProfile;
    mode?: "directory" | "tools" | "excel";
    onNavigateToTools?: () => void;
    onNavigateToDirectory?: () => void;
};

/*
    SYSTEM FUNCTION:
    Defines the default learner registration
    form values.
*/
const EMPTY_FORM: LearnerInput = {
    student_id: "",
    last_name: "",
    first_name: "",
    middle_name: null,
    age: 6,
    sex: "Male",
    grade: 1,
    section: "",
    has_food_allergy: false,
    allergies: "",
    date_of_birth: null
};

/*
    SYSTEM FUNCTION:
    Defines Grade levels supported by
    TINDIGCHECK! 2.0.
*/
const GRADES = [1, 2, 3, 4, 5, 6];

/*
    SYSTEM FUNCTION:
    Formats Section names for display
    without changing their database values.
*/
function formatSection(section: string): string {
    return section.startsWith("Section ")
        ? section
        : `Section ${section}`;
}

/*
    SYSTEM FUNCTION:
    Manages learner registration, editing,
    deletion, searching, and filtering.
*/
export default function LearnerManagement({ user, mode = "directory", onNavigateToTools, onNavigateToDirectory }: Props) {

    /*
        SYSTEM FUNCTION:
        Stores learner profiles retrieved
        from Supabase.
    */
    const [learners, setLearners] =
        useState<Learner[]>([]);

    /*
        SYSTEM FUNCTION:
        Stores the learner search input.
    */
    const [search, setSearch] = useState("");

    /*
        SYSTEM FUNCTION:
        Stores Grade, Section, and Sex
        filters for the learner directory.
    */
    const [gradeFilter, setGradeFilter] =
        useState("All");

    const [sectionFilter, setSectionFilter] =
        useState("All");

    const [sexFilter, setSexFilter] =
        useState("All");

    /*
        SYSTEM FUNCTION:
        Stores information entered into
        the Add/Edit Learner form.
    */
    const [form, setForm] =
        useState<LearnerInput>({ ...EMPTY_FORM });

    /*
        SYSTEM FUNCTION:
        Identifies the learner being edited.
        Null means a new learner is being added.
    */
    const [editingId, setEditingId] =
        useState<string | null>(null);

    /*
        SYSTEM FUNCTION:
        Controls the visibility of the
        learner registration form.
    */
    const [formOpen, setFormOpen] = useState(true);

    /*
        SYSTEM FUNCTION:
        Stores the registered Grade and Section
        records retrieved from Supabase.
    */
    const [schoolSections, setSchoolSections] =
        useState<SchoolSection[]>([]);

    /*
        SYSTEM FUNCTION:
        Tracks Section loading and errors.
    */
    const [sectionsLoading, setSectionsLoading] =
        useState(false);

    const [sectionsError, setSectionsError] =
        useState("");

    /*
        SYSTEM FUNCTION:
        Stores the selected learner
        profile photograph.
    */
    const [photoFile, setPhotoFile] =
        useState<File | null>(null);

    /*
        SYSTEM FUNCTION:
        Stores a temporary image preview URL.
    */
    const [photoPreview, setPhotoPreview] =
        useState("");

    // Part 02: selected documents; Part 04: stored privately in Supabase.
    const [medicalFiles, setMedicalFiles] = useState<File[]>([]);
    const [savedMedicalFiles, setSavedMedicalFiles] = useState<LearnerMedicalFile[]>([]);
    const [medicalFilesLoading, setMedicalFilesLoading] = useState(false);

    /*
        SYSTEM FUNCTION:
        Tracks loading and saving operations.
    */
    const [loading, setLoading] =
        useState(true);

    const [saving, setSaving] =
        useState(false);

    /*
        SYSTEM FUNCTION:
        Stores success and error messages.
    */
    const [message, setMessage] =
        useState("");

    const [error, setError] =
        useState("");

    /*
        SYSTEM FUNCTION:
        Checks whether the logged-in account
        can add, edit, or delete learner profiles.
    */
    const canManage =
        user.role === "Super Admin" ||
        user.role === "Admin";

    /*
        SYSTEM FUNCTION:
        Retrieves the latest Grade and Section
        records from Supabase.

        Sections created in Section Management
        become available after refreshing.
    */
    const loadSchoolSections = useCallback(async () => {
        setSectionsLoading(true);
        setSectionsError("");

        try {
            const records = await fetchSections();

            setSchoolSections(records);

            console.log(
                "SECTIONS LOADED:",
                records.length
            );
        } catch (err) {
            const message =
                err instanceof Error
                    ? err.message
                    : "Unable to load Sections.";

            setSectionsError(message);

            console.error(
                "SECTION LOAD FAILED:",
                err
            );
        } finally {
            setSectionsLoading(false);
        }
    }, []);

    /*
        SYSTEM FUNCTION:
        Retrieves learner profiles permitted
        for the currently logged-in account.
    */
    const loadLearners = useCallback(async () => {
        setLoading(true);
        setError("");

        try {
            const records = await fetchLearners(user);

            setLearners(records);
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to load learners."
            );
        } finally {
            setLoading(false);
        }
    }, [user]);

    /*
        SYSTEM FUNCTION:
        Loads the registered Sections when
        Learner Management opens.
    */
    useEffect(() => {
        void loadSchoolSections();
    }, [loadSchoolSections]);

    /*
        SYSTEM FUNCTION:
        Loads learner profiles when
        Learner Management opens.
    */
    useEffect(() => {
        void loadLearners();
    }, [loadLearners]);

    /*
        SYSTEM FUNCTION:
        Generates the selected photograph's
        preview and releases the temporary URL
        when the file changes or is removed.
    */
    useEffect(() => {
        if (!photoFile) {
            setPhotoPreview("");
            return;
        }

        const previewUrl =
            URL.createObjectURL(photoFile);

        setPhotoPreview(previewUrl);

        return () => {
            URL.revokeObjectURL(previewUrl);
        };
    }, [photoFile]);

    /*
        SYSTEM FUNCTION:
        Retrieves the Sections saved in Supabase
        for the Grade selected in the form.
    */
    const registrationSections = [
        ...new Set(
            schoolSections
                .filter(section =>
                    Number(section.grade) ===
                    Number(form.grade)
                )
                .map(section =>
                    section.section_name.trim()
                )
                .filter(Boolean)
        )
    ].sort((a, b) => a.localeCompare(b));

    /*
        SYSTEM FUNCTION:
        Preserves a learner's current Section
        when editing an older profile, even
        when that Section is no longer listed.
    */
    const formSections =
        form.section &&
        !registrationSections.includes(form.section)
            ? [...registrationSections, form.section]
            : registrationSections;

    /*
        SYSTEM FUNCTION:
        Retrieves Sections available for
        the learner directory filters.
    */
    const availableSections = [
        ...new Set([
            ...schoolSections
                .filter(section =>
                    gradeFilter === "All" ||
                    String(section.grade) === gradeFilter
                )
                .map(section =>
                    section.section_name.trim()
                ),
            ...learners
                .filter(learner =>
                    gradeFilter === "All" ||
                    String(learner.grade) === gradeFilter
                )
                .map(learner => learner.section)
        ].filter(Boolean))
    ].sort((a, b) => a.localeCompare(b));

    /*
        SYSTEM FUNCTION:
        Filters learner profiles according
        to search, Grade, Section, and Sex.
    */
    const filteredLearners = learners.filter(learner => {
        const searchable = [
            learner.student_id,
            learner.last_name,
            learner.first_name,
            learner.middle_name || "",
            learner.grade,
            learner.section
        ]
            .join(" ")
            .toLowerCase();

        const matchesSearch = searchable.includes(
            search.toLowerCase().trim()
        );

        const matchesGrade =
            gradeFilter === "All" ||
            String(learner.grade) === gradeFilter;

        const matchesSection =
            sectionFilter === "All" ||
            learner.section === sectionFilter;

        const matchesSex =
            sexFilter === "All" ||
            learner.sex === sexFilter;

        return (
            matchesSearch &&
            matchesGrade &&
            matchesSection &&
            matchesSex
        );
    });

    /*
        SYSTEM FUNCTION:
        Opens a blank learner registration form
        and refreshes Sections from Supabase.
    */
    function openAddForm() {
        if (!canManage) return;

        setForm({ ...EMPTY_FORM });
        setEditingId(null);
        setPhotoFile(null);
        setMedicalFiles([]);
        setSavedMedicalFiles([]);
        setMessage("");
        setError("");
        setFormOpen(true);

        onNavigateToTools?.();

        void loadSchoolSections();
    }

    /*
        SYSTEM FUNCTION:
        Opens the Edit Learner form and displays
        the selected learner's information.
    */
    function openEditForm(learner: Learner) {
        if (!canManage) return;

        setForm({
            student_id: learner.student_id,
            last_name: learner.last_name,
            first_name: learner.first_name,
            middle_name: learner.middle_name,
            age: learner.age,
            sex: learner.sex,
            grade: learner.grade,
            section: learner.section,
            has_food_allergy: learner.has_food_allergy,
            allergies: learner.allergies,
            date_of_birth: learner.date_of_birth
        });

        setEditingId(learner.id);
        setPhotoFile(null);
        setMedicalFiles([]);
        setSavedMedicalFiles([]);
        setMedicalFilesLoading(true);
        void fetchMedicalFiles(learner.id)
            .then(setSavedMedicalFiles)
            .catch(err => setError(err instanceof Error ? err.message : "Unable to load medical files."))
            .finally(() => setMedicalFilesLoading(false));
        setMessage("");
        setError("");
        setFormOpen(true);

        onNavigateToTools?.();

        void loadSchoolSections();
    }

    /*
        SYSTEM FUNCTION:
        Closes the learner registration form.
    */
    function closeForm() {
        openAddForm();
    }

    /*
        SYSTEM FUNCTION:
        Updates a selected learner form field
        while retaining the other entered values.
    */
    function updateField<K extends keyof LearnerInput>(
        field: K,
        value: LearnerInput[K]
    ) {
        setForm(previous => ({
            ...previous,
            [field]: value
        }));
    }

    /*
        SYSTEM FUNCTION:
        Validates learner information,
        checks for duplicate Learner IDs,
        and creates or updates a learner
        record in Supabase.
    */
    async function handleSubmit(
        event: FormEvent<HTMLFormElement>
    ) {
        event.preventDefault();

        if (!canManage || saving) return;

        setSaving(true);
        setError("");
        setMessage("");

        try {
            /*
                SYSTEM FUNCTION:
                Prepares and cleans registration
                information before submission.
            */
            const input: LearnerInput = {
                ...form,
                student_id: form.student_id.trim(),
                last_name: form.last_name.trim(),
                first_name: form.first_name.trim(),
                middle_name:
                    form.middle_name?.trim() || null,
                section: form.section.trim(),
                has_food_allergy: form.has_food_allergy,
                allergies: form.has_food_allergy ? form.allergies.trim() : "",
                date_of_birth: form.date_of_birth || null
            };

            /*
                SYSTEM FUNCTION:
                Checks whether required fields
                contain valid information.
            */
            if (
                !input.student_id ||
                !input.last_name ||
                !input.first_name ||
                !input.section
            ) {
                throw new Error(
                    "Complete all required fields."
                );
            }

            /*
                SYSTEM FUNCTION:
                Confirms that the selected Section
                belongs to the chosen Grade using
                the saved Supabase records.
            */
            const allowedSections = schoolSections
                .filter(section =>
                    Number(section.grade) ===
                    Number(input.grade)
                )
                .map(section =>
                    section.section_name.trim()
                );

            /*
                SYSTEM FUNCTION:
                Allows an unchanged Section when
                editing an older learner profile.
            */
            const existingSectionUnchanged =
                editingId !== null &&
                learners.some(learner =>
                    learner.id === editingId &&
                    learner.grade === input.grade &&
                    learner.section === input.section
                );

            if (
                !allowedSections.includes(input.section) &&
                !existingSectionUnchanged
            ) {
                throw new Error(
                    "Select a valid Section for the chosen Grade."
                );
            }

            /*
                SYSTEM FUNCTION:
                Validates the entered learner age.
            */
            if (
                !Number.isInteger(input.age) ||
                input.age < 1 ||
                input.age > 25
            ) {
                throw new Error(
                    "Enter a valid learner age."
                );
            }

            // A checked allergy box requires an explicit allergen list.
            if (input.has_food_allergy && !input.allergies) {
                throw new Error("Specify the known food allergies before saving.");
            }

            // The date of birth is used for BMI-for-age screening.
            // Do not guess a birth date from the integer Age field.
            if (input.date_of_birth) {
                const dob = new Date(`${input.date_of_birth}T00:00:00Z`);
                if (!Number.isFinite(dob.getTime()) || dob > new Date()) {
                    throw new Error("Enter a valid past date of birth.");
                }
                const today = new Date();
                let years = today.getUTCFullYear() - dob.getUTCFullYear();
                if (today.getUTCMonth() < dob.getUTCMonth() ||
                    (today.getUTCMonth() === dob.getUTCMonth() &&
                        today.getUTCDate() < dob.getUTCDate())) years -= 1;
                if (years < 1 || years > 25) {
                    throw new Error("Date of birth is outside the supported learner age range.");
                }
                input.age = years;
            }

            /*
                SYSTEM FUNCTION:
                Prevents the registration of
                duplicate Learner IDs.
            */
            const duplicate =
                await checkDuplicateLearnerId(
                    input.student_id,
                    editingId || undefined
                );

            if (duplicate) {
                throw new Error(
                    "This Learner ID already exists."
                );
            }

            // Validate documents before saving the learner profile.
            medicalFiles.forEach(validateMedicalFile);

            /*
    SYSTEM FUNCTION:
    Uploads the selected learner photo
    to Cloudinary before saving the
    learner record in Supabase.

    The returned protected asset reference
    is saved in the photo_url column.

    Existing photographs are preserved
    when no replacement is selected.
*/
if (photoFile) {
    console.log("STARTING CLOUDINARY UPLOAD");

    const photoReference =
        await uploadLearnerPhoto(photoFile);

    console.log("PHOTO UPLOADED:", photoReference);

    input.photo_url = photoReference;
}

            /*
                SYSTEM FUNCTION:
                Updates an existing learner or
                creates a new learner in Supabase.
            */
            let savedLearnerId: string;
            if (editingId) {
                await updateLearner(editingId, input);
                savedLearnerId = editingId;
            } else {
                savedLearnerId = await createLearner(input);
            }

            // Part 04: upload documents only after the learner exists.
            // If an upload fails, keep the saved learner and report partial success.
            let uploadedCount = 0;
            const uploadFailures: string[] = [];
            for (const file of medicalFiles) {
                try {
                    await uploadMedicalFile(savedLearnerId, file);
                    uploadedCount += 1;
                } catch (uploadError) {
                    uploadFailures.push(`${file.name}: ${uploadError instanceof Error ? uploadError.message : "Upload failed"}`);
                }
            }
            if (uploadFailures.length) {
                setError(`Learner saved, but ${uploadFailures.length} medical file(s) failed. Edit this learner to retry: ${uploadFailures.join("; ")}`);
            }

            /*
                SYSTEM FUNCTION:
                Displays the save result.

                The photograph is currently
                preview-only until Cloudinary
                integration is completed.
            */
            const resultMessage = editingId
                ? "Learner updated successfully."
                : "Learner added successfully.";

            /*
    SYSTEM FUNCTION:
    Displays a success message after
    the learner profile and selected
    photograph have been saved.
*/
setMessage(uploadedCount ? `${resultMessage} ${uploadedCount} medical file(s) uploaded.` : resultMessage);

            setFormOpen(false);
            setEditingId(null);
            // After a successful learner save, return to Learner Directory.
            onNavigateToDirectory?.();
            setPhotoFile(null);
            setMedicalFiles([]);
            setSavedMedicalFiles([]);
            setForm({ ...EMPTY_FORM });

            await loadLearners();

        } catch (err) {
            const dbError = err as {
                code?: string;
                message?: string;
            };

            if (dbError.code === "23505") {
                setError(
                    "This Learner ID already exists."
                );
            } else {
                setError(
                    err instanceof Error
                        ? err.message
                        : dbError.message ||
                          "Unable to save learner."
                );
            }

        } finally {
            setSaving(false);
        }
    }

    /*
        SYSTEM FUNCTION:
        Deletes the selected learner profile
        after administrator confirmation.
    */
    async function handleDelete(learner: Learner) {
        if (!canManage) return;

        const confirmed = window.confirm(
            `Delete ${learner.first_name} ` +
            `${learner.last_name}?`
        );

        if (!confirmed) return;

        setError("");
        setMessage("");

        try {
            await deleteLearner(learner.id);

            setMessage(
                "Learner deleted successfully."
            );

            await loadLearners();

        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to delete learner."
            );
        }
    }

    /*
        SYSTEM FUNCTION:
        Displays the Learner Management page,
        learner directory, filters, and
        learner registration form.
    */
    return (
        <section className={`learner-page learner-page--${mode}`}>

            <div className="learner-heading">
                <div>
                    <p className="eyebrow">
                        TINDIGCHECK! 2.0
                    </p>

                    <h1>{mode === "excel" ? "Import & Export Excel" : mode === "tools" ? "Add Learner" : "Learner Management"}</h1>

                    <p>
                        Manage learner profiles,
                        Grade levels, and Sections.
                    </p>
                </div>

                {canManage && (mode === "directory" || !formOpen) && (
                    <button
                        type="button"
                        className="primary-button"
                        onClick={openAddForm}
                    >
                        + Add Learner
                    </button>
                )}
            </div>

            {user.role === "Viewer" && (
                <p className="assigned-section">
                    Viewing Grade {user.grade},
                    Section {user.section}
                </p>
            )}

            {message && (
                <p
                    className="success-message"
                    role="status"
                >
                    {message}
                </p>
            )}

            {error && (
                <p
                    className="login-error"
                    role="alert"
                >
                    {error}
                </p>
            )}

            {sectionsError && (
                <p
                    className="login-error"
                    role="alert"
                >
                    Unable to load Sections:
                    {" "}
                    {sectionsError}
                </p>
            )}

            {/* Phase 6: Admin-only Excel backup and new-learner import. */}
            {mode === "excel" && canManage && (
                <LearnerDataTransfer user={user} onImported={loadLearners} />
            )}

            {/*
                SYSTEM FUNCTION:
                Displays learner searching
                and directory filtering.
            */}
            <div className="tdc-learners-workspace">
                {mode === "directory" && (
            <div className="tdc-learners-directory">
            <div className="learner-toolbar">

                <input
                    type="search"
                    placeholder="Search Learner ID or Name"
                    value={search}
                    onChange={event =>
                        setSearch(event.target.value)
                    }
                />

                {user.role !== "Viewer" && (
                    <select
                        value={gradeFilter}
                        onChange={event => {
                            setGradeFilter(
                                event.target.value
                            );
                            setSectionFilter("All");
                        }}
                        aria-label="Filter by Grade"
                    >
                        <option value="All">
                            All Grades
                        </option>

                        {GRADES.map(grade => (
                            <option
                                key={grade}
                                value={String(grade)}
                            >
                                Grade {grade}
                            </option>
                        ))}
                    </select>
                )}

                {user.role !== "Viewer" && (
                    <select
                        value={sectionFilter}
                        onChange={event =>
                            setSectionFilter(
                                event.target.value
                            )
                        }
                        aria-label="Filter by Section"
                    >
                        <option value="All">
                            All Sections
                        </option>

                        {availableSections.map(section => (
                            <option
                                key={section}
                                value={section}
                            >
                                {formatSection(section)}
                            </option>
                        ))}
                    </select>
                )}

                <select
                    value={sexFilter}
                    onChange={event =>
                        setSexFilter(event.target.value)
                    }
                    aria-label="Filter by Sex"
                >
                    <option value="All">
                        All Sex
                    </option>

                    <option value="Male">
                        Male
                    </option>

                    <option value="Female">
                        Female
                    </option>
                </select>

                <button
                    type="button"
                    onClick={() => {
                        void loadLearners();
                        void loadSchoolSections();
                    }}
                >
                    Refresh
                </button>
            </div>

            {/*
                SYSTEM FUNCTION:
                Displays the registered learner
                profiles in a searchable table.
            */}
            {loading ? (
                <p>Loading learner records...</p>
            ) : (
                <div className="learner-table-wrapper">
                    <table className="learner-table">
                        <thead>
                            <tr>
                                <th>Learner ID</th>
                                <th>Photo</th>
                                <th>Full Name</th>
                                <th>Age</th>
                                <th>Sex</th>
                                <th>Grade</th>
                                <th>Section</th>
                                <th>Food Allergies</th>
                                {canManage && (
                                    <th>Actions</th>
                                )}
                            </tr>
                        </thead>

                        <tbody>
                            {filteredLearners.map(learner => (
                                <tr key={learner.id}>
                                    <td>
                                        {learner.student_id}
                                    </td>
                                    <td>
                                        <LearnerPhoto
                                            learnerId={learner.id}
                                            photoReference={learner.photo_url}
                                            size={48}
                                        />
                                    </td>

                                    <td>
                                        {learner.last_name},
                                        {" "}
                                        {learner.first_name}
                                        {" "}
                                        {learner.middle_name || ""}
                                    </td>

                                    <td>{learner.age}</td>
                                    <td>{learner.sex}</td>
                                    <td>{learner.grade}</td>
                                    <td>
                                        {formatSection(
                                            learner.section
                                        )}
                                    </td>

                                    <td>{learner.has_food_allergy ? learner.allergies : "Not reported"}</td>

                                    {canManage && (
                                        <td>
                                            <div className="sections-row-actions learner-row-actions">
                                                <button
                                                    type="button"
                                                    className="sections-edit"
                                                    onClick={() =>
                                                        openEditForm(learner)
                                                    }
                                                >
                                                    Edit
                                                </button>

                                                <button
                                                    type="button"
                                                    className="sections-delete"
                                                    onClick={() =>
                                                        void handleDelete(
                                                            learner
                                                        )
                                                    }
                                                >
                                                    Delete
                                                </button>
                                            </div>
                                        </td>
                                    )}
                                </tr>
                            ))}

                            {filteredLearners.length === 0 && (
                                <tr>
                                    <td
                                        colSpan={canManage ? 9 : 8}
                                        className="empty-table"
                                    >
                                        No learner records found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

                </div>
                )}

            {/*
                SYSTEM FUNCTION:
                Displays the Add/Edit Learner form
                for authorized administrators.
            */}
            {mode === "tools" && formOpen && canManage && (
                <aside className="learner-form-card tdc-learner-editor">

                    <div className="learner-form-heading">
                        <div className="tdc-learner-editor-title">
                            <span className="tdc-learner-editor-icon" aria-hidden="true">+</span>
                            <h2>{editingId ? "Edit Learner" : "Add New Learner"}</h2>
                            <p>Register a learner for Grades 1–6, or update a selected profile.</p>
                        </div>
                        <button type="button" onClick={closeForm}>Clear</button>
                    </div>

                    <form onSubmit={handleSubmit}>
                        <div className="learner-form-grid">

                            <label>
                                Learner ID

                                <input
                                    value={form.student_id}
                                    onChange={event =>
                                        updateField(
                                            "student_id",
                                            event.target.value
                                        )
                                    }
                                    required
                                />
                            </label>

                            <label>
                                Surname

                                <input
                                    value={form.last_name}
                                    onChange={event =>
                                        updateField(
                                            "last_name",
                                            event.target.value
                                        )
                                    }
                                    required
                                />
                            </label>

                            <label>
                                First Name

                                <input
                                    value={form.first_name}
                                    onChange={event =>
                                        updateField(
                                            "first_name",
                                            event.target.value
                                        )
                                    }
                                    required
                                />
                            </label>

                            <label>
                                Middle Name

                                <input
                                    value={form.middle_name || ""}
                                    onChange={event =>
                                        updateField(
                                            "middle_name",
                                            event.target.value
                                        )
                                    }
                                />
                            </label>

                            <label>
                                Age

                                <input
                                    type="number"
                                    min="1"
                                    max="25"
                                    value={form.age}
                                    onChange={event =>
                                        updateField(
                                            "age",
                                            Number(event.target.value)
                                        )
                                    }
                                    required
                                />
                            </label>

                            <label>
                                Date of Birth (for BMI-for-age status)
                                <input
                                    type="date"
                                    value={form.date_of_birth ?? ""}
                                    max={new Date().toISOString().slice(0, 10)}
                                    onChange={event => updateField(
                                        "date_of_birth",
                                        event.target.value || null
                                    )}
                                />
                                <small>Optional; without an exact birth date, BMI status will be Not assessed.</small>
                            </label>

                            <label>
                                Sex

                                <select
                                    value={form.sex}
                                    onChange={event =>
                                        updateField(
                                            "sex",
                                            event.target.value
                                        )
                                    }
                                >
                                    <option value="Male">
                                        Male
                                    </option>

                                    <option value="Female">
                                        Female
                                    </option>
                                </select>
                            </label>

                            {/*
                                SYSTEM FUNCTION:
                                Selects the learner's Grade.

                                Changing Grade resets
                                the selected Section.
                            */}
                            <label>
                                Grade

                                <select
                                    value={form.grade}
                                    onChange={event => {
                                        const selectedGrade =
                                            Number(
                                                event.target.value
                                            );

                                        setForm(previous => ({
                                            ...previous,
                                            grade: selectedGrade,
                                            section: ""
                                        }));
                                    }}
                                    required
                                >
                                    {GRADES.map(grade => (
                                        <option
                                            key={grade}
                                            value={grade}
                                        >
                                            Grade {grade}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            {/*
                                SYSTEM FUNCTION:
                                Displays all registered Sections
                                for the selected Grade.

                                Sections are retrieved from
                                Supabase Section Management.
                            */}
                            <label>
                                Section

                                <select
                                    value={form.section}
                                    onChange={event =>
                                        updateField(
                                            "section",
                                            event.target.value
                                        )
                                    }
                                    required
                                    disabled={sectionsLoading}
                                >
                                    <option value="">
                                        {sectionsLoading
                                            ? "Loading Sections..."
                                            : "Select Section"}
                                    </option>

                                    {formSections.map(section => (
                                        <option
                                            key={section}
                                            value={section}
                                        >
                                            {formatSection(section)}
                                        </option>
                                    ))}
                                </select>

                                {!sectionsLoading &&
                                    formSections.length === 0 && (
                                    <small className="section-help">
                                        No Sections configured
                                        for this Grade.
                                    </small>
                                )}
                            </label>

                            <div className="form-group" style={{gridColumn: "1 / -1"}}>
                                <label style={{display: "flex", alignItems: "center", gap: 10}}>
                                    <input
                                        type="checkbox"
                                        className="learner-allergy-checkbox"
                                        checked={form.has_food_allergy}
                                        onChange={event => {
                                            const checked = event.target.checked;
                                            setForm(previous => ({
                                                ...previous,
                                                has_food_allergy: checked,
                                                allergies: checked ? previous.allergies : ""
                                            }));
                                        }}
                                    />
                                    Learner has known food allergies
                                </label>
                                {form.has_food_allergy && (
                                    <label style={{display: "block", marginTop: 12}}>
                                        Specify food allergies (comma-separated)
                                        <textarea
                                            rows={3}
                                            style={{display: "block", width: "100%", marginTop: 6}}
                                            placeholder="Example: egg, milk, shrimp"
                                            value={form.allergies}
                                            onChange={event => updateField("allergies", event.target.value)}
                                            required
                                        />
                                    </label>
                                )}
                                <small>Saved in Supabase learners and automatically shown in Meal Recommendations.</small>
                            </div>

                            {/* PART 02 / PART 04 — Medical files attached to learner */}
                            <div className="form-group" style={{ gridColumn: "1 / -1" }}>
                                <label htmlFor="learner-medical-files">Medical Files (Optional)</label>
                                <input
                                    id="learner-medical-files"
                                    type="file"
                                    multiple
                                    accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/jpeg,image/png,image/webp"
                                    onChange={event => {
                                        const chosen = Array.from(event.target.files ?? []);
                                        try {
                                            chosen.forEach(validateMedicalFile);
                                            setMedicalFiles(chosen);
                                            setError("");
                                        } catch (err) {
                                            setMedicalFiles([]);
                                            event.target.value = "";
                                            setError(err instanceof Error ? err.message : "Invalid medical file.");
                                        }
                                    }}
                                />
                                <small>PDF, JPG, PNG, or WEBP; up to 10 MB each. Stored in private Supabase Storage. Only Admin and Super Admin accounts can access these files.</small>
                                {medicalFiles.length > 0 && (
                                    <ul aria-label="Selected medical files">
                                        {medicalFiles.map((file, index) => (
                                            <li key={`${file.name}-${index}`}>{file.name}</li>
                                        ))}
                                    </ul>
                                )}
                                {editingId && (
                                    <div style={{ marginTop: 12 }}>
                                        <strong>Previously uploaded medical files</strong>
                                        {medicalFilesLoading ? <p>Loading medical files...</p> : (
                                            savedMedicalFiles.length === 0 ? <p>No medical files attached.</p> :
                                            <ul>
                                                {savedMedicalFiles.map(file => (
                                                    <li key={file.id}>
                                                        {file.original_name}{" "}
                                                        <button type="button" onClick={async () => {
                                                            try {
                                                                const url = await getMedicalFileUrl(file);
                                                                window.open(url, "_blank", "noopener,noreferrer");
                                                            } catch (err) { setError(err instanceof Error ? err.message : "Unable to open medical file."); }
                                                        }}>View</button>{" "}
                                                        <button type="button" onClick={async () => {
                                                            if (!window.confirm(`Remove ${file.original_name}?`)) return;
                                                            try {
                                                                await deleteMedicalFile(file);
                                                                setSavedMedicalFiles(prev => prev.filter(item => item.id !== file.id));
                                                            } catch (err) { setError(err instanceof Error ? err.message : "Unable to delete medical file."); }
                                                        }}>Remove</button>
                                                    </li>
                                                ))}
                                            </ul>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/*
                                SYSTEM FUNCTION:
                                Lets the administrator select
                                and preview a learner photograph.

                                Actual Cloudinary uploading
                                requires a separate integration.
                            */}
                            <div className="form-group">
                                <label htmlFor="learner-photo">
                                    Learner Profile Picture
                                </label>

                                <input
                                    id="learner-photo"
                                    type="file"
                                    accept="image/png,image/jpeg,image/webp"
                                    onChange={event => {
                                        const file =
                                            event.target.files?.[0];

                                        if (!file) {
                                            setPhotoFile(null);
                                            return;
                                        }

                                        if (
                                            !file.type.startsWith("image/") ||
                                            file.size > 2 * 1024 * 1024
                                        ) {
                                            setError(
                                                "Select a valid image under 2 MB."
                                            );

                                            event.target.value = "";
                                            setPhotoFile(null);
                                            return;
                                        }

                                        setError("");
                                        setPhotoFile(file);
                                    }}
                                />

                                {editingId && !photoFile && (
                                    <LearnerPhoto
                                        learnerId={editingId}
                                        photoReference={
                                            learners.find(learner => learner.id === editingId)?.photo_url ?? null
                                        }
                                        size={120}
                                    />
                                )}

                                {photoPreview && (
                                    <img
                                        src={photoPreview}
                                        alt="Learner profile preview"
                                        style={{
                                            width: "120px",
                                            height: "120px",
                                            objectFit: "cover",
                                            borderRadius: "12px"
                                        }}
                                    />
                                )}

                                {photoFile && (
                                    <small>
                                        Selected: {photoFile.name}
                                    </small>
                                )}

                                <small>
    Accepted formats: JPG, PNG, WEBP.
    Maximum file size: 2 MB.
    The selected photo will upload
    when you save the learner.
</small>
                            </div>

                        </div>

                        <button
                            type="submit"
                            className="primary-button"
                            disabled={saving || sectionsLoading}
                        >
                            {saving
                                ? "Saving..."
                                : editingId
                                    ? "Save Changes"
                                    : "Add Learner"}
                        </button>
                    </form>
                </aside>
            )}

            </div>
        </section>
    );
}

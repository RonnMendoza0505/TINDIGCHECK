import { useEffect, useMemo, useState } from "react";
import { fetchLearners, type Learner } from "../../lib/learners";
import { fetchLearnerHistoryPage, type HistoryRecord } from "../../lib/healthRecordHistory";
import {
    getMealIdeas,
    parseAllergyReview,
    type MealFocus
} from "../../lib/mealRecommendations";
import type { UserProfile } from "../../types";
import "./index.css";

type Props = { user: UserProfile };
const GRADES = [1, 2, 3, 4, 5, 6];

function displayName(learner: Learner): string {
    return `${learner.last_name}, ${learner.first_name}${learner.middle_name ? ` ${learner.middle_name}` : ""}`;
}

function dateInPhilippines(date: string | null): string {
    if (!date) return "—";
    const value = new Date(date);
    if (Number.isNaN(value.getTime())) return "—";
    return new Intl.DateTimeFormat("en-PH", {
        timeZone: "Asia/Manila", dateStyle: "medium", timeStyle: "short"
    }).format(value);
}

function showValue(value: number | null, suffix: string, decimals = 0): string {
    return value === null ? "—" : `${value.toFixed(decimals)} ${suffix}`.trim();
}

/*
    SYSTEM FUNCTION:
    Read-only learner measurements + rule-based example meal ideas.
    Allergy entries are NOT stored in Supabase in Phase 5A.
*/
export default function MealRecommendations({ user }: Props) {
    const viewer = user.role === "Viewer";
    const [learners, setLearners] = useState<Learner[]>([]);
    const [learnersLoading, setLearnersLoading] = useState(true);
    const [learnersError, setLearnersError] = useState("");
    const [grade, setGrade] = useState("All");
    const [section, setSection] = useState("All");
    const [sex, setSex] = useState("All");
    const [search, setSearch] = useState("");
    const [learnerId, setLearnerId] = useState("");
    const [records, setRecords] = useState<HistoryRecord[]>([]);
    const [recordsLoading, setRecordsLoading] = useState(false);
    const [recordsError, setRecordsError] = useState("");
    const [recordsRefresh, setRecordsRefresh] = useState(0);
    const [allergiesReviewed, setAllergiesReviewed] = useState(false);
    const [focus, setFocus] = useState<MealFocus>("balanced");

    useEffect(() => {
        let active = true;
        setLearnersLoading(true);
        fetchLearners(user)
            .then(result => {
                if (active) {
                    setLearners(result);
                    setLearnersError("");
                }
            })
            .catch(error => {
                if (active) {
                    setLearners([]);
                    setLearnersError(error instanceof Error ? error.message : "Unable to load learners.");
                }
            })
            .finally(() => { if (active) setLearnersLoading(false); });
        return () => { active = false; };
    }, [user]);

    const sections = useMemo(() => Array.from(new Set(
        learners.filter(item => grade === "All" || String(item.grade) === grade)
            .map(item => item.section)
    )).sort((a, b) => a.localeCompare(b)), [learners, grade]);

    const filteredLearners = useMemo(() => {
        const term = search.trim().toLowerCase();
        return learners.filter(item =>
            (viewer || grade === "All" || String(item.grade) === grade) &&
            (viewer || section === "All" || item.section === section) &&
            (sex === "All" || item.sex.toLowerCase() === sex.toLowerCase()) &&
            (!term || `${displayName(item)} ${item.student_id}`.toLowerCase().includes(term))
        );
    }, [learners, grade, section, sex, search, viewer]);

    const selectedLearner = learners.find(item => item.id === learnerId);

    useEffect(() => {
        if (!learnerId || !selectedLearner) {
            setRecords([]);
            setRecordsError("");
            setRecordsLoading(false);
            return;
        }
        let active = true;
        setRecordsLoading(true);
        setRecordsError("");
        setRecords([]);
        fetchLearnerHistoryPage(user, learnerId, 0)
            .then(result => {
                if (active) setRecords(result.records.slice(0, viewer ? 2 : 10));
            })
            .catch(error => {
                if (active) {
                    setRecords([]);
                    setRecordsError(error instanceof Error ? error.message : "Unable to load measurements.");
                }
            })
            .finally(() => { if (active) setRecordsLoading(false); });
        return () => { active = false; };
    }, [user, learnerId, selectedLearner, viewer, recordsRefresh]);

    const latest = records[0];
    // Allergy data comes from the selected learner's saved Supabase profile.
    const allergyText = selectedLearner?.has_food_allergy ? selectedLearner.allergies : "";
    const allergyIncomplete = Boolean(selectedLearner?.has_food_allergy && !allergyText.trim());
    const review = useMemo(() => parseAllergyReview(allergyText), [allergyText]);
    const canShowMeals = Boolean(
        selectedLearner && latest && !recordsLoading && !recordsError &&
        allergiesReviewed && !allergyIncomplete && review.unsupported.length === 0
    );
    const mealIdeas = useMemo(() => canShowMeals
        ? getMealIdeas(focus, review.allergens)
        : [], [canShowMeals, focus, review.allergens]);

    function resetLearnerSelection() {
        setLearnerId("");
        setRecords([]);
        setRecordsError("");
        setAllergiesReviewed(false);
    }

    function chooseLearner(id: string) {
        setLearnerId(id);
        setAllergiesReviewed(false);
        setRecords([]);
        setRecordsError("");
    }

    return (
        <section className="tdc-meals">
            <header className="tdc-meals-header">
                <p className="eyebrow">TINDIGCHECK! 2.0</p>
                <h1>Meal Recommendations</h1>
                <p>View saved health measurements and explore general school-meal examples.</p>
            </header>

            {viewer && (
                <p className="tdc-meals-assignment">
                    Viewer access: Grade {user.grade}, Section {user.section}. Only the two newest health records per learner are shown.
                </p>
            )}

            <div className="tdc-meals-panel">
                <h2>1. Select learner</h2>
                {learnersError && <p className="tdc-meals-error" role="alert">{learnersError}</p>}
                <div className="tdc-meals-filters">
                    {!viewer && (
                        <>
                            <label>Grade
                                <select value={grade} onChange={event => {
                                    setGrade(event.target.value);
                                    setSection("All");
                                    resetLearnerSelection();
                                }}>
                                    <option value="All">All grades</option>
                                    {GRADES.map(value => <option key={value} value={value}>Grade {value}</option>)}
                                </select>
                            </label>
                            <label>Section
                                <select value={section} onChange={event => {
                                    setSection(event.target.value);
                                    resetLearnerSelection();
                                }}>
                                    <option value="All">All sections</option>
                                    {sections.map(value => <option key={value} value={value}>{value}</option>)}
                                </select>
                            </label>
                        </>
                    )}
                    <label>Sex
                        <select value={sex} onChange={event => {
                            setSex(event.target.value);
                            resetLearnerSelection();
                        }}>
                            <option value="All">All</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                        </select>
                    </label>
                    <label>Search learner
                        <input type="search" value={search} onChange={event => {
                            setSearch(event.target.value);
                            resetLearnerSelection();
                        }} placeholder="Name or Learner ID" />
                    </label>
                    <label className="tdc-meals-full">Learner
                        <select value={learnerId} disabled={learnersLoading || Boolean(learnersError)}
                            onChange={event => chooseLearner(event.target.value)}>
                            <option value="">{learnersLoading ? "Loading learners..." : "Select learner"}</option>
                            {filteredLearners.map(item => (
                                <option key={item.id} value={item.id}>{displayName(item)} — {item.student_id}</option>
                            ))}
                        </select>
                    </label>
                </div>
                {!learnersLoading && !learnersError && filteredLearners.length === 0 && (
                    <p className="tdc-meals-muted">No learners match the selected filters.</p>
                )}
                {selectedLearner && (
                    <p className="tdc-meals-selected">
                        <strong>{displayName(selectedLearner)}</strong> · Grade {selectedLearner.grade} · {selectedLearner.section} · {selectedLearner.sex} · Age {selectedLearner.age}
                    </p>
                )}
            </div>

            <div className="tdc-meals-panel">
                <div className="tdc-meals-panel-heading">
                    <h2>2. Latest Health Monitoring results</h2>
                    <button type="button" className="tdc-meals-secondary"
                        disabled={!selectedLearner || recordsLoading}
                        onClick={() => setRecordsRefresh(value => value + 1)}>Refresh results</button>
                </div>
                {!selectedLearner ? (
                    <p className="tdc-meals-muted">Select a learner to load saved measurements.</p>
                ) : recordsLoading ? (
                    <p className="tdc-meals-muted">Loading saved health records...</p>
                ) : recordsError ? (
                    <p className="tdc-meals-error" role="alert">{recordsError}</p>
                ) : !latest ? (
                    <p className="tdc-meals-muted">No saved measurements found. Enter a record in Health Monitoring first.</p>
                ) : (
                    <>
                        <p className="tdc-meals-muted">Latest measurement: {dateInPhilippines(latest.recorded_at)}</p>
                        <div className="tdc-meals-metrics">
                            <div><span>Weight</span><strong>{showValue(latest.weight, "kg", 2)}</strong></div>
                            <div><span>Height</span><strong>{showValue(latest.height, "cm", 2)}</strong></div>
                            <div><span>Heart rate</span><strong>{showValue(latest.heart_rate, "bpm")}</strong></div>
                            <div><span>SpO₂</span><strong>{showValue(latest.spo2, "%")}</strong></div>
                            <div><span>BMI</span><strong>{showValue(latest.bmi, "", 2)}</strong></div>
                            <div><span>BMI Status</span><strong>{latest.bmi_status}</strong></div>
                        </div>
                        <div className="tdc-meals-table-wrap">
                            <table className="tdc-meals-table">
                                <thead><tr><th>Date (PH)</th><th>Weight</th><th>Height</th><th>Heart rate</th><th>SpO₂</th><th>BMI</th><th>BMI Status</th></tr></thead>
                                <tbody>{records.map(record => (
                                    <tr key={record.id}>
                                        <td>{dateInPhilippines(record.recorded_at)}</td>
                                        <td>{showValue(record.weight, "kg", 2)}</td>
                                        <td>{showValue(record.height, "cm", 2)}</td>
                                        <td>{showValue(record.heart_rate, "bpm")}</td>
                                        <td>{showValue(record.spo2, "%")}</td>
                                        <td>{showValue(record.bmi, "", 2)}</td>
                                        <td>{record.bmi_status}</td>
                                    </tr>
                                ))}</tbody>
                            </table>
                        </div>
                        <p className="tdc-meals-muted">BMI status uses age- and sex-specific screening reference data where available. It is not a diagnosis or a meal prescription.</p>
                    </>
                )}
            </div>

            <div className="tdc-meals-panel">
                <h2>3. Review food allergies</h2>
                <p className="tdc-meals-caution">
                    Food allergies are loaded from Learner Management and cannot be edited here.
                    If information is missing or incorrect, ask an Admin to update the learner profile.
                </p>
                <div className="tdc-meals-saved-allergies">
                    <strong>Saved food allergies:</strong>{" "}
                    {!selectedLearner ? "Select a learner" : selectedLearner.has_food_allergy
                        ? (selectedLearner.allergies.trim() || "Missing allergy details — ask an Admin to update")
                        : "No known food allergies reported in Learner Management"}
                </div>
                {allergyIncomplete && (
                    <p className="tdc-meals-error" role="alert">
                        This learner is marked as having food allergies, but the details are missing.
                        Meal suggestions are paused until an Admin updates Learner Management.
                    </p>
                )}
                {review.unsupported.length > 0 && (
                    <p className="tdc-meals-error" role="alert">
                        Cannot verify these allergy terms: {review.unsupported.join(", ")}. No meal ideas will be displayed. Ask a qualified school health or nutrition professional to review the ingredients.
                    </p>
                )}
                {review.allergens.length > 0 && (
                    <p className="tdc-meals-warning">Excluding listed recipes tagged with: {review.allergens.join(", ")}.</p>
                )}
                <label className="tdc-meals-confirm">
                    <input type="checkbox" checked={allergiesReviewed} disabled={!selectedLearner}
                        onChange={event => setAllergiesReviewed(event.target.checked)} />
                    I checked the saved allergy information with the learner's verified records before viewing meal ideas.
                </label>
                <p className="tdc-meals-muted">This check is not a guarantee of safety. Verify all ingredients, substitutions and cross-contact before preparing or serving food.</p>
            </div>

            <div className="tdc-meals-panel">
                <h2>4. General meal ideas</h2>
                <label className="tdc-meals-focus">Show examples emphasizing
                    <select value={focus} onChange={event => setFocus(event.target.value as MealFocus)}>
                        <option value="balanced">Variety of food groups</option>
                        <option value="protein">Protein-containing dishes</option>
                        <option value="vegetables">Vegetable-containing dishes</option>
                    </select>
                </label>
                {!selectedLearner || !latest ? (
                    <p className="tdc-meals-muted">Select a learner with a saved health record to view meal examples.</p>
                ) : allergyIncomplete ? (
                    <p className="tdc-meals-error">Meal ideas are paused until allergy details are saved in Learner Management.</p>
                ) : !allergiesReviewed ? (
                    <p className="tdc-meals-muted">Review food allergies and check the confirmation box above to continue.</p>
                ) : review.unsupported.length > 0 ? (
                    <p className="tdc-meals-error">Meal ideas are paused because one or more allergy terms could not be checked.</p>
                ) : mealIdeas.length === 0 ? (
                    <p className="tdc-meals-warning">No example recipes match this selection. Consult the school nutrition professional.</p>
                ) : (
                    <div className="tdc-meals-cards">
                        {mealIdeas.map(meal => (
                            <article className="tdc-meals-card" key={meal.id}>
                                <h3>{meal.title}</h3>
                                <p>{meal.description}</p>
                                <p><strong>Listed ingredients:</strong> {meal.ingredients.join(", ")}.</p>
                                <p><strong>Tagged major allergens:</strong> {meal.allergens.length ? meal.allergens.join(", ") : "None in this example ingredient list"}.</p>
                                <small>Verify the actual recipe and preparation. Not guaranteed allergen-free.</small>
                            </article>
                        ))}
                    </div>
                )}
                <p className="tdc-meals-disclaimer">
                    These are general food examples, not individual meal prescriptions. Health measurements do not automatically determine a child's dietary needs.
                    For medical conditions, growth concerns, or food allergies, consult the school's qualified health or nutrition professional.
                </p>
            </div>
        </section>
    );
}

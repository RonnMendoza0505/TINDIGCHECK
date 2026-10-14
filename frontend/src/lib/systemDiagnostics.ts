import { supabase } from "./supabase";
import type { UserProfile } from "../types";

/**
 * TINDIGCHECK! Phase 12 — Super Admin-only, READ-ONLY data quality checks.
 *
 * Supabase RLS must independently restrict table access. This client-side
 * role check is not a substitute for Phase 8 database policies.
 * No learner names, allergy values, or health values are returned to the UI.
 */

type RawLearner = {
    id: string | number;
    student_id: string | null;
    grade: number | null;
    section: string | null;
    sex: string | null;
    date_of_birth: string | null;
    has_food_allergy: boolean | null;
    allergies: string | null;
};

type RawHealthRecord = {
    id: string | number;
    learner_id: string | number | null;
    recorded_at: string | null;
    weight: number | string | null;
    height: number | string | null;
    heart_rate: number | null;
    spo2: number | null;
    bmi: number | string | null;
    bmi_status: string | null;
};

export type DiagnosticLevel = "attention" | "review" | "info";
export type DiagnosticFinding = {
    id: string;
    label: string;
    description: string;
    count: number;
    level: DiagnosticLevel;
    sampleIds: string[];
    recordType: "learner" | "health_record";
};

export type DiagnosticsSnapshot = {
    checkedAt: string;
    learnerCount: number;
    healthRecordCount: number;
    findings: DiagnosticFinding[];
};

const PAGE_SIZE = 500;
const MAX_PAGES = 200; // Stop instead of silently returning partial results.
const SAMPLE_LIMIT = 5;

async function fetchAllRows<T>(
    table: "learners" | "health_records",
    columns: string
): Promise<T[]> {
    const all: T[] = [];
    for (let page = 0; page < MAX_PAGES; page++) {
        const start = page * PAGE_SIZE;
        const { data, error } = await supabase
            .from(table)
            .select(columns)
            .order("id", { ascending: true })
            .range(start, start + PAGE_SIZE - 1);

        if (error) throw new Error(`${table}: ${error.message}`);
        const batch = (data ?? []) as T[];
        all.push(...batch);
        if (batch.length < PAGE_SIZE) return all;
    }
    throw new Error(`Too many ${table} rows for this browser check. No partial results were displayed.`);
}

function asNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function validBirthDate(value: string | null): boolean {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const date = new Date(`${value}T00:00:00.000Z`);
    if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== value) return false;
    return date.getTime() <= Date.now();
}

function createFinding(
    id: string, label: string, description: string,
    level: DiagnosticLevel, recordType: DiagnosticFinding["recordType"]
): DiagnosticFinding {
    return { id, label, description, count: 0, level, sampleIds: [], recordType };
}

function flag(finding: DiagnosticFinding, recordId: string): void {
    finding.count++;
    if (finding.sampleIds.length < SAMPLE_LIMIT) finding.sampleIds.push(recordId);
}

/** Pure evaluation helper, also suitable for local smoke testing. */
export function evaluateDataQuality(
    learners: RawLearner[], healthRecords: RawHealthRecord[]
): DiagnosticsSnapshot {
    const findings: DiagnosticFinding[] = [
        createFinding("birth-date", "Missing or invalid date of birth",
            "BMI-for-age screening needs an accurate birth date. Verify the learner profile.",
            "review", "learner"),
        createFinding("allergy-unspecified", "Allergy checked, but allergens missing",
            "The food-allergy checkbox is on, but no specific food allergens are recorded. Review before offering meal examples.",
            "attention", "learner"),
        createFinding("allergy-inconsistent", "Allergens entered, but checkbox is off",
            "The learner has allergy text but the food-allergy checkbox is off. Verify both fields.",
            "attention", "learner"),
        createFinding("learner-id", "Missing or duplicate Learner ID",
            "A Learner ID is blank or is repeated when compared without case and surrounding spaces.",
            "attention", "learner"),
        createFinding("grade-section", "Grade or Section needs review",
            "The Grade is outside 1–6 or the Section is blank.",
            "review", "learner"),
        createFinding("sex", "Sex entry needs review",
            "BMI-for-age reference calculations expect Male or Female in the existing system.",
            "review", "learner"),
        createFinding("orphan", "Health record has no matching learner",
            "A measurement refers to a learner database ID not present in the accessible learner list.",
            "attention", "health_record"),
        createFinding("invalid-measurement", "Invalid numeric measurement",
            "A recorded Weight, Height, or Heart Rate is nonpositive, or SpO₂ falls outside 0–100. This checks data validity, not clinical normality.",
            "attention", "health_record"),
        createFinding("bmi-missing", "BMI value missing",
            "Weight and Height are present and positive, but BMI has not been saved.",
            "review", "health_record"),
        createFinding("bmi-mismatch", "BMI calculation needs review",
            "Saved BMI differs from Weight ÷ (Height in metres)² by more than 0.20. Verify measurement units and rounding.",
            "review", "health_record"),
        createFinding("bmi-unassessed", "BMI status not assessed",
            "A numerical BMI exists but status is blank or Not assessed. This can be appropriate when age or reference data is unavailable.",
            "info", "health_record"),
        createFinding("record-date", "Missing measurement date",
            "A health record does not have a valid recorded_at timestamp.",
            "review", "health_record")
    ];
    const byId = Object.fromEntries(findings.map(item => [item.id, item]));
    const knownLearnerIds = new Set(learners.map(row => String(row.id)));
    const seenStudentIds = new Map<string, string>();

    for (const learner of learners) {
        const id = String(learner.id);
        if (!validBirthDate(learner.date_of_birth)) flag(byId["birth-date"], id);
        const allergies = String(learner.allergies ?? "").trim();
        if (learner.has_food_allergy === true && !allergies) flag(byId["allergy-unspecified"], id);
        if (learner.has_food_allergy !== true && allergies) flag(byId["allergy-inconsistent"], id);

        const studentId = String(learner.student_id ?? "").trim().toLowerCase();
        if (!studentId || seenStudentIds.has(studentId)) flag(byId["learner-id"], id);
        if (studentId && !seenStudentIds.has(studentId)) seenStudentIds.set(studentId, id);

        const grade = asNumber(learner.grade);
        if (!Number.isInteger(grade) || grade === null || grade < 1 || grade > 6 || !String(learner.section ?? "").trim()) {
            flag(byId["grade-section"], id);
        }
        if (!["male", "female"].includes(String(learner.sex ?? "").trim().toLowerCase())) {
            flag(byId["sex"], id);
        }
    }

    for (const record of healthRecords) {
        const id = String(record.id);
        if (record.learner_id === null || !knownLearnerIds.has(String(record.learner_id))) flag(byId.orphan, id);
        const weight = asNumber(record.weight);
        const height = asNumber(record.height);
        const heartRate = asNumber(record.heart_rate);
        const spo2 = asNumber(record.spo2);
        const bmi = asNumber(record.bmi);

        if ((weight !== null && weight <= 0) || (height !== null && height <= 0) ||
            (heartRate !== null && heartRate <= 0) || (spo2 !== null && (spo2 < 0 || spo2 > 100))) {
            flag(byId["invalid-measurement"], id);
        }
        if (weight !== null && weight > 0 && height !== null && height > 0) {
            const expectedBmi = weight / ((height / 100) ** 2);
            if (bmi === null) flag(byId["bmi-missing"], id);
            else if (bmi > 0 && Math.abs(expectedBmi - bmi) > 0.20) flag(byId["bmi-mismatch"], id);
        }
        if (bmi !== null && bmi > 0 && ["", "not assessed"].includes(String(record.bmi_status ?? "").trim().toLowerCase())) {
            flag(byId["bmi-unassessed"], id);
        }
        if (!record.recorded_at || Number.isNaN(Date.parse(record.recorded_at))) flag(byId["record-date"], id);
    }

    return {
        checkedAt: new Date().toISOString(),
        learnerCount: learners.length,
        healthRecordCount: healthRecords.length,
        findings
    };
}

export async function fetchSystemDiagnostics(user: UserProfile): Promise<DiagnosticsSnapshot> {
    if (user.role !== "Super Admin") throw new Error("System Diagnostics is restricted to Super Admin.");
    const [learners, records] = await Promise.all([
        fetchAllRows<RawLearner>("learners", "id,student_id,grade,section,sex,date_of_birth,has_food_allergy,allergies"),
        fetchAllRows<RawHealthRecord>("health_records", "id,learner_id,recorded_at,weight,height,heart_rate,spo2,bmi,bmi_status")
    ]);
    return evaluateDataQuality(learners, records);
}

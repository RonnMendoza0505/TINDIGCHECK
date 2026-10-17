import { supabase } from "../../lib/supabase";
import type { UserProfile } from "../../types";

/**
 * TINDIGCHECK! Phase 9 — read-only dashboard statistics.
 *
 * The Supabase session (and Phase 8 RLS) determines which rows can be read.
 * Viewers are ALSO filtered to their assigned Grade/Section on the client.
 * Client-side filtering is defense-in-depth, NOT a replacement for RLS.
 *
 * Counts are records, not unique learners or clinical diagnoses.
 */
export type DashboardLearner = {
    id: string;
    student_id: string;
    first_name: string;
    last_name: string;
    grade: number;
    section: string;
    sex: string;
    has_food_allergy: boolean;
    date_of_birth: string | null;
};

export type DashboardHealthRecord = {
    id: string;
    learner_id: string;
    recorded_at: string | null;
    weight: number | null;
    height: number | null;
    heart_rate: number | null;
    spo2: number | null;
    bmi: number | null;
    bmi_status: string;
};

export type DashboardSnapshot = {
    learnerCount: number;
    gradeCounts: { grade: number; count: number }[];
    knownAllergyCount: number;
    missingBirthDateCount: number;
    healthRecordCount: number;
    recordsLast7Days: number;
    recordsLast30Days: number;
    latestRecords: DashboardHealthRecord[];
    learnersById: Record<string, DashboardLearner>;
    updatedAt: string;
};

const LEARNER_COLUMNS =
    "id, student_id, first_name, last_name, grade, section, sex, has_food_allergy, date_of_birth";
const RECORD_COLUMNS =
    "id, learner_id, recorded_at, weight, height, heart_rate, spo2, bmi, bmi_status";
const LEARNER_PAGE_SIZE = 250;
const LEARNER_PAGE_SAFETY_LIMIT = 200; // Fail rather than silently show incomplete statistics.
const RECORD_CHUNK_SIZE = 50; // Avoid oversized URLs for Viewer-specific filters.
const LATEST_COUNT = 8;

function numberOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const result = Number(value);
    return Number.isFinite(result) ? result : null;
}

function parseLearner(row: Record<string, unknown>): DashboardLearner {
    return {
        id: String(row.id),
        student_id: String(row.student_id ?? ""),
        first_name: String(row.first_name ?? ""),
        last_name: String(row.last_name ?? ""),
        grade: Number(row.grade),
        section: String(row.section ?? ""),
        sex: String(row.sex ?? ""),
        has_food_allergy: row.has_food_allergy === true,
        date_of_birth: row.date_of_birth == null ? null : String(row.date_of_birth)
    };
}

function parseHealthRecord(row: Record<string, unknown>): DashboardHealthRecord {
    return {
        id: String(row.id),
        learner_id: String(row.learner_id),
        recorded_at: row.recorded_at == null ? null : String(row.recorded_at),
        weight: numberOrNull(row.weight),
        height: numberOrNull(row.height),
        heart_rate: numberOrNull(row.heart_rate),
        spo2: numberOrNull(row.spo2),
        bmi: numberOrNull(row.bmi),
        bmi_status: String(row.bmi_status ?? "Not assessed")
    };
}

function compareNewestFirst(a: DashboardHealthRecord, b: DashboardHealthRecord): number {
    const byDate = (b.recorded_at ?? "").localeCompare(a.recorded_at ?? "");
    if (byDate !== 0) return byDate;
    // IDs are bigint in the user's schema; avoid Number() precision loss.
    const first = BigInt(a.id);
    const second = BigInt(b.id);
    return first === second ? 0 : first > second ? -1 : 1;
}

async function fetchAllAccessibleLearners(user: UserProfile): Promise<DashboardLearner[]> {
    if (user.role === "Viewer" && (!user.grade || !user.section)) {
        return [];
    }

    const learners: DashboardLearner[] = [];
    for (let page = 0; page < LEARNER_PAGE_SAFETY_LIMIT; page++) {
        const first = page * LEARNER_PAGE_SIZE;
        let query = supabase
            .from("learners")
            .select(LEARNER_COLUMNS)
            .order("id", { ascending: true })
            .range(first, first + LEARNER_PAGE_SIZE - 1);

        if (user.role === "Viewer") {
            query = query
                .eq("grade", Number(user.grade))
                .eq("section", user.section as string);
        }

        const { data, error } = await query;
        if (error) throw new Error(`Learner statistics: ${error.message}`);
        const batch = (data ?? []).map(parseLearner);
        learners.push(...batch);
        if (batch.length < LEARNER_PAGE_SIZE) return learners;
    }
    throw new Error("Too many learners to summarize safely. Please contact the administrator.");
}

async function countHealthRecords(
    learnerIds: string[] | null,
    since?: string
): Promise<number> {
    // A Viewer without assigned learners must never run an unrestricted count.
    if (learnerIds !== null && learnerIds.length === 0) return 0;

    const batches: (string[] | null)[] = learnerIds === null
        ? [null]
        : Array.from(
            { length: Math.ceil(learnerIds.length / RECORD_CHUNK_SIZE) },
            (_, i) => learnerIds.slice(i * RECORD_CHUNK_SIZE, (i + 1) * RECORD_CHUNK_SIZE)
        );

    let total = 0;
    // Keep concurrency bounded for schools with many learner records.
    for (let i = 0; i < batches.length; i += 3) {
        const counts = await Promise.all(batches.slice(i, i + 3).map(async ids => {
            let query = supabase.from("health_records")
                .select("id", { count: "exact", head: true });
            if (ids !== null) query = query.in("learner_id", ids);
            if (since) query = query.gte("recorded_at", since);
            const { count, error } = await query;
            if (error) throw new Error(`Health record statistics: ${error.message}`);
            return count ?? 0;
        }));
        total += counts.reduce((sum, count) => sum + count, 0);
    }
    return total;
}

async function fetchLatestHealthRecords(
    learnerIds: string[] | null
): Promise<DashboardHealthRecord[]> {
    if (learnerIds !== null && learnerIds.length === 0) return [];

    const batches: (string[] | null)[] = learnerIds === null
        ? [null]
        : Array.from(
            { length: Math.ceil(learnerIds.length / RECORD_CHUNK_SIZE) },
            (_, i) => learnerIds.slice(i * RECORD_CHUNK_SIZE, (i + 1) * RECORD_CHUNK_SIZE)
        );

    const records: DashboardHealthRecord[] = [];
    for (let i = 0; i < batches.length; i += 3) {
        const pages = await Promise.all(batches.slice(i, i + 3).map(async ids => {
            let query = supabase.from("health_records")
                .select(RECORD_COLUMNS)
                .order("recorded_at", { ascending: false, nullsFirst: false })
                .order("id", { ascending: false })
                .limit(LATEST_COUNT);
            if (ids !== null) query = query.in("learner_id", ids);
            const { data, error } = await query;
            if (error) throw new Error(`Recent health records: ${error.message}`);
            return (data ?? []).map(parseHealthRecord);
        }));
        pages.forEach(page => records.push(...page));
    }
    return records.sort(compareNewestFirst).slice(0, LATEST_COUNT);
}

export async function fetchDashboardSnapshot(user: UserProfile): Promise<DashboardSnapshot> {
    const learners = await fetchAllAccessibleLearners(user);
    const learnersById: Record<string, DashboardLearner> = Object.fromEntries(
        learners.map(learner => [learner.id, learner])
    );

    // Admins can count all records. Viewers are explicitly restricted to the
    // IDs of learners returned for their own Grade/Section, in addition to RLS.
    const recordLearnerIds = user.role === "Viewer"
        ? learners.map(learner => learner.id)
        : null;

    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 86_400_000).toISOString();
    const thirtyDaysAgo = new Date(now - 30 * 86_400_000).toISOString();

    const [healthRecordCount, recordsLast7Days, recordsLast30Days, latestRecords] =
        await Promise.all([
            countHealthRecords(recordLearnerIds),
            countHealthRecords(recordLearnerIds, sevenDaysAgo),
            countHealthRecords(recordLearnerIds, thirtyDaysAgo),
            fetchLatestHealthRecords(recordLearnerIds)
        ]);

    return {
        learnerCount: learners.length,
        gradeCounts: Array.from({ length: 6 }, (_, index) => ({
            grade: index + 1,
            count: learners.filter(learner => learner.grade === index + 1).length
        })),
        knownAllergyCount: learners.filter(learner => learner.has_food_allergy).length,
        missingBirthDateCount: learners.filter(learner => !learner.date_of_birth).length,
        healthRecordCount,
        recordsLast7Days,
        recordsLast30Days,
        latestRecords,
        learnersById,
        updatedAt: new Date().toISOString()
    };
}

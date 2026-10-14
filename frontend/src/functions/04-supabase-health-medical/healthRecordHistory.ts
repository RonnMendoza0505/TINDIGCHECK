import { supabase } from "../../lib/supabase";
import type { BmiStatus } from "../../lib/bmiStatus";
import type { Learner } from "../../lib/learners";
import type { UserProfile } from "../../types";

/*
    SYSTEM FUNCTION:
    Read-only health history data. The existing health_records table uses
    bigint IDs and the columns weight, height, heart_rate and spo2.
    We deliberately do not change the working healthRecords.ts save function.
*/
export type HistoryRecord = {
    id: string;
    learner_id: string;
    weight: number | null;
    height: number | null;
    heart_rate: number | null;
    spo2: number | null;
    bmi: number | null;
    bmi_status: BmiStatus;
    recorded_at: string | null;
};

const COLUMNS = "id, learner_id, weight, height, heart_rate, spo2, bmi, bmi_status, recorded_at";
export const HISTORY_PAGE_SIZE = 25;
export const RECENT_RECORDS_LIMIT = 100;

function numericOrNull(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const converted = Number(value);
    return Number.isFinite(converted) ? converted : null;
}

function toHistoryRecord(row: Record<string, unknown>): HistoryRecord {
    return {
        id: String(row.id),
        learner_id: String(row.learner_id),
        weight: numericOrNull(row.weight),
        height: numericOrNull(row.height),
        heart_rate: numericOrNull(row.heart_rate),
        spo2: numericOrNull(row.spo2),
        bmi: numericOrNull(row.bmi),
        bmi_status: (row.bmi_status as BmiStatus | null) ?? "Not assessed",
        recorded_at: row.recorded_at == null ? null : String(row.recorded_at)
    };
}

function sortNewestFirst(a: HistoryRecord, b: HistoryRecord): number {
    const byDate = (b.recorded_at ?? "").localeCompare(a.recorded_at ?? "");
    if (byDate !== 0) return byDate;
    // bigint IDs may be larger than Number.MAX_SAFE_INTEGER.
    const left = BigInt(a.id);
    const right = BigInt(b.id);
    return left === right ? 0 : left > right ? -1 : 1;
}

/*
    SYSTEM FUNCTION:
    Admins get up to 100 newest records across learners.
    Viewers request only the two newest records per accessible learner.
    The frontend is NOT a security boundary; Supabase RLS must independently
    restrict viewer Grade/Section and historical record access.
*/
export async function fetchRecentRecordsAcrossLearners(
    user: UserProfile,
    accessibleLearners: Learner[]
): Promise<HistoryRecord[]> {
    if (accessibleLearners.length === 0) return [];

    const permittedIds = new Set(accessibleLearners.map(learner => learner.id));

    if (user.role !== "Viewer") {
        const { data, error } = await supabase
            .from("health_records")
            .select(COLUMNS)
            .order("recorded_at", { ascending: false, nullsFirst: false })
            .order("id", { ascending: false })
            .limit(RECENT_RECORDS_LIMIT);

        if (error) throw new Error(`[${error.code}] ${error.message}`);
        return (data ?? []).map(toHistoryRecord)
            .filter(record => permittedIds.has(record.learner_id));
    }

    const collected: HistoryRecord[] = [];
    // Keep requests bounded rather than starting dozens of requests at once.
    for (let index = 0; index < accessibleLearners.length; index += 5) {
        const batch = accessibleLearners.slice(index, index + 5);
        const results = await Promise.all(batch.map(async learner => {
            const { data, error } = await supabase
                .from("health_records")
                .select(COLUMNS)
                .eq("learner_id", learner.id)
                .order("recorded_at", { ascending: false, nullsFirst: false })
                .order("id", { ascending: false })
                .limit(2);
            if (error) throw new Error(`[${error.code}] ${error.message}`);
            return (data ?? []).map(toHistoryRecord);
        }));
        results.forEach(records => collected.push(...records));
    }
    return collected.sort(sortNewestFirst).slice(0, RECENT_RECORDS_LIMIT);
}

/*
    SYSTEM FUNCTION:
    Loads one learner's history. Admins can page through the full history;
    Viewers are capped at two records and never receive pagination.
    RLS must enforce these limits independently of the client.
*/
export async function fetchLearnerHistoryPage(
    user: UserProfile,
    learnerId: string,
    page: number
): Promise<{ records: HistoryRecord[]; hasMore: boolean }> {
    const viewer = user.role === "Viewer";
    const offset = viewer ? 0 : Math.max(0, page) * HISTORY_PAGE_SIZE;
    const count = viewer ? 2 : HISTORY_PAGE_SIZE + 1;

    const { data, error } = await supabase
        .from("health_records")
        .select(COLUMNS)
        .eq("learner_id", learnerId)
        .order("recorded_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .range(offset, offset + count - 1);

    if (error) throw new Error(`[${error.code}] ${error.message}`);
    const rows = (data ?? []).map(toHistoryRecord);
    return {
        records: viewer ? rows.slice(0, 2) : rows.slice(0, HISTORY_PAGE_SIZE),
        hasMore: !viewer && rows.length > HISTORY_PAGE_SIZE
    };
}

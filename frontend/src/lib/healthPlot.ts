import { supabase } from "./supabase";
import type { Learner } from "./learners";
import type { HistoryRecord } from "./healthRecordHistory";
import type { UserProfile } from "../types";

/*
    PHASE 7 — HEALTH PLOT DATA
    Uses the existing health_records table. This is read-only.
    Database column names are weight, height, heart_rate, spo2, bmi,
    bmi_status and recorded_at. No migration is needed.
*/
export type PlotPeriod = "30" | "90" | "365" | "all";

export type PlotHistoryResult = {
    records: HistoryRecord[];
    truncated: boolean;
};

export const MAX_PLOT_RECORDS = 500;

const COLUMNS =
    "id, learner_id, weight, height, heart_rate, spo2, bmi, bmi_status, recorded_at";

function optionalNumber(value: unknown): number | null {
    if (value === null || value === undefined || value === "") return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
}

function parseRecord(row: Record<string, unknown>): HistoryRecord {
    return {
        id: String(row.id),
        learner_id: String(row.learner_id),
        weight: optionalNumber(row.weight),
        height: optionalNumber(row.height),
        heart_rate: optionalNumber(row.heart_rate),
        spo2: optionalNumber(row.spo2),
        bmi: optionalNumber(row.bmi),
        bmi_status: row.bmi_status == null
            ? "Not assessed"
            : String(row.bmi_status) as HistoryRecord["bmi_status"],
        recorded_at: row.recorded_at == null ? null : String(row.recorded_at)
    };
}

function withinPeriod(record: HistoryRecord, period: PlotPeriod): boolean {
    if (period === "all") return true;
    if (!record.recorded_at) return false;
    const date = new Date(record.recorded_at).getTime();
    return Number.isFinite(date) && date >= Date.now() - Number(period) * 86_400_000;
}

/**
 * Fetch a single learner's measurement history for charts.
 *
 * Viewer safety: select the TWO most recent records OVERALL first, then apply
 * the date filter locally. Filtering in SQL first could reveal older records
 * outside the permitted newest two when no recent record exists.
 *
 * This frontend limit is NOT a security boundary. Supabase RLS or a secure
 * server-side RPC must enforce Viewer grade/section and history access.
 */
export async function fetchHealthPlotRecords(
    user: UserProfile,
    learnerId: string,
    accessibleLearners: Learner[],
    period: PlotPeriod
): Promise<PlotHistoryResult> {
    const learner = accessibleLearners.find(item => item.id === learnerId);
    if (!learner) throw new Error("This learner is not in your accessible learner list.");

    const viewer = user.role === "Viewer";
    if (viewer && (
        !user.grade || !user.section ||
        Number(user.grade) !== learner.grade || user.section !== learner.section
    )) {
        throw new Error("This learner is outside your assigned Grade and Section.");
    }

    let query = supabase
        .from("health_records")
        .select(COLUMNS)
        .eq("learner_id", learnerId)
        .order("recorded_at", { ascending: false, nullsFirst: false })
        .order("id", { ascending: false })
        .limit(viewer ? 2 : MAX_PLOT_RECORDS + 1);

    if (!viewer && period !== "all") {
        const cutoff = new Date(Date.now() - Number(period) * 86_400_000);
        query = query.gte("recorded_at", cutoff.toISOString());
    }

    const { data, error } = await query;
    if (error) throw new Error(`[${error.code}] ${error.message}`);

    const fetched = (data ?? []).map(parseRecord);
    const truncated = !viewer && fetched.length > MAX_PLOT_RECORDS;
    const records = fetched
        .slice(0, viewer ? 2 : MAX_PLOT_RECORDS)
        .filter(record => withinPeriod(record, period))
        .reverse();

    return { records, truncated };
}

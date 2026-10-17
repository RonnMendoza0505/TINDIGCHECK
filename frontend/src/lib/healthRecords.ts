import { supabase } from "./supabase";
import { classifyBmiForAge, type BmiStatus } from "./bmiStatus";

/*
    SYSTEM FUNCTION:
    Keeps the field names expected by the Health Monitoring TSX page.
    The database uses weight, height, heart_rate and spo2 instead.
*/
export type HealthRecord = {
    id: string;
    learner_id: string;
    weight_kg: number;
    height_cm: number;
    heart_rate_bpm: number;
    spo2_percent: number;
    bmi: number;
    bmi_status: BmiStatus;
    recorded_at: string;
};

export type HealthRecordInput = Pick<
    HealthRecord,
    "learner_id" | "weight_kg" | "height_cm" | "heart_rate_bpm" | "spo2_percent"
>;

/*
    SYSTEM FUNCTION:
    Selects the real column names from the existing Supabase table.
*/
const HEALTH_RECORD_COLUMNS =
    "id, learner_id, weight, height, heart_rate, spo2, bmi, bmi_status, recorded_at";

/*
    SYSTEM FUNCTION:
    Retrieves up to 10 recent measurements for the selected learner.
    Supabase RLS must independently enforce account access.
*/
export async function fetchRecentHealthRecords(
    learnerId: string
): Promise<HealthRecord[]> {
    const { data, error } = await supabase
        .from("health_records")
        .select(HEALTH_RECORD_COLUMNS)
        .eq("learner_id", learnerId)
        .order("recorded_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(10);

    if (error) {
        console.error("HEALTH RECORD FETCH ERROR:", error);
        throw new Error(`[${error.code}] ${error.message}`);
    }

    return (data ?? []).map(toHealthRecord);
}

/*
    SYSTEM FUNCTION:
    Converts the four TSX measurements to the existing database columns.
    BMI is calculated because the existing BMI column is not generated.
    PostgreSQL supplies recorded_at using its now() default.
*/
// Member 4: health data upload and record correction live in healthUploads.ts.
export { saveHealthRecord, removeTodayHealthRecord } from "./healthUploads";

/*
    SYSTEM FUNCTION:
    Converts Supabase bigint IDs and numeric values into TSX-friendly data.
*/
export function toHealthRecord(row: Record<string, unknown>): HealthRecord {
    const weight = Number(row.weight);
    const height = Number(row.height);
    const bmi = row.bmi == null
        ? (height > 0 ? Math.round((weight / ((height / 100) ** 2)) * 100) / 100 : 0)
        : Number(row.bmi);

    return {
        id: String(row.id),
        learner_id: String(row.learner_id),
        weight_kg: weight,
        height_cm: height,
        heart_rate_bpm: Number(row.heart_rate),
        spo2_percent: Number(row.spo2),
        bmi,
        bmi_status: (row.bmi_status as BmiStatus | null) ?? "Not assessed",
        recorded_at: String(row.recorded_at)
    };
}

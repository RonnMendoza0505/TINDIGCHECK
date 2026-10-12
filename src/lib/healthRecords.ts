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
export async function saveHealthRecord(
    input: HealthRecordInput
): Promise<HealthRecord> {
    const weight = Number(input.weight_kg);
    const height = Number(input.height_cm);
    const heartRate = Number(input.heart_rate_bpm);
    const spo2 = Number(input.spo2_percent);

    if (
        !Number.isFinite(weight) || weight < 0.1 || weight > 300 ||
        !Number.isFinite(height) || height < 30 || height > 250 ||
        !Number.isInteger(heartRate) || heartRate < 1 || heartRate > 300 ||
        !Number.isInteger(spo2) || spo2 < 0 || spo2 > 100
    ) {
        throw new Error("Invalid health measurements. Review all four fields.");
    }

    const bmi = Math.round(
        (weight / ((height / 100) ** 2)) * 100
    ) / 100;

    // Read learner metadata from Supabase rather than trusting form input.
    const { data: learner, error: learnerError } = await supabase
        .from("learners")
        .select("sex, date_of_birth")
        .eq("id", input.learner_id)
        .single();

    if (learnerError || !learner) {
        throw new Error("Unable to verify learner details for BMI status.");
    }

    const bmiStatus = classifyBmiForAge({
        bmi,
        sex: String(learner.sex),
        dateOfBirth: learner.date_of_birth == null ? null : String(learner.date_of_birth),
        measurementDate: new Date()
    });

    const { data, error } = await supabase
        .from("health_records")
        .insert({
            learner_id: input.learner_id,
            weight,
            height,
            heart_rate: heartRate,
            spo2,
            bmi,
            bmi_status: bmiStatus
        })
        .select(HEALTH_RECORD_COLUMNS)
        .single();

    if (error) {
        console.error("HEALTH RECORD SAVE ERROR:", {
            code: error.code,
            message: error.message,
            details: error.details,
            hint: error.hint
        });
        throw new Error(`[${error.code}] ${error.message}`);
    }

    if (!data) {
        throw new Error("Supabase did not return the saved health record.");
    }

    return toHealthRecord(data);
}

/*
    SYSTEM FUNCTION:
    Deletes a record selected for same-day correction.
    The TSX page limits the button to today; Supabase RLS must also
    enforce the same-day restriction at database level.
*/
export async function removeTodayHealthRecord(
    recordId: string
): Promise<void> {
    const { data, error } = await supabase
        .from("health_records")
        .delete()
        .eq("id", recordId)
        .select("id")
        .maybeSingle();

    if (error) {
        console.error("HEALTH RECORD DELETE ERROR:", error);
        throw new Error(`[${error.code}] ${error.message}`);
    }

    if (!data) {
        throw new Error(
            "Record not removed. Check your account permissions and same-day deletion policy."
        );
    }
}

/*
    SYSTEM FUNCTION:
    Converts Supabase bigint IDs and numeric values into TSX-friendly data.
*/
function toHealthRecord(row: Record<string, unknown>): HealthRecord {
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

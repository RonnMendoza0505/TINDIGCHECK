/** Member 4 — saves health monitoring data to Supabase.
 * Member 2 owns the form controls; Supabase RLS controls access. */
import { supabase } from "./supabase";
import { classifyBmiForAge } from "./bmiStatus";
import { toHealthRecord, type HealthRecord, type HealthRecordInput } from "./healthRecords";
const HEALTH_RECORD_COLUMNS = "id, learner_id, weight, height, heart_rate, spo2, bmi, bmi_status, recorded_at";

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


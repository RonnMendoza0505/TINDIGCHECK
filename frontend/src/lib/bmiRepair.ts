import { supabase } from "./supabase";
import { cdcReferenceReady, getBmiAssessment } from "./bmiStatus";

type Row = {
    id: number | string;
    learner_id: number | string;
    weight: number | string | null;
    height: number | string | null;
    bmi: number | string | null;
    bmi_status: string | null;
    recorded_at: string | null;
};

/**
 * Explicit, staff-only repair of existing BMI statuses for ONE selected learner.
 * Reuses the measurement date (not today's date) and learner DOB/sex.
 * RLS must independently authorize UPDATE on health_records.
 * Does not change weight, height, BMI number or any learner details.
 */
export async function reassessLearnerBmiStatuses(learnerId: string): Promise<{
    checked: number;
    updated: number;
    skipped: number;
}> {
    if (!cdcReferenceReady) {
        throw new Error("CDC BMI reference is missing. Run node scripts/download-cdc-bmi.mjs, then restart Vite.");
    }
    const { data: learner, error: learnerError } = await supabase
        .from("learners")
        .select("id, sex, date_of_birth")
        .eq("id", learnerId)
        .single();
    if (learnerError || !learner) {
        throw new Error(learnerError?.message || "Learner was not found.");
    }
    if (!learner.date_of_birth) {
        throw new Error("This learner has no Date of Birth. Add it in Learner Management first.");
    }
    const sex = String(learner.sex ?? "");
    const dateOfBirth = String(learner.date_of_birth);
    let checked = 0;
    let updated = 0;
    let skipped = 0;
    const pageSize = 300;
    let offset = 0;

    while (true) {
        const { data, error } = await supabase
            .from("health_records")
            .select("id,learner_id,weight,height,bmi,bmi_status,recorded_at")
            .eq("learner_id", learnerId)
            .order("id", { ascending: true })
            .range(offset, offset + pageSize - 1);
        if (error) throw new Error(`Could not read health records: ${error.message}`);
        const rows = (data ?? []) as Row[];
        if (!rows.length) break;

        for (const row of rows) {
            checked++;
            const weight = Number(row.weight);
            const height = Number(row.height);
            const bmi = row.bmi == null
                ? (weight > 0 && height > 0 ? weight / ((height / 100) ** 2) : NaN)
                : Number(row.bmi);
            const measurementDate = row.recorded_at ? new Date(row.recorded_at) : new Date(NaN);
            const result = getBmiAssessment({ bmi, sex, dateOfBirth, measurementDate });
            if (result.status === "Not assessed") {
                skipped++;
                continue;
            }
            if (row.bmi_status === result.status) continue;
            const { data: changed, error: updateError } = await supabase
                .from("health_records")
                .update({ bmi_status: result.status })
                .eq("id", String(row.id))
                .eq("learner_id", learnerId)
                .select("id")
                .maybeSingle();
            if (updateError) {
                throw new Error(`Could not update record ${row.id}: ${updateError.message}`);
            }
            if (!changed) {
                throw new Error(`Record ${row.id} was not updated. Check Admin RLS permissions.`);
            }
            updated++;
        }
        if (rows.length < pageSize) break;
        offset += rows.length;
    }
    return { checked, updated, skipped };
}

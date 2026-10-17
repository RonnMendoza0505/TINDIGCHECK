/** Member 3: Read Supabase learner records and export filtered Excel reports.
 * Supabase Row Level Security must enforce authorized data access.
 */
import ExcelJS from "exceljs";
import { supabase } from "./supabase";
import type { UserProfile } from "../types";
import { HEALTH_COLUMNS, PAGE_SIZE, assertAdministrator, chunk, isoToday,
    styleSheet, safeSheetName, addReadme, addLearnerSheet, saveWorkbook } from "./learnerTransferShared";
import type { ExportFilters, ExportLearner, ExportHealth } from "./learnerTransferShared";
export type { ExportFilters } from "./learnerTransferShared";
const HEALTH_EXPORT_LIMIT = 50000;

async function loadExportLearners(filters: ExportFilters): Promise<ExportLearner[]> {
    const collected: ExportLearner[] = [];
    for (let offset = 0; ; offset += PAGE_SIZE) {
        let query = supabase.from("learners")
            .select("id, student_id, last_name, first_name, middle_name, age, sex, grade, section, date_of_birth, has_food_allergy, allergies")
            .order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
        if (filters.grade !== "All") query = query.eq("grade", Number(filters.grade));
        if (filters.section !== "All") query = query.eq("section", filters.section);
        const { data, error } = await query;
        if (error) throw new Error(`Unable to export learners: ${error.message}`);
        for (const item of data ?? []) {
            collected.push({
                id: String(item.id), student_id: String(item.student_id ?? ""),
                last_name: String(item.last_name ?? ""), first_name: String(item.first_name ?? ""),
                middle_name: item.middle_name == null ? null : String(item.middle_name),
                age: Number(item.age), sex: String(item.sex ?? ""), grade: Number(item.grade),
                section: String(item.section ?? ""), date_of_birth: item.date_of_birth == null ? null : String(item.date_of_birth),
                has_food_allergy: item.has_food_allergy === true, allergies: String(item.allergies ?? "")
            });
        }
        if ((data ?? []).length < PAGE_SIZE) break;
    }
    return collected;
}

async function loadExportHealth(learners: ExportLearner[]): Promise<ExportHealth[]> {
    const records: ExportHealth[] = [];
    for (const ids of chunk(learners.map(item => item.id), 40)) {
        for (let offset = 0; ; offset += PAGE_SIZE) {
            const { data, error } = await supabase.from("health_records")
                .select("learner_id, weight, height, heart_rate, spo2, bmi, bmi_status, recorded_at")
                .in("learner_id", ids).order("recorded_at", { ascending: false })
                .order("learner_id", { ascending: true })
                .order("id", { ascending: true }).range(offset, offset + PAGE_SIZE - 1);
            if (error) throw new Error(`Unable to export health records: ${error.message}`);
            for (const item of data ?? []) records.push({
                learner_id: String(item.learner_id),
                weight: item.weight == null ? null : Number(item.weight),
                height: item.height == null ? null : Number(item.height),
                heart_rate: item.heart_rate == null ? null : Number(item.heart_rate),
                spo2: item.spo2 == null ? null : Number(item.spo2),
                bmi: item.bmi == null ? null : Number(item.bmi),
                bmi_status: item.bmi_status == null ? null : String(item.bmi_status),
                recorded_at: item.recorded_at == null ? null : String(item.recorded_at)
            });
            if (records.length > HEALTH_EXPORT_LIMIT) {
                throw new Error("Export exceeds 50,000 health records. Narrow the Grade/Section filter.");
            }
            if ((data ?? []).length < PAGE_SIZE) break;
        }
    }
    return records;
}

/** One import-ready worksheet, plus separate learner/health sheets by Grade+Section. */
export async function exportLearnerWorkbook(user: UserProfile, filters: ExportFilters): Promise<{ learners: number; healthRecords: number }> {
    assertAdministrator(user);
    const learners = await loadExportLearners(filters);
    if (!learners.length) throw new Error("No learners match the selected Grade and Section.");
    const health = filters.includeHealth ? await loadExportHealth(learners) : [];
    const book = new ExcelJS.Workbook();
    book.creator = "TINDIGCHECK! 2.0";
    addReadme(book, [
        `Exported on ${isoToday()}; Grade: ${filters.grade}; Section: ${filters.section}`,
        `Learners: ${learners.length}; health records: ${health.length}`,
        "Learners_Import is a combined, import-ready copy of the learner fields.",
        "Each Grade/Section has its own learner worksheet; health worksheets are separate.",
        "Import creates NEW learner profiles only. It does not restore health history or Cloudinary photographs.",
        "This file contains sensitive learner information. Do not share it publicly."
    ]);
    addLearnerSheet(book, "Learners_Import", learners);
    const used = new Set(["instructions", "learners_import"]);
    const grouped = new Map<string, ExportLearner[]>();
    for (const learner of learners) {
        const key = `${learner.grade}\u0000${learner.section}`;
        const group = grouped.get(key) ?? [];
        group.push(learner);
        grouped.set(key, group);
    }
    const byLearnerId = new Map(learners.map(learner => [learner.id, learner]));
    for (const [key, members] of [...grouped].sort(([a], [b]) => a.localeCompare(b))) {
        const [grade, section] = key.split("\u0000");
        const sorted = [...members].sort((a, b) =>
            a.last_name.localeCompare(b.last_name) || a.first_name.localeCompare(b.first_name));
        addLearnerSheet(book, safeSheetName(`G${grade} ${section}`, used), sorted);
        if (filters.includeHealth) {
            const healthSheet = book.addWorksheet(safeSheetName(`Health G${grade} ${section}`, used));
            styleSheet(healthSheet, HEALTH_COLUMNS);
            const memberIds = new Set(members.map(member => member.id));
            for (const record of health) {
                if (!memberIds.has(record.learner_id)) continue;
                const learner = byLearnerId.get(record.learner_id);
                if (!learner) continue;
                healthSheet.addRow({
                    student_id: learner.student_id,
                    learner_name: `${learner.last_name}, ${learner.first_name}`,
                    grade: learner.grade, section: learner.section,
                    recorded_at: record.recorded_at ?? "",
                    weight_kg: record.weight, height_cm: record.height,
                    heart_rate_bpm: record.heart_rate, spo2_percent: record.spo2,
                    bmi: record.bmi, bmi_status: record.bmi_status ?? "Not assessed"
                });
            }
        }
    }
    const label = `G${filters.grade}_S${filters.section}`.replace(/[^a-zA-Z0-9_-]/g, "-");
    await saveWorkbook(book, `TINDIGCHECK_${label}_${isoToday()}.xlsx`);
    return { learners: learners.length, healthRecords: health.length };
}

/** Parse, validate, and check existing IDs without changing the database. */

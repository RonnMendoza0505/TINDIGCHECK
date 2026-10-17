import ExcelJS from "exceljs";
import { supabase } from "../../lib/supabase";
import type { LearnerInput } from "../../lib/learners";
import type { SchoolSection } from "../../lib/sections";
import type { UserProfile } from "../../types";

/** Phase 6: Browser-side Excel backup and new-learner import.
 * No service-role key is used. Supabase RLS MUST enforce Admin-only access.
 * Health records are EXPORT ONLY to prevent duplicate or altered measurements.
 */

const LEARNER_COLUMNS = [
    "student_id", "last_name", "first_name", "middle_name", "age", "sex",
    "grade", "section", "date_of_birth", "has_food_allergy", "allergies"
] as const;

const HEALTH_COLUMNS = [
    "student_id", "learner_name", "grade", "section", "recorded_at",
    "weight_kg", "height_cm", "heart_rate_bpm", "spo2_percent", "bmi", "bmi_status"
] as const;

const MAX_IMPORT_BYTES = 3 * 1024 * 1024;
const MAX_IMPORT_ROWS = 1000;
const PAGE_SIZE = 500;
const HEALTH_EXPORT_LIMIT = 50000;

type ImportRow = Omit<LearnerInput, "photo_url">;

type ExportLearner = ImportRow & { id: string };

type ExportHealth = {
    learner_id: string;
    weight: number | null;
    height: number | null;
    heart_rate: number | null;
    spo2: number | null;
    bmi: number | null;
    bmi_status: string | null;
    recorded_at: string | null;
};

export type ImportPreview = {
    filename: string;
    rows: ImportRow[];
    existingIds: string[];
    issues: string[];
    totalDataRows: number;
};

export type ExportFilters = {
    grade: string;
    section: string;
    includeHealth: boolean;
};

function assertAdministrator(user: UserProfile): void {
    if (user.role !== "Super Admin" && user.role !== "Admin") {
        throw new Error("Only authorized administrators may import or export learner data.");
    }
}

function chunk<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
    return result;
}

function cleanText(value: unknown): string {
    return String(value ?? "").trim();
}

function isoToday(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function yearsOld(isoDate: string): number {
    const [year, month, day] = isoDate.split("-").map(Number);
    const today = new Date();
    let years = today.getFullYear() - year;
    if (today.getMonth() + 1 < month ||
        (today.getMonth() + 1 === month && today.getDate() < day)) years--;
    return years;
}

function validIsoDate(raw: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return false;
    const date = new Date(`${raw}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === raw &&
        date.getTime() <= Date.now();
}

function asCellText(cell: ExcelJS.Cell): string {
    const value = cell.value;
    if (value == null) return "";
    if (value instanceof Date) {
        return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, "0")}-${String(value.getUTCDate()).padStart(2, "0")}`;
    }
    if (typeof value === "object") {
        if ("formula" in value || "sharedFormula" in value) {
            throw new Error("Excel formulas are not accepted in learner imports.");
        }
        if ("richText" in value) {
            return value.richText.map(item => item.text).join("").trim();
        }
        if ("text" in value) return cleanText(value.text);
        throw new Error("Unsupported Excel cell format. Enter a plain value.");
    }
    return cleanText(value);
}

function parseFlag(raw: string): boolean | null {
    const normalized = raw.toLowerCase();
    if (["yes", "true", "1", "y"].includes(normalized)) return true;
    if (["", "no", "false", "0", "n"].includes(normalized)) return false;
    return null;
}

function sectionKey(grade: number, section: string): string {
    return `${grade}|${section.trim().replace(/^section\s+/i, "").toLowerCase()}`;
}

async function existingStudentIds(ids: string[]): Promise<Set<string>> {
    const found = new Set<string>();
    for (const group of chunk([...new Set(ids)], 80)) {
        if (!group.length) continue;
        const { data, error } = await supabase.from("learners")
            .select("student_id").in("student_id", group);
        if (error) throw new Error(`Unable to check duplicate Learner IDs: ${error.message}`);
        for (const row of data ?? []) found.add(String(row.student_id));
    }
    return found;
}

function styleSheet(sheet: ExcelJS.Worksheet, headers: readonly string[]): void {
    sheet.columns = headers.map(header => ({
        header,
        key: header,
        width: header === "allergies" ? 32 : header.includes("name") ? 22 : 19,
        style: header === "student_id" ? { numFmt: "@" } : undefined
    }));
    sheet.getRow(1).height = 25;
    sheet.getRow(1).eachCell(cell => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF204B69" } };
        cell.alignment = { vertical: "middle", wrapText: true };
    });
    sheet.views = [{ state: "frozen", ySplit: 1 }];
    sheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } };
}

function safeSheetName(name: string, used: Set<string>): string {
    const base = name.replace(/[\[\]:*?/\\]/g, "-").replace(/^'+|'+$/g, "").trim() || "Section";
    let suffix = 1;
    let candidate = base.slice(0, 31);
    while (used.has(candidate.toLowerCase())) {
        const extra = ` (${suffix++})`;
        candidate = base.slice(0, 31 - extra.length) + extra;
    }
    used.add(candidate.toLowerCase());
    return candidate;
}

function addReadme(book: ExcelJS.Workbook, detail: string[]): void {
    const sheet = book.addWorksheet("Instructions");
    sheet.columns = [{ width: 26 }, { width: 100 }];
    sheet.addRow(["TINDIGCHECK! 2.0", "CONFIDENTIAL — learner and health information"]);
    sheet.addRow(["Purpose", "Administrative data transfer. Store downloaded files securely."]);
    for (const [index, line] of detail.entries()) sheet.addRow([`Note ${index + 1}`, line]);
    sheet.getRow(1).font = { bold: true, color: { argb: "FF204B69" }, size: 14 };
}

function addLearnerSheet(book: ExcelJS.Workbook, name: string, rows: ExportLearner[]): void {
    const sheet = book.addWorksheet(name);
    styleSheet(sheet, LEARNER_COLUMNS);
    for (const learner of rows) {
        sheet.addRow({
            student_id: learner.student_id,
            last_name: learner.last_name,
            first_name: learner.first_name,
            middle_name: learner.middle_name ?? "",
            age: learner.age,
            sex: learner.sex,
            grade: learner.grade,
            section: learner.section,
            date_of_birth: learner.date_of_birth ?? "",
            has_food_allergy: learner.has_food_allergy ? "Yes" : "No",
            allergies: learner.allergies
        });
    }
}

async function saveWorkbook(book: ExcelJS.Workbook, filename: string): Promise<void> {
    const buffer = await book.xlsx.writeBuffer();
    const blob = new Blob([new Uint8Array(buffer)], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 3000);
}

/** Template with text-formatted IDs and exact import headers. */
export async function downloadLearnerTemplate(user: UserProfile): Promise<void> {
    assertAdministrator(user);
    const book = new ExcelJS.Workbook();
    addReadme(book, [
        "Fill the Learners_Import worksheet. One learner per row; do not rename the headers.",
        "Learner ID must be TEXT (especially IDs beginning with zero).",
        "Grade must be 1–6; Section must already exist in Section Management.",
        "Sex: Male or Female. Allergy flag: Yes or No; if Yes, specify allergens.",
        "Date of birth: YYYY-MM-DD. Age is calculated from birth date when provided.",
        "Only NEW learner IDs are imported. Existing learners are never overwritten.",
        "Photographs and health records are not imported by this template."
    ]);
    addLearnerSheet(book, "Learners_Import", []);
    await saveWorkbook(book, "TINDIGCHECK_Learner_Import_Template.xlsx");
}

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
export async function previewLearnerImport(user: UserProfile, file: File, sections: SchoolSection[]): Promise<ImportPreview> {
    assertAdministrator(user);
    if (!file.name.toLowerCase().endsWith(".xlsx")) throw new Error("Select an .xlsx Excel workbook.");
    if (file.size > MAX_IMPORT_BYTES) throw new Error("File exceeds 3 MB. Split the import into smaller files.");
    const book = new ExcelJS.Workbook();
    await book.xlsx.load((await file.arrayBuffer()) as Parameters<typeof book.xlsx.load>[0]);
    const sheet = book.getWorksheet("Learners_Import") ?? book.getWorksheet("Learners");
    if (!sheet) throw new Error("Worksheet 'Learners_Import' not found. Download the template first.");
    if (sheet.actualRowCount > MAX_IMPORT_ROWS + 1) throw new Error("Maximum 1,000 learners per import.");

    const columnIndex = new Map<string, number>();
    sheet.getRow(1).eachCell((cell, column) => {
        columnIndex.set(asCellText(cell).toLowerCase().trim(), column);
    });
    const missing = LEARNER_COLUMNS.filter(name => !columnIndex.has(name));
    if (missing.length) throw new Error(`Missing required column(s): ${missing.join(", ")}`);

    const sectionNames = new Map(sections.map(section => [
        sectionKey(Number(section.grade), section.section_name), section.section_name
    ]));
    const rows: ImportRow[] = [];
    const issues: string[] = [];
    const idsInFile = new Set<string>();
    let totalDataRows = 0;

    sheet.eachRow((excelRow, number) => {
        if (number === 1) return;
        const values: Record<string, string> = {};
        try {
            for (const column of LEARNER_COLUMNS) {
                values[column] = asCellText(excelRow.getCell(columnIndex.get(column)!));
            }
            if (LEARNER_COLUMNS.every(column => !values[column])) return;
            totalDataRows++;
            if (totalDataRows > MAX_IMPORT_ROWS) {
                issues.push("Maximum 1,000 learners per import.");
                return;
            }
            const idCell = excelRow.getCell(columnIndex.get("student_id")!);
            if (typeof idCell.value === "number") {
                throw new Error("Learner ID must be stored as Text to preserve leading zeros.");
            }
            const studentId = values.student_id;
            if (!studentId || studentId.length > 100) throw new Error("Learner ID is required (max 100 characters).");
            if (idsInFile.has(studentId)) throw new Error(`Duplicate Learner ID in file: ${studentId}`);
            idsInFile.add(studentId);
            const lastName = values.last_name;
            const firstName = values.first_name;
            if (!lastName || !firstName) throw new Error("Surname and First Name are required.");
            if (lastName.length > 150 || firstName.length > 150) throw new Error("Name is too long.");
            const grade = Number(values.grade);
            if (!Number.isInteger(grade) || grade < 1 || grade > 6) throw new Error("Grade must be 1–6.");
            const canonicalSection = sectionNames.get(sectionKey(grade, values.section));
            if (!canonicalSection) throw new Error(`Section '${values.section}' is not registered for Grade ${grade}.`);
            const sex = values.sex.toLowerCase() === "male" ? "Male" :
                values.sex.toLowerCase() === "female" ? "Female" : "";
            if (!sex) throw new Error("Sex must be Male or Female.");
            const dob = values.date_of_birth;
            if (dob && !validIsoDate(dob)) throw new Error("Date of birth must be YYYY-MM-DD and not in the future.");
            const age = dob ? yearsOld(dob) : Number(values.age);
            if (!Number.isInteger(age) || age < 1 || age > 25) throw new Error("Age must be 1–25 (or supply a valid birth date).");
            const allergyFlag = parseFlag(values.has_food_allergy);
            if (allergyFlag === null) throw new Error("has_food_allergy must be Yes or No.");
            const allergies = values.allergies.trim();
            if (allergyFlag && !allergies) throw new Error("Specify allergies when has_food_allergy is Yes.");
            if (!allergyFlag && allergies) throw new Error("Set has_food_allergy to Yes when allergies are listed.");
            if (allergies.length > 1000) throw new Error("Allergy description is too long.");
            rows.push({
                student_id: studentId, last_name: lastName, first_name: firstName,
                middle_name: values.middle_name || null, age, sex, grade,
                section: canonicalSection, date_of_birth: dob || null,
                has_food_allergy: allergyFlag, allergies
            });
        } catch (error) {
            issues.push(`Excel row ${number}: ${error instanceof Error ? error.message : "Invalid value"}`);
        }
    });
    if (totalDataRows === 0) issues.push("The workbook has no learner rows.");
    const existing = await existingStudentIds(rows.map(row => row.student_id));
    return {
        filename: file.name,
        rows: rows.filter(row => !existing.has(row.student_id)),
        existingIds: [...existing], issues, totalDataRows
    };
}

/** Inserts ONLY new learners. If a batch fails, earlier batches remain saved. */
export async function importNewLearners(user: UserProfile, preview: ImportPreview): Promise<{ created: number; skipped: number }> {
    assertAdministrator(user);
    if (preview.issues.length) throw new Error("Correct the Excel validation errors before importing.");
    if (!preview.rows.length) throw new Error("There are no new learners to import.");
    let created = 0;
    let skipped = preview.existingIds.length;
    for (const group of chunk(preview.rows, 50)) {
        const found = await existingStudentIds(group.map(row => row.student_id));
        const newRows = group.filter(row => !found.has(row.student_id));
        skipped += group.length - newRows.length;
        if (!newRows.length) continue;
        const { data, error } = await supabase.from("learners")
            .insert(newRows).select("id, student_id");
        if (error) {
            throw new Error(
                `${created} learner(s) saved before import stopped. ${error.message}. ` +
                "Refresh the learner list and preview the file again before retrying."
            );
        }
        created += (data ?? []).length;
        if ((data ?? []).length !== newRows.length) {
            throw new Error(`${created} learner(s) confirmed; import response was incomplete. Refresh and verify before retrying.`);
        }
    }
    return { created, skipped };
}

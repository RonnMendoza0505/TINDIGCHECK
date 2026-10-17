/** Member 2: Validate and import learner input from Excel files.
 * Admin/Super Admin role checks are also enforced by Supabase RLS.
 */
import ExcelJS from "exceljs";
import { supabase } from "./supabase";
import type { SchoolSection } from "./sections";
import type { UserProfile } from "../types";
import { LEARNER_COLUMNS, assertAdministrator, chunk, cleanText,
    addReadme, addLearnerSheet, saveWorkbook } from "./learnerTransferShared";
import type { ImportPreview, ImportRow } from "./learnerTransferShared";
export type { ImportPreview } from "./learnerTransferShared";
const MAX_IMPORT_BYTES = 3 * 1024 * 1024;
const MAX_IMPORT_ROWS = 1000;

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

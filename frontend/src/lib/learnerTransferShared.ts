/** Shared types and Excel helpers for administrative data transfer. */
import ExcelJS from "exceljs";
import type { LearnerInput } from "./learners";
import type { UserProfile } from "../types";

export const LEARNER_COLUMNS = [
    "student_id", "last_name", "first_name", "middle_name", "age", "sex",
    "grade", "section", "date_of_birth", "has_food_allergy", "allergies"
] as const;

export const HEALTH_COLUMNS = [
    "student_id", "learner_name", "grade", "section", "recorded_at",
    "weight_kg", "height_cm", "heart_rate_bpm", "spo2_percent", "bmi", "bmi_status"
] as const;

export const PAGE_SIZE = 500;
export type ImportRow = Omit<LearnerInput, "photo_url">;

export type ExportLearner = ImportRow & { id: string };

export type ExportHealth = {
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
export function assertAdministrator(user: UserProfile): void {
    if (user.role !== "Super Admin" && user.role !== "Admin") {
        throw new Error("Only authorized administrators may import or export learner data.");
    }
}

export function chunk<T>(items: T[], size: number): T[][] {
    const result: T[][] = [];
    for (let i = 0; i < items.length; i += size) result.push(items.slice(i, i + size));
    return result;
}

export function cleanText(value: unknown): string {
    return String(value ?? "").trim();
}

export function isoToday(): string {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function styleSheet(sheet: ExcelJS.Worksheet, headers: readonly string[]): void {
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

export function safeSheetName(name: string, used: Set<string>): string {
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

export function addReadme(book: ExcelJS.Workbook, detail: string[]): void {
    const sheet = book.addWorksheet("Instructions");
    sheet.columns = [{ width: 26 }, { width: 100 }];
    sheet.addRow(["TINDIGCHECK! 2.0", "CONFIDENTIAL — learner and health information"]);
    sheet.addRow(["Purpose", "Administrative data transfer. Store downloaded files securely."]);
    for (const [index, line] of detail.entries()) sheet.addRow([`Note ${index + 1}`, line]);
    sheet.getRow(1).font = { bold: true, color: { argb: "FF204B69" }, size: 14 };
}

export function addLearnerSheet(book: ExcelJS.Workbook, name: string, rows: ExportLearner[]): void {
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

export async function saveWorkbook(book: ExcelJS.Workbook, filename: string): Promise<void> {
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

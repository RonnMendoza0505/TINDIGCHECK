import referenceRows from "../../lib/cdcBmiReference.json";

/**
 * Pediatric BMI-for-age SCREENING categories, using CDC BMI-for-age
 * reference percentiles by sex and completed month (ages 2–20).
 * This is not a diagnosis. Do not apply adult BMI thresholds to children.
 */
export type BmiStatus = "Underweight" | "Normal" | "Overweight" | "Obese" | "Not assessed";
export type BmiAssessment = { status: BmiStatus; reason: string | null };

type ReferenceRow = {
    sex: number;
    ageMonths: number;
    p5: number;
    p85: number;
    p95: number;
};

const reference = referenceRows as ReferenceRow[];
const referenceIndex = new Map<string, ReferenceRow>();
for (const row of reference) {
    if ((row.sex === 1 || row.sex === 2) &&
        [row.ageMonths, row.p5, row.p85, row.p95].every(Number.isFinite) &&
        row.p5 < row.p85 && row.p85 < row.p95) {
        referenceIndex.set(`${row.sex}:${row.ageMonths}`, row);
    }
}

/** The Phase 5B starter file contained []; never treat that as a valid reference. */
export const cdcReferenceReady = referenceIndex.size >= 430 &&
    ["1:24.5", "2:24.5", "1:72.5", "2:72.5", "1:240.5", "2:240.5"]
        .every(key => referenceIndex.has(key));

function phDateParts(date: Date): { year: number; month: number; day: number } | null {
    if (!Number.isFinite(date.getTime())) return null;
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "Asia/Manila", year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const get = (type: string) => Number(parts.find(part => part.type === type)?.value);
    return { year: get("year"), month: get("month"), day: get("day") };
}

function completedMonthsAt(dob: string, measured: Date): number | null {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob);
    if (!match) return null;
    const [year, month, day] = match.slice(1).map(Number);
    const date = new Date(`${dob}T00:00:00Z`);
    if (Number.isNaN(date.getTime()) || date.getUTCFullYear() !== year ||
        date.getUTCMonth() + 1 !== month || date.getUTCDate() !== day) return null;
    const at = phDateParts(measured);
    if (!at) return null;
    const completed = (at.year - year) * 12 + at.month - month - (at.day < day ? 1 : 0);
    return completed >= 0 ? completed : null;
}

function sexToCode(sex: string): number | null {
    const normalized = sex.trim().toLowerCase();
    if (["male", "m", "1"].includes(normalized)) return 1;
    if (["female", "f", "2"].includes(normalized)) return 2;
    return null;
}

export function getBmiAssessment({ bmi, sex, dateOfBirth, measurementDate }: {
    bmi: number;
    sex: string;
    dateOfBirth: string | null;
    measurementDate: Date;
}): BmiAssessment {
    if (!Number.isFinite(bmi) || bmi <= 0) {
        return { status: "Not assessed", reason: "A valid weight and height are required." };
    }
    if (!dateOfBirth) {
        return { status: "Not assessed", reason: "Add the learner's Date of Birth in Learner Management." };
    }
    const sexCode = sexToCode(sex);
    if (!sexCode) {
        return { status: "Not assessed", reason: "Set the learner's sex to Male or Female." };
    }
    const months = completedMonthsAt(dateOfBirth, measurementDate);
    if (months === null) {
        return { status: "Not assessed", reason: "Check the learner's Date of Birth and measurement date." };
    }
    if (months < 24 || months > 240) {
        return { status: "Not assessed", reason: "CDC BMI-for-age categories apply from 2 to 20 years." };
    }
    if (!cdcReferenceReady) {
        return { status: "Not assessed", reason: "CDC BMI reference is missing. Run: node scripts/download-cdc-bmi.mjs" };
    }
    const row = referenceIndex.get(`${sexCode}:${months + 0.5}`);
    if (!row) {
        return { status: "Not assessed", reason: "No CDC reference was found for this age and sex." };
    }
    if (bmi < row.p5) return { status: "Underweight", reason: null };
    if (bmi < row.p85) return { status: "Normal", reason: null }; // CDC: healthy weight
    if (bmi < row.p95) return { status: "Overweight", reason: null };
    return { status: "Obese", reason: null };
}

/** Backward-compatible helper used by Health Monitoring and Supabase saving. */
export function classifyBmiForAge(args: Parameters<typeof getBmiAssessment>[0]): BmiStatus {
    return getBmiAssessment(args).status;
}

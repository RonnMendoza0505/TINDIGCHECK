import { readFile } from "node:fs/promises";
const path = "src/lib/cdcBmiReference.json";
try {
    const data = JSON.parse(await readFile(path, "utf8"));
    const keys = new Set(data.map(row => `${row.sex}:${row.ageMonths}`));
    const valid = Array.isArray(data) && data.length >= 430 &&
        ["1:24.5", "2:24.5", "1:72.5", "2:72.5", "1:240.5", "2:240.5"]
            .every(key => keys.has(key));
    if (!valid) {
        console.error(`BMI reference NOT READY: ${data.length ?? 0} rows in ${path}.`);
        console.error("Run: node scripts/download-cdc-bmi.mjs");
        process.exitCode = 1;
    } else {
        console.log(`BMI reference READY: ${data.length} CDC rows found.`);
        console.log("Restart Vite, then save a NEW health record or reassess old records.");
    }
} catch (error) {
    console.error(`Could not read ${path}:`, error.message);
    process.exitCode = 1;
}

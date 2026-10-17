/**
 * Run from project root:
 *   node scripts/download-cdc-bmi.mjs
 * Or download the CDC CSV manually, then:
 *   node scripts/download-cdc-bmi.mjs "C:\\path\\to\\bmiagerev.csv"
 *
 * Source: CDC BMI-for-age 2000 reference (P5/P85/P95), 2–20 years.
 * https://www.cdc.gov/growthcharts/data/zscore/bmiagerev.csv
 * This script does NOT upload or process learner information.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";

const URL = "https://www.cdc.gov/growthcharts/data/zscore/bmiagerev.csv";
const output = resolve("src/lib/cdcBmiReference.json");

async function loadCsv() {
    const localPath = process.argv[2];
    if (localPath) return readFile(localPath, "utf8");
    const response = await fetch(URL, { signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`CDC download returned HTTP ${response.status}`);
    return response.text();
}

function parseCsv(csv) {
    const lines = csv.replace(/^\uFEFF/, "").trim().split(/\r?\n/).filter(Boolean);
    const headers = lines.shift().split(",").map(item => item.trim().replace(/^"|"$/g, ""));
    const positions = Object.fromEntries(headers.map((name, index) => [name.toLowerCase(), index]));
    for (const column of ["sex", "agemos", "p5", "p85", "p95"]) {
        if (positions[column] === undefined) throw new Error(`CDC CSV is missing ${column}`);
    }
    const rows = lines.map(line => {
        const cells = line.split(",");
        const get = name => Number(cells[positions[name]]);
        return {
            sex: get("sex"),
            ageMonths: get("agemos"),
            p5: get("p5"),
            p85: get("p85"),
            p95: get("p95")
        };
    }).filter(row =>
        (row.sex === 1 || row.sex === 2) &&
        [row.ageMonths, row.p5, row.p85, row.p95].every(Number.isFinite) &&
        row.p5 < row.p85 && row.p85 < row.p95
    );
    if (rows.length < 430 || !rows.some(row => row.sex === 1 && row.ageMonths === 72.5) ||
        !rows.some(row => row.sex === 2 && row.ageMonths === 72.5)) {
        throw new Error(`Incomplete or invalid CDC reference: ${rows.length} rows`);
    }
    return rows;
}

try {
    const rows = parseCsv(await loadCsv());
    await mkdir(dirname(output), { recursive: true });
    await writeFile(output, JSON.stringify(rows) + "\n", "utf8");
    console.log(`Saved ${rows.length} CDC reference rows to ${output}`);
    console.log("BMI-for-age classification is now enabled. Restart npm run dev.");
} catch (error) {
    console.error("Could not prepare the CDC BMI reference:", error.message);
    console.error("Download the CSV manually from:", URL);
    console.error('Then run: node scripts/download-cdc-bmi.mjs "C:\\path\\to\\bmiagerev.csv"');
    process.exitCode = 1;
}

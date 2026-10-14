/** TINDIGCHECK! — place Print Health Report under Learner Management.
 * Requires previous Learner submenu + Excel split and Phase 10 Health Plot report.
 * Run from the tindig-vite project root: node scripts/move-print-report.mjs
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const paths = {
  types: 'src/types/index.tsx',
  nav: 'src/constants/navigation.ts',
  access: 'src/providers/access-control.ts',
  sidebar: 'src/components/Sidebar.tsx',
  app: 'src/App.tsx',
  plot: 'src/pages/health-plot/index.tsx'
};
const old = {}, next = {};
for (const [key, path] of Object.entries(paths)) {
  if (!existsSync(resolve(path))) {
    console.error(`STOP: Missing ${path}. No files changed.`);
    process.exit(1);
  }
  old[key] = readFileSync(resolve(path), 'utf8');
  next[key] = old[key];
}
function must(key, needle, replacement, name) {
  if (!next[key].includes(needle)) throw Error(`Cannot locate ${name} in ${paths[key]}. No files changed.`);
  next[key] = next[key].replace(needle, replacement);
}
function regex(key, pattern, replacement, name) {
  if (!pattern.test(next[key])) throw Error(`Cannot locate ${name} in ${paths[key]}. No files changed.`);
  next[key] = next[key].replace(pattern, replacement);
}
try {
  if (!next.sidebar.includes('"learner-excel"')) throw Error('Install the previous Import & Export Excel submenu patch first.');
  if (!next.plot.includes('LearnerHealthReport')) throw Error('Phase 10 printable report is missing from Health Plot.');
  if (next.types.includes('"learner-report"') || next.nav.includes('id: "learner-report"')) {
    throw Error('Print Health Report route already exists. This patch has not made changes.');
  }

  regex('types', /(export\s+type\s+PageId\s*=\s*[\s\S]*?)(;)/, '$1\n    | "learner-report"$2', 'PageId union');
  regex('nav', /(\{\s*id:\s*"learner-excel",[\s\S]*?\},)/,
    '$1\n    { id: "learner-report", label: "Print Health Report", icon: "▣" },', 'Excel navigation entry');
  // Match the current roles by the existing Health Plot permission. Viewers can print only their two scoped records.
  for (const role of ['Super Admin', 'Admin', 'Viewer']) {
    const re = new RegExp(`("${role}":\\s*\\[[\\s\\S]*?"health-plot",)`);
    regex('access', re, '$1\n        "learner-report",', `${role} Health Plot permission`);
  }

  must('sidebar',
    'item.id === "learners" || item.id === "learner-tools" || item.id === "learner-excel"',
    'item.id === "learners" || item.id === "learner-tools" || item.id === "learner-excel" || item.id === "learner-report"',
    'learnerPages filter');
  must('sidebar',
    'item.id !== "learners" && item.id !== "learner-tools" && item.id !== "learner-excel"',
    'item.id !== "learners" && item.id !== "learner-tools" && item.id !== "learner-excel" && item.id !== "learner-report"',
    'regularPages filter');
  must('sidebar',
    'item.id === "learners" ? "Learner Directory" : item.id === "learner-tools" ? "Add Learner" : "Import & Export Excel"',
    'item.id === "learners" ? "Learner Directory" : item.id === "learner-tools" ? "Add Learner" : item.id === "learner-excel" ? "Import & Export Excel" : "Print Health Report"',
    'submenu labels');
  must('sidebar',
    'item.id === "learners" ? "▤" : item.id === "learner-tools" ? "+" : "▣"',
    'item.id === "learners" ? "▤" : item.id === "learner-tools" ? "+" : item.id === "learner-excel" ? "▣" : "▤"',
    'submenu icons');
  next.sidebar = next.sidebar.replaceAll(
    'activePage === "learners" || activePage === "learner-tools" || activePage === "learner-excel"',
    'activePage === "learners" || activePage === "learner-tools" || activePage === "learner-excel" || activePage === "learner-report"'
  );

  regex('app', /activePage\s*===\s*"health-plot"\s*\?\s*\(/,
    '(activePage === "health-plot" || activePage === "learner-report") ? (', 'Health Plot route');
  regex('app', /<HealthPlot\s+user=\{user\}\s*\/>/,
    '<HealthPlot user={user} mode={activePage === "learner-report" ? "report" : "plot"} />',
    'HealthPlot component');

  must('plot', 'type Props = { user: UserProfile };',
    'type Props = { user: UserProfile; mode?: "plot" | "report" };', 'HealthPlot props');
  must('plot', 'export default function HealthPlot({ user }: Props) {',
    'export default function HealthPlot({ user, mode = "plot" }: Props) {', 'HealthPlot function');
  must('plot', '<h1>Health Plot</h1>',
    '<h1>{mode === "report" ? "Print Health Report" : "Health Plot"}</h1>', 'page heading');
  must('plot', '<p>Visualize a learner\'s recorded measurements over time.</p>',
    '<p>{mode === "report" ? "Select a learner and date range, then preview and print the health report." : "Visualize a learner\'s recorded measurements over time."}</p>',
    'page description');
  must('plot', '<div className="tdc-plot-panel tdc-report-launch">',
    '{mode === "report" && <div className="tdc-plot-panel tdc-report-launch">', 'report launcher opening');
  must('plot', '                <div className="tdc-plot-cards" aria-label="Latest measurements">',
    '                {mode !== "report" && <>\n                <div className="tdc-plot-cards" aria-label="Latest measurements">',
    'plot-only metrics opening');
  // Closing the conditional wrapper after report launcher, before plot cards.
  must('plot', '                    </button>\n                </div>\n                {mode !== "report" && <>',
    '                    </button>\n                </div>}\n                {mode !== "report" && <>', 'report launcher closing');
  must('plot', '            </>}\n\n        {showReport && selectedLearner',
    '                </>}\n            </>}\n\n        {showReport && selectedLearner', 'plot-only metrics closing');
  // Ensure report-only route is still covered by the existing user-based fetch and viewer record cap.
  const changed = Object.keys(paths).filter(k => old[k] !== next[k]);
  for (const key of changed) {
    const file = resolve(paths[key]);
    const backup = `${file}.before-print-report.bak`;
    if (!existsSync(backup)) copyFileSync(file, backup);
  }
  for (const key of changed) writeFileSync(resolve(paths[key]), next[key], 'utf8');
  console.log(`SUCCESS: Updated ${changed.length} files. Restart npm run dev.`);
  console.log('Learner Management -> Learner Directory / Add Learner / Import & Export Excel / Print Health Report');
  console.log('Health Plot stays available for charts, without the Print Health Report launcher.');
  console.log('Backup files: *.before-print-report.bak');
} catch (error) {
  console.error(`STOP: ${error.message}`);
  process.exitCode = 1;
}

/** TINDIGCHECK! patch for the learner-tools submenu version.
 * Run from project root. Validates all anchors and writes backups before editing.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';
const files = {
  types:'src/types/index.tsx',
  nav:'src/constants/navigation.ts',
  access:'src/providers/access-control.ts',
  sidebar:'src/components/Sidebar.tsx',
  app:'src/App.tsx',
  learners:'src/pages/learners/index.tsx',
};
const before = {}, after = {};
for (const [k,p] of Object.entries(files)) {
  if (!existsSync(resolve(p))) { console.error('STOP: Missing '+p); process.exit(1); }
  before[k]=readFileSync(resolve(p),'utf8'); after[k]=before[k];
}
function replace(k,oldText,newText,desc) {
  if (!after[k].includes(oldText)) throw Error(`Cannot find ${desc} in ${files[k]}. No files changed. Send the file for a tailored patch.`);
  after[k]=after[k].replace(oldText,newText);
}
function replaceRegex(k,rx,repl,desc) {
  if (!rx.test(after[k])) throw Error(`Cannot find ${desc} in ${files[k]}. No files changed.`);
  after[k]=after[k].replace(rx,repl);
}
try {
  if (!after.types.includes('"learner-excel"')) replaceRegex('types',/(export\s+type\s+PageId\s*=\s*[\s\S]*?)(;)/,'$1\n    | "learner-excel"$2','PageId union');
  if (!after.nav.includes('id: "learner-excel"')) replaceRegex('nav',/(\{\s*id:\s*"learner-tools",[\s\S]*?\},)/,'$1\n    { id: "learner-excel", label: "Import & Export Excel", icon: "▤" },','learner-tools nav item');
  for (const role of ['Super Admin','Admin']) {
    const rx = new RegExp(`("${role}":\\s*\\[[\\s\\S]*?"learner-tools",)`);
    if (!new RegExp(`"${role}":\\s*\\[[\\s\\S]*?"learner-excel"`).test(after.access)) replaceRegex('access',rx,'$1\n        "learner-excel",',role+' role permissions');
  }
  if (!after.sidebar.includes('"learner-excel"')) {
    replace('sidebar','item.id === "learners" || item.id === "learner-tools"','item.id === "learners" || item.id === "learner-tools" || item.id === "learner-excel"','learnerPages filter');
    replace('sidebar','item.id !== "learners" && item.id !== "learner-tools"','item.id !== "learners" && item.id !== "learner-tools" && item.id !== "learner-excel"','regularPages filter');
    replace('sidebar','item.id === "learners" ? "Learner Directory" : "Add Learner & Excel"','item.id === "learners" ? "Learner Directory" : item.id === "learner-tools" ? "Add Learner" : "Import & Export Excel"','learner submenu labels');
    replace('sidebar','item.id === "learners" ? "▤" : "+"','item.id === "learners" ? "▤" : item.id === "learner-tools" ? "+" : "▣"','learner submenu icons');
    after.sidebar=after.sidebar.replaceAll('activePage === "learners" || activePage === "learner-tools"','activePage === "learners" || activePage === "learner-tools" || activePage === "learner-excel"');
  }
  if (!after.app.includes('activePage === "learner-excel"')) {
    replace('app','activePage === "learners" || activePage === "learner-tools"','activePage === "learners" || activePage === "learner-tools" || activePage === "learner-excel"','LearnerManagement route condition');
    replace('app','mode={activePage === "learner-tools" ? "tools" : "directory"}','mode={activePage === "learner-excel" ? "excel" : activePage === "learner-tools" ? "tools" : "directory"}','LearnerManagement mode prop');
  }
  if (!after.learners.includes('"directory" | "tools" | "excel"')) replace('learners','"directory" | "tools"','"directory" | "tools" | "excel"','LearnerManagement mode type');
  if (!after.learners.includes('mode === "excel" ? "Import & Export Excel"')) {
    replace('learners','mode === "tools" ? "Add Learner & Excel" : "Learner Management"','mode === "excel" ? "Import & Export Excel" : mode === "tools" ? "Add Learner" : "Learner Management"','learner page heading');
  }
  if (!after.learners.includes('mode === "excel" && canManage && (')) replace('learners','mode === "tools" && canManage && (\n                <LearnerDataTransfer','mode === "excel" && canManage && (\n                <LearnerDataTransfer','Excel panel visibility');
  // Directory retains its existing Edit -> Add Learner behavior; Excel page is only visible to Admin/Super Admin.
  const changed=Object.keys(files).filter(k=>after[k]!==before[k]);
  for (const k of changed) {
    const path=resolve(files[k]);const backup=path+'.before-excel-split.bak';
    if (!existsSync(backup))copyFileSync(path,backup);
  }
  for (const k of changed)writeFileSync(resolve(files[k]),after[k],'utf8');
  console.log('SUCCESS: '+changed.length+' files updated. Restart Vite.');
  console.log('Learner submenu: Learner Directory / Add Learner / Import & Export Excel.');
  console.log('Originals saved as *.before-excel-split.bak');
} catch(e) { console.error('STOP: '+e.message);process.exitCode=1; }

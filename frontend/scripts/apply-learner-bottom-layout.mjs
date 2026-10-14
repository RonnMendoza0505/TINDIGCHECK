/* TINDIGCHECK! — apply the bottom-of-page learner form style, without touching CRUD logic. */
import { readFileSync, writeFileSync, existsSync, copyFileSync, mkdirSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

const root = process.cwd();
const learnerFile = resolve(root, 'src/pages/learners/index.tsx');
const sideCss = resolve(root, 'src/pages/learners/learner-side-panel.css');
const standaloneCss = resolve(root, 'src/pages/learners/learner-bottom-layout.css');
const sourceCss = resolve(root, 'styles/learner-bottom-layout.css');
const marker = 'TINDIGCHECK! 2.0 — Learner Management: full-width directory, form BELOW table.';

function fail(message) { console.error(`NOT MODIFIED: ${message}`); process.exit(1); }
if (!existsSync(learnerFile)) fail('Run this script inside the tindig-vite folder. Missing src/pages/learners/index.tsx.');
if (!existsSync(sourceCss)) fail('Copy the ZIP files (including styles/) into your project root first.');
const patch = readFileSync(sourceCss, 'utf8');
let component = readFileSync(learnerFile, 'utf8');

if (existsSync(sideCss)) {
    const current = readFileSync(sideCss, 'utf8');
    if (!current.includes(marker)) {
        const backup = sideCss + '.before-bottom-layout.bak';
        if (!existsSync(backup)) copyFileSync(sideCss, backup);
        writeFileSync(sideCss, current.trimEnd() + '\n\n' + patch + '\n', 'utf8');
    }
    if (!component.includes('import "./learner-side-panel.css";') &&
        !component.includes("import './learner-side-panel.css';")) {
        const backup = learnerFile + '.before-bottom-layout.bak';
        if (!existsSync(backup)) copyFileSync(learnerFile, backup);
        component = 'import "./learner-side-panel.css";\n' + component;
        writeFileSync(learnerFile, component, 'utf8');
    }
} else {
    mkdirSync(dirname(standaloneCss), { recursive: true });
    if (!existsSync(standaloneCss) || !readFileSync(standaloneCss, 'utf8').includes(marker)) {
        writeFileSync(standaloneCss, patch + '\n', 'utf8');
    }
    if (!component.includes('import "./learner-bottom-layout.css";') &&
        !component.includes("import './learner-bottom-layout.css';")) {
        const backup = learnerFile + '.before-bottom-layout.bak';
        if (!existsSync(backup)) copyFileSync(learnerFile, backup);
        component = 'import "./learner-bottom-layout.css";\n' + component;
        writeFileSync(learnerFile, component, 'utf8');
    }
}
console.log('SUCCESS: Add/Edit Learner form now displays below the learner directory.');
console.log('Responsive style applied: 3 columns desktop, 2 tablet, 1 mobile.');
console.log('No account, database, learner handlers, or other modules were changed.');

/*
 * TINDIGCHECK! learner-side-panel migration (React TSX)
 * Run from tindig-vite project root:
 *   node scripts/apply-learner-side-panel.mjs
 *
 * Backs up original file, changes layout only, preserves form handlers,
 * photo upload, allergy fields, Excel integration, and Supabase CRUD.
 * Aborts before writing if the expected source structure has changed.
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = process.cwd();
const path = resolve(root, 'src/pages/learners/index.tsx');
const cssPath = resolve(root, 'src/pages/learners/learner-side-panel.css');
const abort = (message) => { console.error('NOT MODIFIED:', message); process.exit(1); };

if (!existsSync(path)) abort('Cannot find src/pages/learners/index.tsx. Run from the tindig-vite project root.');
if (!existsSync(cssPath)) abort('Copy src/pages/learners/learner-side-panel.css from the ZIP first.');
let code = readFileSync(path, 'utf8');
if (code.includes('tdc-learners-workspace')) {
  console.log('Learner side-panel layout is already installed. No changes made.');
  process.exit(0);
}

const required = [
  ['formOpen state', /const\s*\[\s*formOpen\s*,\s*setFormOpen\s*\]\s*=\s*useState\(false\);/],
  ['learner page', /<section className="learner-page">/],
  ['learner toolbar', /<div className="learner-toolbar">/],
  ['learner table', /<div className="learner-table-wrapper">/],
  ['form condition', /\{formOpen\s*&&\s*canManage\s*&&\s*\(/],
  ['form card', /<div className="learner-form-card">/],
  ['form heading', /<div className="learner-form-heading">/],
  ['form submit', /<form onSubmit=\{handleSubmit\}>/],
  ['closeForm function', /function closeForm\(\)\s*\{/],
  ['success form close', /setFormOpen\(false\);/],
];
for (const [label, pattern] of required) {
  if (!pattern.test(code)) abort(`Expected ${label} not found. Send your current learner index.tsx for a tailored fix.`);
}

const replaceOnce = (pattern, replacement, label) => {
  const before = code;
  code = code.replace(pattern, replacement);
  if (code === before) abort(`Unable to update ${label}.`);
};

// CSS lives next to the component so App.tsx does not need changing.
if (!code.includes('import "./learner-side-panel.css";')) {
  code = 'import "./learner-side-panel.css";\n' + code;
}

replaceOnce(/const\s*\[\s*formOpen\s*,\s*setFormOpen\s*\]\s*=\s*useState\(false\);/,
  'const [formOpen, setFormOpen] = useState(true);', 'initial editor visibility');

// The form is always available to Super Admin and Admin. Clear returns to Add mode.
replaceOnce(/function closeForm\(\)\s*\{[\s\S]*?\n\s{4}\}/,
  'function closeForm() {\n        openAddForm();\n    }', 'clear form handler');

// After successful save, keep the panel visible and reset for the next learner.
replaceOnce(/setFormOpen\(false\);\s*setEditingId\(null\);\s*setPhotoFile\(null\);/,
  'setFormOpen(true);\n            setEditingId(null);\n            setPhotoFile(null);\n            setForm({ ...EMPTY_FORM });', 'form reset after saving');

replaceOnce(/<div className="learner-form-heading">[\s\S]*?<\/div>\s*<form onSubmit=\{handleSubmit\}>/,
`<div className="learner-form-heading">
                        <div className="tdc-learner-editor-title">
                            <span className="tdc-learner-editor-icon" aria-hidden="true">+</span>
                            <h2>{editingId ? "Edit Learner" : "Add New Learner"}</h2>
                            <p>Register a learner for Grades 1–6, or update a selected profile.</p>
                        </div>
                        <button type="button" onClick={closeForm}>Clear</button>
                    </div>

                    <form onSubmit={handleSubmit}>`, 'learner editor heading');

replaceOnce(/<div className="learner-form-card">/,
  '<aside className="learner-form-card tdc-learner-editor">', 'form side panel');
replaceOnce(/(<\/form>\s*)<\/div>(\s*\)\})/,
  '$1</aside>$2', 'form side panel closing tag');

const toolbarAnchor = '<div className="learner-toolbar">';
const toolbarPos = code.indexOf(toolbarAnchor);
const formPos = code.indexOf('{formOpen && canManage && (');
const tablePos = code.indexOf('<div className="learner-table-wrapper">');
if (toolbarPos < 0 || tablePos <= toolbarPos || formPos <= tablePos) abort('Learner directory/form order differs; manual merge needed.');

// Insert directory wrapper before toolbar, keeping filters/table and import/export controls intact.
const toolbarLine = code.lastIndexOf('\n', toolbarPos) + 1;
code = code.slice(0, toolbarLine) +
  '            <div className="tdc-learners-workspace">\n' +
  '                <div className="tdc-learners-directory">\n' +
  code.slice(toolbarLine);

// Close directory after the table, before the form comment.
const newFormPos = code.indexOf('{formOpen && canManage && (');
const precedingComment = code.lastIndexOf('            {/*', newFormPos);
if (precedingComment < 0 || !code.slice(precedingComment, newFormPos).includes('Add/Edit Learner form')) {
  abort('Unable to find the Add/Edit Learner form comment; manual merge needed.');
}
code = code.slice(0, precedingComment) + '                </div>\n\n' + code.slice(precedingComment);

// Close workspace immediately before the page section ends.
const sectionEnd = code.lastIndexOf('\n        </section>');
if (sectionEnd < 0) abort('Unable to find closing learner-page section.');
code = code.slice(0, sectionEnd) + '\n            </div>' + code.slice(sectionEnd);

// Validate balance around new structural tags before touching the source file.
for (const [name, opening, closing] of [
  ['workspace', '<div className="tdc-learners-workspace">', '</div>'],
  ['editor', '<aside className="learner-form-card tdc-learner-editor">', '</aside>']
]) {
  if (!code.includes(opening) || !code.includes(closing)) abort(`Malformed ${name} markup.`);
}

const backupPath = path + '.before-side-panel.bak';
if (!existsSync(backupPath)) copyFileSync(path, backupPath);
writeFileSync(path, code, 'utf8');
console.log('SUCCESS: Learner Management now has a Section Management-style side panel.');
console.log('Original backed up at: src/pages/learners/index.tsx.before-side-panel.bak');
console.log('Run npm run dev, then check Learner Management as Admin or Super Admin.');

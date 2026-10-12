/**
 * TINDIGCHECK! Learner sidebar submenu and separated Add Learner + Excel page.
 * Operates on existing TSX files; backs up originals; stops if an expected anchor is missing.
 * Run from the project root: node scripts/apply-learner-submenu.mjs
 */
import { readFileSync, writeFileSync, existsSync, copyFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();
const paths = {
    types: "src/types/index.tsx",
    navigation: "src/constants/navigation.ts",
    access: "src/providers/access-control.ts",
    sidebar: "src/components/Sidebar.tsx",
    app: "src/App.tsx",
    learners: "src/pages/learners/index.tsx"
};
const original = {};
for (const [name, relative] of Object.entries(paths)) {
    const file = resolve(root, relative);
    if (!existsSync(file)) {
        console.error(`STOPPED: Missing ${relative}. No files changed.`);
        process.exit(1);
    }
    original[name] = readFileSync(file, "utf8");
}
if (!existsSync(resolve(root,"src/components/learner-menu.css")) ||
    !existsSync(resolve(root,"src/pages/learners/learner-menu-layout.css"))) {
    console.error("STOPPED: CSS files missing. Extract the ZIP into the tindig-vite root first.");
    process.exit(1);
}
const changes = {...original};
function fail(label) { throw new Error(`Cannot locate ${label}. No files changed. Send src/App.tsx and src/pages/learners/index.tsx for a tailored patch.`); }
function once(name, pattern, replacement, label) {
    if (!pattern.test(changes[name])) fail(label);
    changes[name] = changes[name].replace(pattern, replacement);
}
function addOnce(name, match, pattern, replacement, label) {
    if (!changes[name].includes(match)) once(name, pattern, replacement, label);
}
try {
    // PageId: only the type union, not any similarly named type.
    if (!changes.types.includes('"learner-tools"')) {
        once("types", /(export\s+type\s+PageId\s*=\s*[\s\S]*?)(;)/, '$1\n    | "learner-tools"$2', 'PageId type union');
    }

    if (!changes.navigation.includes('id: "learner-tools"')) {
        once("navigation", /(\{\s*id:\s*"learners",[\s\S]*?\},)/,
            '$1\n    {\n        id: "learner-tools",\n        label: "Add Learner & Excel",\n        icon: "+"\n    },', 'Learner navigation entry');
    }

    // Only Super Admin and Admin gain the new route; Viewer stays read-only.
    for (const role of ["Super Admin", "Admin"]) {
        if (!new RegExp(`"${role}":\\s*\\[[\\s\\S]*?"learner-tools"`).test(changes.access)) {
            const rx = new RegExp(`("${role}":\\s*\\[[\\s\\S]*?"learners",)`);
            once("access", rx, '$1\n        "learner-tools",', `${role} access array`);
        }
    }

    // Sidebar: preserve existing responsive mobile drawer and More modules.
    if (!changes.sidebar.includes('./learner-menu.css')) changes.sidebar = 'import "./learner-menu.css";\n' + changes.sidebar;
    if (!changes.sidebar.includes('const [learnersOpen,')) {
        once("sidebar", /const \[moreOpen, setMoreOpen\] = useState\(false\);/,
            'const [moreOpen, setMoreOpen] = useState(false);\n    const [learnersOpen, setLearnersOpen] = useState(activePage === "learners" || activePage === "learner-tools");', 'Sidebar More modules state');
    }
    if (!changes.sidebar.includes('const learnerPages = allowedPages.filter')) {
        once("sidebar", /const primaryPages = allowedPages\.slice\(0,\s*7\);\s*const morePages = allowedPages\.slice\(7\);/,
            'const learnerPages = allowedPages.filter(item => item.id === "learners" || item.id === "learner-tools");\n    const regularPages = allowedPages.filter(item => item.id !== "learners" && item.id !== "learner-tools");\n    const primaryPages = regularPages.slice(0, 6);\n    const morePages = regularPages.slice(6);', 'Sidebar primary/More navigation split');
    }
    if (!changes.sidebar.includes('setLearnersOpen(true);')) {
        once("sidebar", /(setMoreOpen\(false\);\s*\}, \[activePage\]\);)/,
            'setMoreOpen(false);\n        if (activePage === "learners" || activePage === "learner-tools") setLearnersOpen(true);\n    }, [activePage]);', 'Sidebar active-page effect');
    }
    if (!changes.sidebar.includes('tdc-learner-submenu')) {
        once("sidebar", /\{primaryPages\.map\(renderNavLink\)\}/,
`{primaryPages[0] && renderNavLink(primaryPages[0])}
                    {learnerPages.length > 0 && (
                        <div className="tdc-learner-menu">
                            <button
                                type="button"
                                className={activePage === "learners" || activePage === "learner-tools" ? "nav-link active" : "nav-link"}
                                aria-expanded={learnersOpen}
                                aria-controls="tdc-learner-submenu"
                                onClick={() => setLearnersOpen(open => !open)}
                            >
                                <span className="nav-symbol" aria-hidden="true">♙</span>
                                <span>Learner Management {learnersOpen ? "▴" : "▾"}</span>
                            </button>
                            {learnersOpen && (
                                <div id="tdc-learner-submenu" className="tdc-learner-submenu">
                                    {learnerPages.map(item => (
                                        <button
                                            key={item.id}
                                            type="button"
                                            className={activePage === item.id ? "nav-link active" : "nav-link"}
                                            onClick={() => goTo(item.id)}
                                            aria-current={activePage === item.id ? "page" : undefined}
                                        >
                                            <span className="nav-symbol" aria-hidden="true">{item.id === "learners" ? "▤" : "+"}</span>
                                            <span>{item.id === "learners" ? "Learner Directory" : "Add Learner & Excel"}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {primaryPages.slice(1).map(renderNavLink)}`, 'Sidebar primary nav rendering');
    }

    // Keep one LearnerManagement component for both routes, so Edit state survives navigation.
    if (!changes.app.includes('onNavigateToTools={() => navigateTo("learner-tools")}')) {
        once("app", /:\s*activePage\s*===\s*"learners"\s*\?\s*\(\s*<LearnerManagement\s+user=\{user\}\s*\/>\s*\)/,
`: (activePage === "learners" || activePage === "learner-tools") ? (
    <LearnerManagement
        user={user}
        mode={activePage === "learner-tools" ? "tools" : "directory"}
        onNavigateToTools={() => navigateTo("learner-tools")}
    />
)`, 'App.tsx LearnerManagement route');
    }

    if (!changes.learners.includes('./learner-menu-layout.css')) changes.learners = 'import "./learner-menu-layout.css";\n' + changes.learners;
    if (!changes.learners.includes('onNavigateToTools?: () => void')) {
        once("learners", /type Props = \{\s*user: UserProfile;\s*\};/,
`type Props = {
    user: UserProfile;
    mode?: "directory" | "tools";
    onNavigateToTools?: () => void;
};`, 'LearnerManagement Props');
    }
    if (!changes.learners.includes('mode = "directory"')) {
        once("learners", /export default function LearnerManagement\(\{\s*user\s*\}: Props\)/,
            'export default function LearnerManagement({ user, mode = "directory", onNavigateToTools }: Props)', 'LearnerManagement props destructuring');
    }
    if (!/const \[formOpen, setFormOpen\]\s*=\s*useState\(true\);/.test(changes.learners)) {
        once("learners", /const \[formOpen, setFormOpen\]\s*=\s*useState\(false\);/,
            'const [formOpen, setFormOpen] = useState(true);', 'Learner form visibility state');
    }
    if (!changes.learners.includes('setFormOpen(true);\n\n        onNavigateToTools?.();')) {
        // Both Add and Edit handlers set formOpen(true) followed by refresh; redirect both to tools.
        const regex = /setFormOpen\(true\);(\s*)void loadSchoolSections\(\);/g;
        const found = [...changes.learners.matchAll(regex)];
        if (found.length !== 2) fail('Add and Edit learner handlers');
        changes.learners = changes.learners.replace(regex,
            'setFormOpen(true);\n\n        onNavigateToTools?.();$1void loadSchoolSections();');
    }
    if (!changes.learners.includes('learner-page--${mode}')) {
        once("learners", /<section className="learner-page">/,
            '<section className={`learner-page learner-page--${mode}`}>', 'Learner page root');
    }
    if (!changes.learners.includes('mode === "tools" ? "Add Learner & Excel"')) {
        once("learners", /<h1>Learner Management<\/h1>/,
            '<h1>{mode === "tools" ? "Add Learner & Excel" : "Learner Management"}</h1>', 'Learner page heading');
    }
    if (!changes.learners.includes('{canManage && (mode === "directory" || !formOpen) && (')) {
        once("learners", /\{canManage && \(\s*<button\s+type="button"\s+className="primary-button"\s+onClick=\{openAddForm\}/,
            '{canManage && (mode === "directory" || !formOpen) && (\n                    <button\n                        type="button"\n                        className="primary-button"\n                        onClick={openAddForm}', 'Learner Add button');
    }
    if (!changes.learners.includes('mode === "tools" && canManage && (\n                <LearnerDataTransfer')) {
        once("learners", /\{canManage && \(\s*<LearnerDataTransfer\s+user=\{user\}\s+onImported=\{loadLearners\}\s*\/>\s*\)\}/,
            '{mode === "tools" && canManage && (\n                <LearnerDataTransfer user={user} onImported={loadLearners} />\n            )}', 'Excel transfer component');
    }
    if (!changes.learners.includes('{mode === "directory" && (')) {
        if (changes.learners.includes('<div className="tdc-learners-directory">')) {
            // Newer projects already wrap the directory in a side-panel workspace.
            once("learners", /(<div className="tdc-learners-directory">)/,
                '{mode === "directory" && (\n            $1', 'Learner side-panel directory');
            once("learners", /(\n\s*<\/div>)(\s*\n\s*\{\/\*\s*\n\s*SYSTEM FUNCTION:\s*\n\s*Displays the Add\/Edit Learner form)/,
                '$1\n                )}$2', 'Learner side-panel directory ending');
        } else {
            once("learners", /(<div className="learner-toolbar">)/,
                '{mode === "directory" && (\n                <>\n            $1', 'Learner directory toolbar');
            once("learners", /(\n\s*\{\/\*\s*\n\s*SYSTEM FUNCTION:\s*\n\s*Displays the Add\/Edit Learner form)/,
                '\n                </>\n            )}\n$1', 'Learner directory/table ending');
        }
    }
    if (!changes.learners.includes('{mode === "tools" && formOpen && canManage && (')) {
        once("learners", /\{formOpen && canManage && \(/,
            '{mode === "tools" && formOpen && canManage && (', 'Learner Add/Edit form visibility');
    }

    // Everything validated: make a backup before writing. Never overwrite an earlier backup.
    const changed = Object.keys(paths).filter(name => changes[name] !== original[name]);
    for (const name of changed) {
        const file = resolve(root, paths[name]);
        const backup = file + '.before-learner-submenu.bak';
        if (!existsSync(backup)) copyFileSync(file, backup);
    }
    for (const name of changed) writeFileSync(resolve(root, paths[name]), changes[name], 'utf8');
    console.log(`SUCCESS: Updated ${changed.length} files. Learner Management now has an expandable menu.`);
    console.log('Admin/Super Admin: Learner Directory + Add Learner & Excel. Viewer: Directory only.');
    console.log('Backups: *.before-learner-submenu.bak');
    console.log('Restart Vite and test Add/Edit Learner and Excel import/export.');
} catch (error) {
    console.error(`STOPPED: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
}

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import type { UserProfile } from "../../types";
import { fetchSections, type SchoolSection } from "../../lib/sections";
import {
    createManagedAccount,
    deleteManagedAccount,
    listManagedAccounts,
    updateManagedAccount,
    type ManagedAccount,
    type ManagedRole
} from "../../lib/accountManagement";
import "./index.css";

type Props = { user: UserProfile };
const GRADES = [1, 2, 3, 4, 5, 6];

/*
 * Only Super Admin/Admin see this page. Backend authorization is enforced
 * independently in the manage-accounts Edge Function.
 */
export default function AccountManagement({ user }: Props) {
    const isSuperAdmin = user.role === "Super Admin";
    const permitted = isSuperAdmin || user.role === "Admin";
    // Role choices depend on the action: creating a new Super Admin is allowed,
    // but editing/deleting a Super Admin is intentionally prohibited.
    const creatableRoles: ManagedRole[] = isSuperAdmin
        ? ["Super Admin", "Admin", "Viewer"] : ["Viewer"];
    const editableRoles: ManagedRole[] = isSuperAdmin ? ["Admin", "Viewer"] : ["Viewer"];

    const [accounts, setAccounts] = useState<ManagedAccount[]>([]);
    const [sections, setSections] = useState<SchoolSection[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [editingId, setEditingId] = useState<string | null>(null);
    const [fullName, setFullName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [role, setRole] = useState<ManagedRole>(isSuperAdmin ? "Admin" : "Viewer");
    const [grade, setGrade] = useState("");
    const [section, setSection] = useState("");
    const [search, setSearch] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [newAccounts, newSections] = await Promise.all([
                listManagedAccounts(),
                fetchSections()
            ]);
            setAccounts(newAccounts);
            setSections(newSections);
            setError("");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to load account data.");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (permitted) void load();
    }, [load, permitted]);

    const sectionOptions = useMemo(() => sections
        .filter(item => String(item.grade) === grade)
        .map(item => item.section_name)
        .sort((a, b) => a.localeCompare(b)), [sections, grade]);

    const visibleAccounts = useMemo(() => accounts.filter(account =>
        `${account.full_name} ${account.email} ${account.role} ${account.grade ?? ""} ${account.section ?? ""}`
            .toLowerCase().includes(search.toLowerCase().trim())
    ), [accounts, search]);

    function resetForm() {
        setEditingId(null);
        setFullName("");
        setEmail("");
        setPassword("");
        setShowPassword(false);
        setRole(isSuperAdmin ? "Admin" : "Viewer");
        setGrade("");
        setSection("");
    }

    function startEdit(account: ManagedAccount) {
        if (!editableRoles.includes(account.role) || account.id === user.id) return;
        setEditingId(account.id);
        setFullName(account.full_name);
        setEmail(account.email);
        setPassword("");
        setRole(account.role);
        setGrade(account.grade ?? "");
        setSection(account.section ?? "");
        setError("");
        setSuccess("");
    }

    async function handleDelete(account: ManagedAccount) {
        if (!permitted || busy || !editableRoles.includes(account.role) || account.id === user.id) return;
        const confirmed = window.confirm(
            `Permanently delete ${account.full_name} (${account.email || account.role})?\n\n` +
            "This removes the login and its account profile. This cannot be undone."
        );
        if (!confirmed) return;

        setBusy(true);
        setError("");
        setSuccess("");
        try {
            const warning = await deleteManagedAccount(account.id);
            if (editingId === account.id) resetForm();
            setAccounts(await listManagedAccounts());
            setSuccess(`Account for ${account.full_name} was deleted.`);
            if (warning) setError(warning);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to delete account.");
            // Refresh in case the server completed deletion but failed to respond.
            try { setAccounts(await listManagedAccounts()); } catch { /* Preserve original error. */ }
        } finally {
            setBusy(false);
        }
    }

    async function handleSubmit(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!permitted || busy) return;
        setError("");
        setSuccess("");

        if (fullName.trim().length < 2) {
            setError("Enter the account holder's full name.");
            return;
        }
        if (!(editingId ? editableRoles : creatableRoles).includes(role)) {
            setError("You are not allowed to assign that account role.");
            return;
        }
        if (!editingId && password.length < 12) {
            setError("Use an initial password of at least 12 characters.");
            return;
        }
        if (role === "Viewer" && (!GRADES.includes(Number(grade)) || !sectionOptions.includes(section))) {
            setError("Select an existing Grade and Section for the Viewer.");
            return;
        }

        setBusy(true);
        try {
            const details = {
                full_name: fullName.trim(),
                role,
                grade: role === "Viewer" ? grade : null,
                section: role === "Viewer" ? section : null
            };
            if (editingId) {
                const warning = await updateManagedAccount({ id: editingId, ...details });
                setSuccess("Account details updated successfully.");
                if (warning) setError(warning);
            } else {
                const warning = await createManagedAccount({
                    email: email.trim().toLowerCase(),
                    password,
                    ...details
                });
                setSuccess("Account created. Share the initial password privately with the account holder.");
                if (warning) setError(warning);
            }
            resetForm();
            // Refresh account list after the mutation. Do not clear success on refresh.
            const refreshed = await listManagedAccounts();
            setAccounts(refreshed);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Unable to save account.");
        } finally {
            setBusy(false);
        }
    }

    if (!permitted) {
        return <section className="tdc-accounts"><p role="alert">Account Management is restricted to administrators.</p></section>;
    }

    return (
        <section className="tdc-accounts">
            <header className="tdc-accounts-heading">
                <div>
                    <p className="eyebrow">TINDIGCHECK! 2.0</p>
                    <h1>Account Management</h1>
                    <p>Create and manage staff accounts with role-based permissions.</p>
                </div>
                <button type="button" className="tdc-secondary" onClick={() => void load()} disabled={loading || busy}>
                    {loading ? "Loading..." : "Refresh accounts"}
                </button>
            </header>

            {error && <p className="tdc-accounts-error" role="alert">{error}</p>}
            {success && <p className="tdc-accounts-success" role="status">{success}</p>}

            <div className="tdc-accounts-grid">
                <div className="tdc-accounts-panel">
                    <h2>{editingId ? "Edit account" : "Register account"}</h2>
                    <p className="tdc-muted">{isSuperAdmin
                        ? "Super Admin can register Super Admin, Admin, and Viewer accounts."
                        : "Admin can register Viewer accounts only."}</p>
                    <form onSubmit={event => void handleSubmit(event)} className="tdc-account-form">
                        <label>Full name
                            <input value={fullName} onChange={event => setFullName(event.target.value)} maxLength={100} required placeholder="Teacher's full name" />
                        </label>
                        <label>Email address
                            <input type="email" value={email} onChange={event => setEmail(event.target.value)} disabled={Boolean(editingId)} required placeholder="teacher@school.edu.ph" autoComplete="off" />
                        </label>
                        {!editingId && <>
                            <label>Initial password
                                <input type={showPassword ? "text" : "password"} value={password} onChange={event => setPassword(event.target.value)} minLength={12} required autoComplete="new-password" placeholder="At least 12 characters" />
                            </label>
                            <label className="tdc-checkbox"><input type="checkbox" checked={showPassword} onChange={event => setShowPassword(event.target.checked)} /> Show password</label>
                        </>}
                        <label>Account role
                            <select value={role} onChange={event => { setRole(event.target.value as ManagedRole); setGrade(""); setSection(""); }}>
                                {(editingId ? editableRoles : creatableRoles).map(value => <option key={value} value={value}>{value}</option>)}
                            </select>
                        </label>
                        {role === "Viewer" && <div className="tdc-account-assignment">
                            <p>Assigned Grade and Section</p>
                            <label>Grade
                                <select value={grade} onChange={event => { setGrade(event.target.value); setSection(""); }} required>
                                    <option value="">Select grade</option>
                                    {GRADES.map(value => <option key={value} value={String(value)}>Grade {value}</option>)}
                                </select>
                            </label>
                            <label>Section
                                <select value={section} onChange={event => setSection(event.target.value)} required disabled={!grade}>
                                    <option value="">Select section</option>
                                    {sectionOptions.map(value => <option key={value} value={value}>{value}</option>)}
                                </select>
                            </label>
                        </div>}
                        <div className="tdc-form-actions">
                            <button className="tdc-primary" type="submit" disabled={busy || loading}>{busy ? "Saving..." : editingId ? "Save changes" : "Create account"}</button>
                            <button className="tdc-secondary" type="button" onClick={() => { resetForm(); setError(""); }} disabled={busy}>Clear</button>
                        </div>
                    </form>
                    <p className="tdc-footnote">Passwords are handled by Supabase Authentication and are never stored in the public account profile table.</p>
                </div>

                <div className="tdc-accounts-panel">
                    <div className="tdc-account-list-heading">
                        <h2>Registered accounts</h2>
                        <span>{visibleAccounts.length} shown</span>
                    </div>
                    <label className="tdc-account-search">Search accounts
                        <input type="search" placeholder="Search name, email, role or section" value={search} onChange={event => setSearch(event.target.value)} />
                    </label>
                    {loading ? <p className="tdc-muted">Loading accounts...</p> : visibleAccounts.length === 0 ?
                        <p className="tdc-muted">No matching accounts found.</p> :
                        <div className="tdc-account-table-wrap"><table className="tdc-account-table">
                            <thead><tr><th>Name / Email</th><th>Role</th><th>Assignment</th><th>Action</th></tr></thead>
                            <tbody>{visibleAccounts.map(account => <tr key={account.id}>
                                <td><strong>{account.full_name}</strong><small>{account.email || "Email unavailable"}</small></td>
                                <td>{account.role}</td>
                                <td>{account.role === "Viewer" ? `Grade ${account.grade ?? "?"} · ${account.section ?? "Unassigned"}` : "All grades"}</td>
                                <td>{account.role === "Super Admin" || account.id === user.id
                                    ? <span className="tdc-protected-account" title="Super Admin accounts cannot be edited or deleted here">Protected</span>
                                    : <div className="tdc-account-row-actions">
                                        <button className="tdc-edit" type="button" onClick={() => startEdit(account)} disabled={busy || !editableRoles.includes(account.role)}>Edit</button>
                                        <button className="tdc-delete" type="button" onClick={() => void handleDelete(account)} disabled={busy || !editableRoles.includes(account.role)}>Delete</button>
                                    </div>}</td>
                            </tr>)}</tbody>
                        </table></div>}
                    <p className="tdc-footnote">Super Admin accounts are listed for visibility but protected from editing and deletion. Super Admin may manage Admin/Viewer; Admin may manage Viewer only.</p>
                </div>
            </div>
        </section>
    );
}

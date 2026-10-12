import { useState, type FormEvent } from "react";
import { supabase } from "../../lib/supabase";
import "./index.css";

type LoginProps = {
    onLoginSuccess: () => Promise<void>;
};

/**
 * TINDIGCHECK! login screen.
 * This component changes only the presentation of the sign-in form.
 * Supabase authentication and the existing account-profile flow stay intact.
 */
export default function Login({ onLoginSuccess }: LoginProps) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    async function handleLogin(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (loading) return;

        setError("");
        setLoading(true);

        try {
            const { error: authError } = await supabase.auth.signInWithPassword({
                email: email.trim(),
                password
            });

            if (authError) throw authError;
            await onLoginSuccess();
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Unable to sign in. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="tdc-login">
            <section className="tdc-login__showcase" aria-label="About TINDIGCHECK">
                <div className="tdc-login__brand">
                    <div className="tdc-login__brand-mark" aria-hidden="true">
                        <svg viewBox="0 0 40 40" fill="none">
                            <path d="M20 7v26M7 20h26" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" />
                            <path d="M10 20h5l3-5 4 10 3-5h5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </div>
                    <div>
                        <span className="tdc-login__brand-name">TINDIGCHECK!</span>
                        <span className="tdc-login__brand-caption">SCHOOL HEALTH MONITORING</span>
                    </div>
                </div>

                <div className="tdc-login__showcase-content">
                    <span className="tdc-login__version">TINDIGCHECK! 2.0</span>
                    <h2>Health monitoring, <em>made clearer.</em></h2>
                    <p>
                        One organized workspace for learner profiles, health measurements,
                        and school health records.
                    </p>

                    <div className="tdc-login__vitals" aria-label="Supported health measurements">
                        <div className="tdc-login__vitals-heading">
                            <span className="tdc-login__live-dot" aria-hidden="true" />
                            HEALTH MONITORING PARAMETERS
                        </div>
                        <svg className="tdc-login__pulse" viewBox="0 0 470 88" role="img" aria-label="Decorative heartbeat line">
                            <path d="M0 45H96L118 45L137 21L156 70L180 35L194 45H278L294 45L311 23L331 68L348 44H470"
                                stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                        </svg>
                        <div className="tdc-login__metrics">
                            <span>Weight</span>
                            <span>Height</span>
                            <span>Heart Rate</span>
                            <span>SpO₂</span>
                        </div>
                    </div>
                </div>

                <div className="tdc-login__showcase-footer">
                    <span>Built for responsible school health monitoring</span>
                    <span>Version 2.0</span>
                </div>
            </section>

            <section className="tdc-login__entry" aria-labelledby="tdc-login-heading">
                <div className="tdc-login__mobile-brand">TINDIGCHECK! <span>2.0</span></div>
                <div className="tdc-login__card">
                    <div className="tdc-login__card-icon" aria-hidden="true">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                            <rect x="5" y="10" width="14" height="11" rx="2" />
                            <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                        </svg>
                    </div>
                    <div className="tdc-login__heading">
                        <span className="tdc-login__eyebrow">AUTHORIZED PERSONNEL ACCESS</span>
                        <h1 id="tdc-login-heading">Welcome back</h1>
                        <p>Sign in to your TINDIGCHECK! account to continue.</p>
                    </div>

                    <form className="tdc-login__form" onSubmit={handleLogin}>
                        <div className="tdc-login__field">
                            <label htmlFor="tdc-login-email">Email address</label>
                            <div className="tdc-login__input-wrap">
                                <svg className="tdc-login__field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <rect x="3" y="5" width="18" height="14" rx="2" />
                                    <path d="m4 7 8 6 8-6" />
                                </svg>
                                <input
                                    id="tdc-login-email"
                                    name="email"
                                    type="email"
                                    placeholder="Enter your email address"
                                    value={email}
                                    onChange={(event) => setEmail(event.target.value)}
                                    autoComplete="username"
                                    inputMode="email"
                                    autoCapitalize="none"
                                    spellCheck={false}
                                    disabled={loading}
                                    aria-invalid={Boolean(error)}
                                    required
                                />
                            </div>
                        </div>

                        <div className="tdc-login__field">
                            <label htmlFor="tdc-login-password">Password</label>
                            <div className="tdc-login__input-wrap">
                                <svg className="tdc-login__field-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                    <rect x="5" y="10" width="14" height="11" rx="2" />
                                    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
                                </svg>
                                <input
                                    id="tdc-login-password"
                                    name="password"
                                    type={showPassword ? "text" : "password"}
                                    placeholder="Enter your password"
                                    value={password}
                                    onChange={(event) => setPassword(event.target.value)}
                                    autoComplete="current-password"
                                    disabled={loading}
                                    aria-invalid={Boolean(error)}
                                    required
                                />
                                <button
                                    className="tdc-login__visibility"
                                    type="button"
                                    onClick={() => setShowPassword((visible) => !visible)}
                                    aria-label={showPassword ? "Hide password" : "Show password"}
                                    aria-pressed={showPassword}
                                    disabled={loading}
                                >
                                    {showPassword ? "Hide" : "Show"}
                                </button>
                            </div>
                        </div>

                        {error && (
                            <div className="tdc-login__error" role="alert">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                                    <circle cx="12" cy="12" r="9" />
                                    <path d="M12 7v6M12 17h.01" />
                                </svg>
                                <span>{error}</span>
                            </div>
                        )}

                        <button className="tdc-login__submit" type="submit" disabled={loading}>
                            {loading ? (
                                <>
                                    <span className="tdc-login__spinner" aria-hidden="true" />
                                    Signing in...
                                </>
                            ) : (
                                <>
                                    Sign in
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                                        <path d="M5 12h14m-6-6 6 6-6 6" />
                                    </svg>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="tdc-login__notice">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
                            <path d="m9 12 2 2 4-4" />
                        </svg>
                        Access is restricted to authorized school personnel.
                    </div>
                </div>
                <p className="tdc-login__entry-footer">TINDIGCHECK! 2.0 · School Health Monitoring System</p>
            </section>
        </main>
    );
}

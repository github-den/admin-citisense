import { useEffect, useState } from 'react';
import { Eye, EyeSlash, WarningCircle } from '@phosphor-icons/react';
import { useAuth } from '@core/context/AuthContext.jsx';
import styles from './AdminLoginPage.module.css';

export default function AdminLoginPage() {
  const { handleAdminSignIn } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtmlOverflowY = html.style.overflowY;
    const previousHtmlScrollbarGutter = html.style.scrollbarGutter;
    const previousBodyOverflow = body.style.overflow;

    html.style.overflowY = 'hidden';
    html.style.scrollbarGutter = 'auto';
    body.style.overflow = 'hidden';

    return () => {
      html.style.overflowY = previousHtmlOverflowY;
      html.style.scrollbarGutter = previousHtmlScrollbarGutter;
      body.style.overflow = previousBodyOverflow;
    };
  }, []);

  async function onSubmit(e) {
    e.preventDefault();
    if (!identifier || !password || busy) return;

    setBusy(true);
    setError('');

    try {
      await handleAdminSignIn(identifier, password);
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Unable to sign in.');
      setBusy(false);
    }
  }

  return (
    <div className={styles.shell}>
      <section className={styles.content}>
        <div className={styles.brandRow}>
          <span className={styles.wordmark}>citisense</span>
          <span className={styles.brandDivider} aria-hidden="true" />
          <span className={styles.platformLabel}>Citizen Feedback Platform</span>
        </div>

        <div className={styles.headerCopy}>
          <h1 className={styles.title}>ADMIN WORKSPACE</h1>
        </div>

        <form className={styles.form} onSubmit={onSubmit}>
          <div className={styles.inputGroup}>
            <label htmlFor="admin-identifier">Email or username</label>
            <input
              id="admin-identifier"
              type="text"
              placeholder="Email or username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label htmlFor="admin-password">Password</label>
            <div className={styles.passwordWrap}>
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
              <button
                type="button"
                className={styles.passwordToggle}
                onClick={() => setShowPassword((value) => !value)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
              >
                {showPassword ? <EyeSlash size={16} weight="bold" /> : <Eye size={16} weight="bold" />}
              </button>
            </div>
          </div>

          {error && (
            <div className={styles.error} role="alert">
              <WarningCircle size={16} weight="fill" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className={styles.submitBtn} disabled={busy}>
            {busy ? 'Signing in...' : 'Log in'}
          </button>
        </form>

        <p className={styles.helperText}>
          Proceed to the admin office if you&apos;re having trouble logging in.
        </p>
      </section>
    </div>
  );
}

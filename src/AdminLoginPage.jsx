import { useState } from 'react';
import { ShieldCheck, ArrowRight, WarningCircle } from '@phosphor-icons/react';
import { useAuth } from '@core/context/AuthContext.jsx';
import styles from './AdminLoginPage.module.css';

export default function AdminLoginPage() {
  const { handleAdminSignIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    if (!email || !password || busy) return;

    setBusy(true);
    setError('');

    try {
      await handleAdminSignIn(email, password);
      // Successful login will redirect via window.location for a clean state
      window.location.href = '/';
    } catch (err) {
      setError(err.message || 'Invalid admin credentials');
      setBusy(false);
    }
  }

  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <ShieldCheck size={32} weight="fill" />
        </div>
        
        <div className={styles.content}>
          <div className={styles.kicker}>Secure Access</div>
          <h1 className={styles.title}>Admin Workspace</h1>
          <p className={styles.body}>
            Sign in with your administrative credentials to access the moderation console and system tools.
          </p>

          <form className={styles.form} onSubmit={onSubmit}>
            <div className={styles.inputGroup}>
              <label htmlFor="admin-email">Administrative Email</label>
              <input
                id="admin-email"
                type="email"
                placeholder="admin@citisense.ph"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                required
              />
            </div>

            <div className={styles.inputGroup}>
              <label htmlFor="admin-password">Password</label>
              <input
                id="admin-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {error && (
              <div className={styles.error} role="alert">
                <WarningCircle size={18} weight="fill" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit" className={styles.submitBtn} disabled={busy}>
              <span>{busy ? 'Authenticating...' : 'Sign in to Console'}</span>
              {!busy && <ArrowRight size={18} weight="bold" />}
            </button>
          </form>
        </div>

        <div className={styles.footer}>
          <p>CitiSense Governance Platform • v2.0</p>
        </div>
      </div>
    </div>
  );
}

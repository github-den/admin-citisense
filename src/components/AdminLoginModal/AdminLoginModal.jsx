import { useState, useEffect } from 'react';
import { Eye, EyeSlash, LockKey, ShieldCheck, X } from '@phosphor-icons/react';
import { useAuth } from '@core/context/AuthContext.jsx';
import styles from './AdminLoginModal.module.css';

export default function AdminLoginModal() {
  const { adminModalOpen, closeAdminModal, handleAdminSignIn } = useAuth();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (adminModalOpen) {
      setPassword('');
      setShowPassword(false);
      setError('');
      setBusy(false);
    }
  }, [adminModalOpen]);

  if (!adminModalOpen) return null;

  async function submit(e) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await handleAdminSignIn(password);
    } catch (err) {
      setError(err.message ?? 'Incorrect password.');
      setBusy(false);
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={closeAdminModal}>
      <div className={styles.modal} onMouseDown={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className={styles.topRow}>
          <div className={styles.brandLockup}>
            <span className={styles.brandMark}>citisense</span>
            <span className={styles.brandSub}>Admin console</span>
          </div>
          <button className={styles.closeBtn} onClick={closeAdminModal} aria-label="Close">
            <X size={18} weight="bold" />
          </button>
        </div>

        <div className={styles.securityCard}>
          <span className={styles.iconWrap}>
            <ShieldCheck size={30} weight="fill" />
          </span>
          <span className={styles.kicker}>Restricted access</span>
          <h2 className={styles.title}>Admin verification</h2>
          <p className={styles.sub}>Enter the admin password to open analytics, moderation, and management tools.</p>
        </div>

        <form className={styles.form} onSubmit={submit}>
          <label className={styles.fieldGroup}>
            <span className={styles.label}>Admin password</span>
            <span className={styles.inputWrap}>
              <LockKey size={17} weight="bold" />
              <input
                className={styles.field}
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoFocus
              />
              <button type="button" className={styles.revealBtn} onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'}>
                {showPassword ? <EyeSlash size={17} weight="bold" /> : <Eye size={17} weight="bold" />}
              </button>
            </span>
          </label>

          {error && <p className={styles.error}>{error}</p>}

          <button className={styles.submitBtn} type="submit" disabled={busy || !password}>
            {busy ? 'Verifying...' : 'Unlock admin console'}
          </button>
        </form>
      </div>
    </div>
  );
}

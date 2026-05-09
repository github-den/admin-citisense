import { useEffect, useState } from 'react';
import { ShieldCheck } from '@phosphor-icons/react';
import AdminApp from './AdminApp.jsx';
import AdminLoginPage from './AdminLoginPage.jsx';
import { useAuth } from '@core/context/AuthContext.jsx';
import { isAdminRole } from '@core/lib/auth/roles.js';
import styles from './AdminRoot.module.css';

function isAdmin(session) {
  return isAdminRole(session);
}

function AdminGate() {
  const { loading, session } = useAuth();
  const [desktopReady, setDesktopReady] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const syncDesktopState = () => setDesktopReady(mediaQuery.matches);

    syncDesktopState();
    mediaQuery.addEventListener('change', syncDesktopState);
    return () => mediaQuery.removeEventListener('change', syncDesktopState);
  }, []);

  if (loading) return null;
  if (!isAdmin(session)) return <AdminLoginPage />;
  if (!desktopReady) {
    return (
      <div className={styles.shell}>
        <div className={styles.card}>
          <div className={styles.iconWrap}>
            <ShieldCheck size={30} weight="fill" />
          </div>
          <div className={styles.kicker}>CitiSense Admin</div>
          <h1 className={styles.title}>Desktop-only admin workspace</h1>
          <p className={styles.body}>
            Bigger responsibilities require bigger screens.
          </p>
        </div>
      </div>
    );
  }
  if (isAdmin(session)) return <AdminApp />;
  return null;
}

export default function AdminRoot() {
  return <AdminGate />;
}

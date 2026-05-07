import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck } from '@phosphor-icons/react';
import AdminApp from './AdminApp.jsx';
import { useAuth } from '@core/context/AuthContext.jsx';
import { isAdminRole } from '@core/lib/auth/roles.js';
import styles from './AdminRoot.module.css';

function isAdmin(session) {
  return isAdminRole(session);
}

function AdminGate() {
  const { loading, session } = useAuth();
  const router = useRouter();
  const [desktopReady, setDesktopReady] = useState(true);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 1024px)');
    const syncDesktopState = () => setDesktopReady(mediaQuery.matches);

    syncDesktopState();
    mediaQuery.addEventListener('change', syncDesktopState);
    return () => mediaQuery.removeEventListener('change', syncDesktopState);
  }, []);

  useEffect(() => {
    if (!loading && !isAdmin(session)) {
      router.push('/admin/login');
    }
  }, [loading, router, session]);

  if (loading) return null;
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

  // Final fallback while redirecting
  return (
    <div className={styles.shell}>
      <div className={styles.card}>
        <div className={styles.iconWrap}>
          <ShieldCheck size={30} weight="fill" />
        </div>
        <div className={styles.kicker}>CitiSense Admin</div>
        <h1 className={styles.title}>Redirecting to login...</h1>
        <p className={styles.body}>
          Please wait while we prepare your secure workspace.
        </p>
      </div>
    </div>
  );
}

export default function AdminRoot() {
  return <AdminGate />;
}

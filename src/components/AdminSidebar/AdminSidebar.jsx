import { SignOut } from '@phosphor-icons/react';
import NavBtn from '../NavBtn/NavBtn.jsx';
import { useAuth } from '@core/context/AuthContext.jsx';
import styles from './AdminSidebar.module.css';

const NAV = [
  { key: 'dashboard', icon: 'SquaresFour', label: 'Dashboard'  },
  { key: 'feedbacks', icon: 'Rows',        label: 'Feedbacks'  },
  { key: 'users',     icon: 'Users',       label: 'Users'      },
  { key: 'feedboxes', icon: 'Archive',     label: 'Feedboxes'  },
  { key: 'analytics', icon: 'ChartBar',    label: 'Analytics'  },
  { key: 'settings',  icon: 'Gear',        label: 'Settings'   },
];

export default function AdminSidebar({ page, setPage }) {
  const { handleSignOut } = useAuth();

  return (
    <nav className={styles.sidebar}>
      <div className={styles.top}>

        {/* Logo */}
        <div className={styles.logoWrap}>
          <div className={styles.logoRow}>
            <span className={styles.logoMark}>citisense</span>
            <span className={styles.adminBadge}>Admin</span>
          </div>
          <div className={styles.logoSub}>Admin Dashboard</div>
        </div>

        {/* Nav */}
        <div className={styles.navLinks}>
          {NAV.map(n => (
            <NavBtn key={n.key} iconName={n.icon} label={n.label}
              active={page === n.key} onClick={() => setPage(n.key)} />
          ))}
        </div>

      </div>

      {/* Bottom — sign out */}
      <div className={styles.bottom}>
        <div className={styles.divider} />
        <button className={styles.logoutBtn} onClick={handleSignOut}>
          <span className={styles.ni}><SignOut size={22} /></span>
          <span>Sign out</span>
        </button>
      </div>
    </nav>
  );
}

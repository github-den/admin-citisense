import { usePathname } from 'next/navigation';
import { SignOut } from '@phosphor-icons/react';
import NavBtn from '../NavBtn/NavBtn.jsx';
import { useAuth } from '@core/context/AuthContext.jsx';
import styles from './AdminSidebar.module.css';

export default function AdminSidebar({ workspace, navBadges = {} }) {
  const { handleSignOut } = useAuth();
  const pathname = usePathname();
  const navItems = workspace?.pages ?? [];

  return (
    <nav className={styles.sidebar}>
      <div className={styles.top}>
        <div className={styles.logoWrap}>
          <div className={styles.logoRow}>
            <span className={styles.logoMark}>citisense</span>
            <div className={styles.identityRole}>{workspace?.roleLabel ?? 'Admin'}</div>
          </div>
        </div>

        <div className={styles.navLinks}>
          {navItems.map((item) => {
            const href = `/${item.key}`;
            const isActive = pathname === href || (pathname === '/' && item.key === 'dashboard');
            return (
              <NavBtn
                key={item.key}
                iconName={item.icon}
                label={item.label}
                href={href}
                active={isActive}
                badgeCount={navBadges[item.key] ?? 0}
              />
            );
          })}
        </div>
      </div>

      <div className={styles.footer}>
        <div className={styles.divider} />
        <div className={styles.accountRow}>
          <span className={styles.accountName}>{workspace?.displayName ?? 'Admin User'}</span>
          <button className={styles.logoutIconBtn} onClick={handleSignOut} aria-label="Logout" title="Logout">
            <span className={styles.ni}><SignOut size={18} /></span>
          </button>
        </div>
      </div>
    </nav>
  );
}

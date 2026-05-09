import AdminSidebar from '../AdminSidebar/AdminSidebar.jsx';
import NavigationLoader from '../NavigationLoader/NavigationLoader.jsx';
import styles from './AdminLayout.module.css';

export default function AdminLayout({ page, setPage, workspace, navBadges, children }) {
  return (
    <div className={styles.frame}>
      <div className={styles.shell}>
        <AdminSidebar
          page={page}
          setPage={setPage}
          workspace={workspace}
          navBadges={navBadges}
        />
        <main className={styles.main}>
          <NavigationLoader />
          {children}
        </main>
      </div>
    </div>
  );
}

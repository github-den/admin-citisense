import AdminSidebar from '../AdminSidebar/AdminSidebar.jsx';
import styles from './AdminLayout.module.css';

export default function AdminLayout({ page, setPage, children }) {
  return (
    <div className={styles.shell}>
      <AdminSidebar page={page} setPage={setPage} />
      <main className={styles.main}>{children}</main>
    </div>
  );
}

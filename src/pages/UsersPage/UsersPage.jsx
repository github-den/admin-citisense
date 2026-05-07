import { useState } from 'react';
import { MagnifyingGlass, ShieldCheck } from '@phosphor-icons/react';
import DataTable from '../../components/DataTable/DataTable.jsx';
import { useAdminUsers } from '@core/hooks/useAdminUsers.js';
import styles from './UsersPage.module.css';

const ROLES = ['citizen', 'moderator', 'admin'];

function getAvatarStyle(src) {
  return typeof src === 'string' && src.startsWith('/avatars/')
    ? { backgroundImage: `url(${src})` }
    : { background: src ?? 'var(--brand)' };
}

export default function UsersPage() {
  const { users, count, loading, page, setPage, changeRole } = useAdminUsers();
  const [query, setQuery] = useState('');

  const visibleUsers = users.filter(user => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [user.username, user.location, user.role]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(q));
  });

  const columns = [
    {
      key: 'avatar',
      label: '',
      width: 58,
      render: r => {
        const imageAvatar = typeof r.avatar === 'string' && r.avatar.startsWith('/avatars/');
        return (
          <div className={`${styles.avatarCell} ${imageAvatar ? styles.avatarImage : ''}`} style={getAvatarStyle(r.avatar)}>
            {!imageAvatar && (r.username?.[0]?.toUpperCase() ?? '?')}
          </div>
        );
      },
    },
    {
      key: 'username',
      label: 'Citizen',
      render: r => (
        <div className={styles.userCell}>
          <strong>{r.username || 'Unnamed citizen'}</strong>
          <span>@{r.username || 'no_username'}</span>
        </div>
      ),
    },
    { key: 'location', label: 'Location', width: 170, render: r => r.location || '-' },
    {
      key: 'role',
      label: 'Role',
      width: 150,
      render: r => (
        <select className={styles.roleSelect} value={r.role ?? 'citizen'} onChange={e => changeRole(r.id, e.target.value)}>
          {ROLES.map(role => <option key={role}>{role}</option>)}
        </select>
      ),
    },
    { key: 'created_at', label: 'Joined', width: 120, render: r => new Date(r.created_at).toLocaleDateString('en-PH') },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Users</h1>
          <span className={styles.count}>{count} registered citizens</span>
        </div>
        <div className={styles.headerBadge}>
          <ShieldCheck size={15} weight="bold" />
          Role control
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <MagnifyingGlass size={16} weight="bold" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search name, username, role..." />
        </div>
      </div>

      <DataTable columns={columns} rows={visibleUsers} loading={loading} empty="No users match your search." />

      <div className={styles.pagination}>
        <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
        <span>Page {page + 1}</span>
        <button disabled={visibleUsers.length === 0} onClick={() => setPage(p => p + 1)}>Next</button>
      </div>
    </div>
  );
}

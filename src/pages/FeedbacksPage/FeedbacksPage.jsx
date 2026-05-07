import { useState } from 'react';
import { FunnelSimple, MagnifyingGlass } from '@phosphor-icons/react';
import DataTable from '../../components/DataTable/DataTable.jsx';
import { useAdminFeed } from '@core/hooks/useAdminFeed.js';
import { POST_STATUSES, STATUS_COLORS } from '@/constants/index.js';
import styles from './FeedbacksPage.module.css';

const STATUS_OPTIONS = ['All', ...Object.values(POST_STATUSES)];
const TYPE_OPTIONS = ['All', 'complaint', 'suggestion', 'compliment'];

function typeColor(t) {
  return t === 'complaint' ? '#F97316' : t === 'suggestion' ? '#D97706' : '#16A34A';
}

export default function FeedbacksPage() {
  const [statusFilter, setStatusFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [query, setQuery] = useState('');

  const filters = {
    status: statusFilter !== 'All' ? statusFilter : undefined,
    type: typeFilter !== 'All' ? typeFilter : undefined,
  };

  const { posts, count, loading, page, setPage, changeStatus } = useAdminFeed(filters);
  const visiblePosts = posts.filter(post => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return [post.content, post.location, post.feedbackNo, post.service, post.type, post.status]
      .filter(Boolean)
      .some(value => String(value).toLowerCase().includes(q));
  });

  const columns = [
    { key: 'feedbackNo', label: 'No.', width: 112 },
    {
      key: 'type',
      label: 'Type',
      width: 122,
      render: r => <span className={styles.typePill} style={{ background: `${typeColor(r.type)}22`, color: typeColor(r.type) }}>{r.type}</span>,
    },
    {
      key: 'content',
      label: 'Content',
      render: r => (
        <span className={styles.contentCell}>
          <strong>{r.service || 'General'}</strong>
          {r.content}
        </span>
      ),
    },
    { key: 'location', label: 'Location', width: 150 },
    {
      key: 'status',
      label: 'Status',
      width: 178,
      render: r => {
        const c = STATUS_COLORS[r.status] ?? {};
        return (
          <select
            className={styles.statusSelect}
            style={{ color: c.color, background: c.bg }}
            value={r.status}
            onChange={e => changeStatus(r.id, e.target.value)}
          >
            {Object.values(POST_STATUSES).map(status => <option key={status}>{status}</option>)}
          </select>
        );
      },
    },
    { key: 'created_at', label: 'Posted', width: 120, render: r => new Date(r.created_at).toLocaleDateString('en-PH') },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Feedbacks</h1>
          <span className={styles.count}>{count} total records</span>
        </div>
        <div className={styles.headerBadge}>
          <FunnelSimple size={15} weight="bold" />
          Moderation queue
        </div>
      </div>

      <div className={styles.toolbar}>
        <div className={styles.searchBox}>
          <MagnifyingGlass size={16} weight="bold" />
          <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search feedback, service, location..." />
        </div>
        <select className={styles.select} value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          {STATUS_OPTIONS.map(s => <option key={s}>{s}</option>)}
        </select>
        <select className={styles.select} value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
          {TYPE_OPTIONS.map(t => <option key={t}>{t}</option>)}
        </select>
      </div>

      <DataTable columns={columns} rows={visiblePosts} loading={loading} empty="No feedbacks match your filters." />

      <div className={styles.pagination}>
        <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
        <span>Page {page + 1}</span>
        <button disabled={visiblePosts.length === 0} onClick={() => setPage(p => p + 1)}>Next</button>
      </div>
    </div>
  );
}


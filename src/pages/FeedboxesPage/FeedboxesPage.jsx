import { useState } from 'react';
import { Archive, Flame, Plus, Trash } from '@phosphor-icons/react';
import { useAdminFeedboxes } from '@core/hooks/useAdminFeedboxes.js';
import DataTable from '../../components/DataTable/DataTable.jsx';
import styles from './FeedboxesPage.module.css';

export default function FeedboxesPage() {
  const { feedboxes, loading, add, remove } = useAdminFeedboxes();
  const [topic, setTopic] = useState('');
  const [service, setService] = useState('');

  async function handleAdd(e) {
    e.preventDefault();
    if (!topic.trim()) return;
    await add(topic.trim(), service.trim() || null);
    setTopic('');
    setService('');
  }

  const columns = [
    {
      key: 'topic',
      label: 'Topic',
      render: r => (
        <div className={styles.topicCell}>
          <strong>{r.topic}</strong>
          <span>{r.service || 'General civic feedback'}</span>
        </div>
      ),
    },
    { key: 'service', label: 'Service', width: 170, render: r => r.service || '-' },
    { key: 'feedback_count', label: 'Feedbacks', width: 120 },
    { key: 'raises_count', label: 'Raises', width: 95 },
    {
      key: 'is_hot',
      label: 'Signal',
      width: 105,
      render: r => r.is_hot ? <span className={styles.hotPill}><Flame size={13} weight="fill" /> Hot</span> : <span className={styles.calmPill}>Normal</span>,
    },
    {
      key: 'actions',
      label: '',
      width: 72,
      render: r => <button className={styles.deleteBtn} onClick={() => remove(r.id)} aria-label={`Delete ${r.topic}`}><Trash size={14}/></button>,
    },
  ];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Feedboxes</h1>
          <span className={styles.count}>{feedboxes.length} topic clusters</span>
        </div>
        <div className={styles.headerBadge}>
          <Archive size={15} weight="bold" />
          Topic intelligence
        </div>
      </div>

      <form className={styles.addForm} onSubmit={handleAdd}>
        <input className={styles.field} placeholder="New topic cluster" value={topic} onChange={e => setTopic(e.target.value)} required />
        <input className={styles.field} placeholder="Service owner (optional)" value={service} onChange={e => setService(e.target.value)} />
        <button className={styles.addBtn} type="submit"><Plus size={15} weight="bold"/> Add feedbox</button>
      </form>

      <DataTable columns={columns} rows={feedboxes} loading={loading} empty="No feedboxes yet." />
    </div>
  );
}

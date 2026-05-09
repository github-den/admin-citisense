import { useMemo, useState } from 'react';
import { 
  ShieldCheck, 
  FileCsv, 
  FilePdf, 
  ClockClockwise,
  ArrowClockwise
} from '@phosphor-icons/react';
import Button from '../../components/ui/Button.jsx';
import { useAdminWorkspace } from '@core/hooks/useAdminWorkspace.js';
import styles from '../../styles/adminWorkspace.module.css';

function buildRoleLogs(workspace) {
  const labels = workspace.isSuperAdmin
    ? ['Reassigned feedback', 'Reviewed citizen report', 'Disabled admin account']
    : workspace.isBarangayAdmin
      ? ['Updated delegated feedback', 'Dismissed feedback', 'Posted official response']
      : ['Verified feedback', 'Transferred feedback', 'Delegated feedback', 'Posted official response'];

  return labels.map((label, index) => ({
    id: `${workspace.role}-${index}`,
    label,
    target: workspace.isSuperAdmin ? `System record ${index + 1}` : `Feedback #${index + 1}`,
    timestamp: new Date(Date.now() - ((index + 1) * 43200000)).toLocaleString('en-PH', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
  }));
}

export default function ActivityLogsPage() {
  const workspace = useAdminWorkspace();
  const [dateFilter, setDateFilter] = useState('all');
  const [actionFilter, setActionFilter] = useState('all');

  const logs = useMemo(() => buildRoleLogs(workspace), [workspace]);

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      <div className={styles.pageHeader}>
        <div className={styles.inlineHeaderMeta}>
          <h1 className={styles.pageTitle}>Activity Logs</h1>
          <span className={styles.headerDivider}>|</span>
          <span className={styles.headerContext}>{workspace.scopeLabel}</span>
        </div>
        <div className={styles.pageActions}>
           <Button variant="ghost" size="md" onClick={() => {}}>
            <ArrowClockwise size={16} weight="bold" />
            Refresh
          </Button>
        </div>
      </div>

      <section className={styles.toolbar}>
        <div className={styles.selectionSummary}>
          <div className={styles.filterRow}>
            <select className={styles.chipSelect} value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
              <option value="all">Any Date</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
            </select>
            <select className={styles.chipSelect} value={actionFilter} onChange={(event) => setActionFilter(event.target.value)}>
              <option value="all">Any Action Type</option>
              <option value="reviewed">Reviewed</option>
              <option value="dismissed">Dismissed</option>
              <option value="responded">Responded</option>
            </select>
            <button type="button" className={styles.clearButton} onClick={() => { setDateFilter('all'); setActionFilter('all'); }}>Clear</button>
          </div>
          <span className={styles.selectionCount}>{logs.length} audit entries</span>
        </div>
        <div className={styles.filterRow}>
          <Button variant="secondary" size="md" onClick={() => window.print()}>
            <FileCsv size={15} weight="duotone" />
            CSV
          </Button>
          <Button variant="secondary" size="md" onClick={() => window.print()}>
            <FilePdf size={15} weight="duotone" />
            PDF
          </Button>
        </div>
      </section>

      <section className={styles.panel} style={{ padding: '24px' }}>
        <div className={styles.timeline}>
          {logs.map((log) => (
            <div key={log.id} className={styles.timelineItem}>
              <div className={styles.timelineIcon}>
                <ClockClockwise size={16} weight="duotone" color="var(--brand)" />
              </div>
              <div className={styles.cellStack}>
                <div className={styles.cellTitle} style={{ fontSize: '14px' }}>{log.label}</div>
                <div className={styles.cellSub} style={{ marginTop: '2px' }}>
                  <span style={{ color: 'var(--ui-text)' }}>{log.target}</span> • {log.timestamp}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

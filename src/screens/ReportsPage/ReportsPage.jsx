import { useMemo, useState } from 'react';
import { 
  Gavel, 
  ShieldCheck, 
  WarningCircle, 
  Eye, 
  Prohibit, 
  UserMinus, 
  CheckCircle,
  FileCsv,
  FilePdf,
  XCircle
} from '@phosphor-icons/react';
import Button from '../../components/ui/Button.jsx';
import SearchInput from '../../components/ui/SearchInput.jsx';
import { useAdminReports } from '@core/hooks/useAdminReports.js';
import { useAdminWorkspace } from '@core/hooks/useAdminWorkspace.js';
import { exportRowsToCsv, exportSectionsToPrint } from '@core/lib/exporters.js';
import { normalizeText } from '@core/lib/adminWorkspace.js';
import { showToast } from '../../components/Toast/Toast.jsx';
import styles from '../../styles/adminWorkspace.module.css';

const REPORT_TYPE_OPTIONS = ['all', 'post', 'comment', 'reply', 'user'];

export default function ReportsPage() {
  const workspace = useAdminWorkspace();
  const { reports, loading } = useAdminReports();
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [dismissedReport, setDismissedReport] = useState(null);
  const [hiddenIds, setHiddenIds] = useState([]);

  const filteredReports = useMemo(() => reports.filter((report) => {
    if (hiddenIds.includes(report.id)) return false;
    if (typeFilter !== 'all' && normalizeText(report.reported_entity_type) !== typeFilter) return false;

    if (dateFilter !== 'all') {
      const timestamp = Date.parse(report.created_at ?? '');
      const days = Number.parseInt(dateFilter, 10);
      if (Number.isFinite(timestamp) && Number.isFinite(days)) {
        const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
        if (timestamp < cutoff) return false;
      }
    }

    const haystack = [
      report.reported_entity_type,
      report.reason,
      report.description,
      report.reported_entity_id,
    ].join(' ').toLowerCase();

    return haystack.includes(query.trim().toLowerCase());
  }), [dateFilter, hiddenIds, query, reports, typeFilter]);

  function clearFilters() {
    setTypeFilter('all');
    setDateFilter('all');
    setQuery('');
  }

  function handleCsvExport() {
    const success = exportRowsToCsv('admin-reports.csv', filteredReports.map((report) => ({
      reported_entity_type: report.reported_entity_type ?? '',
      reported_entity_id: report.reported_entity_id ?? '',
      reason: report.reason ?? '',
      description: report.description ?? '',
      created_at: report.created_at ?? '',
    })));

    if (!success) {
      showToast('No report records are available to export.', 'warning');
      return;
    }

    showToast('Reports export generated as CSV.', 'success');
  }

  function handlePdfExport() {
    const success = exportSectionsToPrint({
      title: 'Super Admin Reports Queue',
      subtitle: `${filteredReports.length} visible reports in the current filter set`,
      sections: filteredReports.slice(0, 16).map((report) => ({
        heading: `${report.reported_entity_type} - ${report.reported_entity_id}`,
        rows: [
          { label: 'Reason', value: report.reason ?? '' },
          { label: 'Description', value: report.description ?? '' },
          { label: 'Created', value: report.created_at ?? '' },
        ],
      })),
    });

    if (!success) {
      showToast('Allow pop-ups first so the printable export can open.', 'warning');
      return;
    }

    showToast('Printable reports export opened in a new window.', 'success');
  }

  function dismissReport(report) {
    setHiddenIds((current) => [...current, report.id]);
    setDismissedReport(report);
    setPendingAction(null);
    showToast('Report dismissed.', 'success', 2500);
  }

  function undoDismiss() {
    if (!dismissedReport) return;
    setHiddenIds((current) => current.filter((id) => id !== dismissedReport.id));
    setDismissedReport(null);
  }

  if (!workspace.isSuperAdmin) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>Reports are reserved for the Super Admin workspace.</div>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      <div className={styles.pageHeader}>
        <div className={styles.inlineHeaderMeta}>
          <h1 className={styles.pageTitle}>Reports</h1>
          <span className={styles.headerDivider}>|</span>
          <span className={styles.headerContext}>Super Admin</span>
        </div>
        <SearchInput
          className={styles.searchControl}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search reports"
        />
      </div>

      {dismissedReport ? (
        <div className={styles.undoStrip}>
          <span>Report dismissed from the list.</span>
          <Button variant="ghost" size="sm" onClick={undoDismiss}>Undo</Button>
        </div>
      ) : null}

      <section className={styles.toolbar}>
        <div className={styles.selectionSummary}>
          <div className={styles.filterRow}>
            <select className={styles.chipSelect} value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              {REPORT_TYPE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option === 'all' ? 'All Types' : option.charAt(0).toUpperCase() + option.slice(1)}</option>
              ))}
            </select>
            <select className={styles.chipSelect} value={dateFilter} onChange={(event) => setDateFilter(event.target.value)}>
              <option value="all">Any Date</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
            <button type="button" className={styles.clearButton} onClick={clearFilters}>Clear</button>
          </div>
          <span className={styles.selectionCount}>{filteredReports.length} reports in queue</span>
        </div>
        <div className={styles.filterRow}>
          <Button variant="secondary" size="md" onClick={handleCsvExport}>
            <FileCsv size={15} weight="duotone" />
            CSV
          </Button>
          <Button variant="secondary" size="md" onClick={handlePdfExport}>
            <FilePdf size={15} weight="duotone" />
            PDF
          </Button>
        </div>
      </section>

      <section className={styles.panel}>
        {loading ? <div className={styles.emptyState}>Loading reports...</div> : null}
        {!loading && !filteredReports.length ? <div className={styles.emptyState}>No reports match the current filters.</div> : null}
        <div className={styles.list}>
          {filteredReports.map((report) => (
            <div key={report.id} className={styles.listItem}>
              <div className={styles.listRow}>
                <div className={styles.cellStack}>
                  <div className={styles.feedbackMeta}>
                    <span className={styles.typePill}>
                      <WarningCircle size={14} weight="duotone" />
                      {report.reported_entity_type}
                    </span>
                    <span className={styles.statusPill}>
                      {report.created_at ? new Date(report.created_at).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' }) : '-'}
                    </span>
                  </div>
                  <div className={styles.cellTitle}>
                    {report.reason || 'No reason provided'}
                  </div>
                  <div className={styles.cellBody}>
                    {report.description || 'No additional description provided.'}
                  </div>
                  <div className={styles.scopeItem} style={{ marginTop: '8px', color: 'var(--ui-text-subtle)' }}>
                     <ShieldCheck size={14} weight="duotone" />
                     <span>Target ID: {report.reported_entity_id || 'Unknown'}</span>
                  </div>
                </div>
                <div className={styles.rowActions}>
                  <Button variant="ghost" size="sm" onClick={() => showToast('Content preview is not connected yet.', 'info', 2500)}>
                    <Eye size={14} weight="duotone" />
                    View
                  </Button>
                  <Button variant="secondary" size="sm" onClick={() => setPendingAction({ reportId: report.id, type: 'suspend' })}>
                    <Prohibit size={14} weight="duotone" />
                    Suspend
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => setPendingAction({ reportId: report.id, type: 'ban' })}>
                    <UserMinus size={14} weight="duotone" />
                    Ban
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => dismissReport(report)}>
                    <CheckCircle size={14} weight="duotone" />
                    Dismiss
                  </Button>
                </div>
              </div>

              {pendingAction?.reportId === report.id ? (
                <div className={styles.confirmRail}>
                  <div className={styles.cellStack}>
                    <div className={styles.cellTitle}>{pendingAction.type === 'ban' ? 'Confirm Account Ban' : 'Confirm Account Suspension'}</div>
                    <div className={styles.cellSub}>
                      {pendingAction.type === 'ban'
                        ? 'This is an irreversible action. The user will be permanently restricted from the platform.'
                        : 'This will temporarily restrict the reported account and flag it for review.'}
                    </div>
                  </div>
                  <div className={styles.rowActions}>
                    <Button variant={pendingAction.type === 'ban' ? 'destructive' : 'secondary'} size="sm" onClick={() => {
                      showToast(`${pendingAction.type === 'ban' ? 'Ban' : 'Suspension'} queued for ${report.reported_entity_id}.`, 'warning', 3000);
                      setPendingAction(null);
                    }}>
                      Confirm Action
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setPendingAction(null)}>
                      <XCircle size={14} weight="duotone" />
                      Cancel
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}


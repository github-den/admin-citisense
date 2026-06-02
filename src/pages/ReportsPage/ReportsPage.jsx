import { useEffect, useMemo, useState } from 'react';
import {
  CaretDown,
  DownloadSimple,
  XCircle,
} from '@phosphor-icons/react';
import AdminDateRangeFilter from '../../components/ui/AdminDateRangeFilter.jsx';
import Button from '../../components/ui/Button.jsx';
import DataTable from '../../components/DataTable/DataTable.jsx';
import Menu from '../../components/ui/Menu.jsx';
import SearchInput from '../../components/ui/SearchInput.jsx';
import { useAdminReports } from '@core/hooks/useAdminReports.js';
import { useAdminWorkspace } from '@core/hooks/useAdminWorkspace.js';
import {
  createPresetAdminDateRange,
  isDefaultAdminDateRange,
  matchesAdminDateRange,
} from '@core/lib/adminDateRange.js';
import { exportSectionsToPrint } from '@core/lib/exporters.js';
import { normalizeText } from '@core/lib/adminWorkspace.js';
import { showToast } from '../../components/Toast/Toast.jsx';
import styles from '../../styles/adminWorkspace.module.css';

const REPORT_TYPE_OPTIONS = [
  { value: 'all', label: 'All types' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'discussion', label: 'Discussion' },
  { value: 'reply', label: 'Reply' },
];
const PAGE_SIZE = 10;

function createMenuItems(options, currentValue, onChange) {
  return options.map((option) => ({
    key: String(option.value),
    label: option.label,
    active: currentValue === option.value,
    onClick: () => onChange(option.value),
  }));
}

function formatReportTypeLabel(value) {
  const normalized = normalizeText(value);
  if (normalized === 'feedback' || normalized === 'post') return 'Feedback';
  if (normalized === 'discussion' || normalized === 'comment') return 'Discussion';
  if (normalized === 'reply') return 'Reply';
  return String(value ?? '').trim() || 'Unknown';
}

function formatReportDate(value) {
  const timestamp = Date.parse(value ?? '');
  if (!Number.isFinite(timestamp)) return '-';
  return new Date(timestamp).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function getReportPreview(report) {
  const selectedFlags = Array.isArray(report.selected_flags)
    ? report.selected_flags.map((flag) => String(flag ?? '').trim()).filter(Boolean)
    : [];
  const selectedFlagsLabel = selectedFlags.length ? `Selected flags: ${selectedFlags.join(', ')}` : '';
  const content = String(report.description ?? selectedFlagsLabel).replace(/\s+/g, ' ').trim();
  if (!content) return 'No description provided.';
  if (content.length <= 140) return content;
  return `${content.slice(0, 140).trimEnd()}...`;
}

function normalizeReasonLabel(value) {
  const reason = String(value ?? '').trim();
  return reason || 'No reason provided';
}

function getReasonLabel(report) {
  const selectedFlags = Array.isArray(report.selected_flags)
    ? report.selected_flags.map((flag) => String(flag ?? '').trim()).filter(Boolean)
    : [];
  if (selectedFlags.length > 0) return selectedFlags.join(', ');
  return normalizeReasonLabel(report.reason);
}

export default function ReportsPage() {
  const workspace = useAdminWorkspace();
  const { reports, loading } = useAdminReports();
  const [typeFilter, setTypeFilter] = useState('all');
  const [reasonFilter, setReasonFilter] = useState('all');
  const [dateRange, setDateRange] = useState(() => createPresetAdminDateRange('all'));
  const [query, setQuery] = useState('');
  const [pendingAction, setPendingAction] = useState(null);
  const [dismissedReport, setDismissedReport] = useState(null);
  const [hiddenIds, setHiddenIds] = useState([]);
  const [page, setPage] = useState(0);
  const [pageInput, setPageInput] = useState('1');

  const reportNumbers = useMemo(() => new Map(
    reports.map((report, index) => [String(report.id), String(index + 1).padStart(3, '0')]),
  ), [reports]);

  const reasonOptions = useMemo(() => {
    const uniqueReasons = Array.from(new Set(
      reports
        .map((report) => getReasonLabel(report))
        .filter(Boolean),
    )).sort((left, right) => left.localeCompare(right));

    return [
      { value: 'all', label: 'All reasons' },
      ...uniqueReasons.map((reason) => ({ value: reason, label: reason })),
    ];
  }, [reports]);

  const hasActiveFilters = Boolean(
    query.trim()
    || typeFilter !== 'all'
    || reasonFilter !== 'all'
    || !isDefaultAdminDateRange(dateRange),
  );

  const filteredReports = useMemo(() => {
    const normalizedQuery = normalizeText(query);

    return reports.filter((report) => {
      if (hiddenIds.includes(report.id)) return false;

      const normalizedType = normalizeText(report.normalizedType ?? report.reported_entity_type);
      if (typeFilter !== 'all' && normalizedType !== typeFilter) return false;

      const reasonLabel = getReasonLabel(report);
      if (reasonFilter !== 'all' && reasonLabel !== reasonFilter) return false;

      if (!matchesAdminDateRange(report.created_at, dateRange)) {
        return false;
      }

      if (!normalizedQuery) return true;
      const reportNumber = normalizeText(reportNumbers.get(String(report.id)));
      return reportNumber.includes(normalizedQuery);
    });
  }, [dateRange, hiddenIds, query, reasonFilter, reportNumbers, reports, typeFilter]);

  const pagedReports = filteredReports.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const totalRecords = filteredReports.length;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const reportsEmptyLabel = hasActiveFilters ? 'No reports match the current filters.' : 'No reports yet';

  useEffect(() => {
    setPage(0);
  }, [dateRange, query, reasonFilter, typeFilter]);

  useEffect(() => {
    setPageInput(String(Math.min(page + 1, totalPages || 1)));
  }, [page, totalPages]);

  function clearFilters() {
    setTypeFilter('all');
    setReasonFilter('all');
    setDateRange(createPresetAdminDateRange('all'));
    setQuery('');
  }

  function buildExportRows(rows) {
    return rows.map((report) => ({
      report_number: reportNumbers.get(String(report.id)) ?? '',
      type: formatReportTypeLabel(report.reported_entity_type),
      username: report.username ?? 'Unknown user',
      reason: getReasonLabel(report),
      description: report.description ?? '',
      reported_at: formatReportDate(report.created_at),
    }));
  }

  function handleExport(scope, format) {
    const rows = scope === 'current' ? pagedReports : filteredReports;
    const success = exportSectionsToPrint({
      title: 'Reports Queue',
      subtitle: `${rows.length} visible reports in the current ${scope === 'current' ? 'page' : 'filter set'}`,
      sections: rows.slice(0, 16).map((report) => ({
        heading: `Report ${reportNumbers.get(String(report.id)) ?? '---'} / ${formatReportTypeLabel(report.reported_entity_type)}`,
        rows: [
          { label: 'Username', value: report.username ?? 'Unknown user' },
          { label: 'Reason', value: getReasonLabel(report) },
          { label: 'Description', value: report.description ?? '' },
          { label: 'Created', value: formatReportDate(report.created_at) },
        ],
      })),
    });

    if (!success) {
      showToast(
        'Allow pop-ups first so the printable export can open.',
        'warning',
      );
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

  function commitPageInput(value) {
    const parsed = Number.parseInt(String(value ?? '').trim(), 10);
    if (!Number.isFinite(parsed)) {
      setPageInput(String(Math.min(page + 1, totalPages)));
      return;
    }

    const clamped = Math.min(Math.max(parsed, 1), totalPages);
    setPage(clamped - 1);
    setPageInput(String(clamped));
  }

  const exportMenuItems = [
    {
      key: 'export-all',
      label: 'All',
      items: [
        { key: 'export-all-xlsx', label: 'EXCEL', onClick: () => handleExport('all', 'xlsx') },
        { key: 'export-all-pdf', label: 'PDF', onClick: () => handleExport('all', 'pdf') },
      ],
    },
    {
      key: 'export-current',
      label: 'Current page',
      items: [
        { key: 'export-current-xlsx', label: 'EXCEL', onClick: () => handleExport('current', 'xlsx') },
        { key: 'export-current-pdf', label: 'PDF', onClick: () => handleExport('current', 'pdf') },
      ],
    },
  ];

  const columns = [
    {
      key: 'no',
      label: 'NO.',
      width: 64,
      render: (report) => (
        <span className={styles.feedbackNumber}>{reportNumbers.get(String(report.id)) ?? '---'}</span>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: 110,
      render: (report) => (
        <span className={styles.cellBody}>{formatReportTypeLabel(report.reported_entity_type)}</span>
      ),
    },
    {
      key: 'username',
      label: 'Username',
      width: 170,
      render: (report) => (
        <span className={styles.cellBody}>{report.username ?? 'Unknown user'}</span>
      ),
    },
    {
      key: 'reason',
      label: 'Reason',
      width: 210,
      render: (report) => <span className={styles.cellBody}>{getReasonLabel(report)}</span>,
    },
    {
      key: 'preview',
      label: 'Description',
      render: (report) => <span className={styles.feedbackPreview}>{getReportPreview(report)}</span>,
    },
    {
      key: 'reported_at',
      label: 'Reported',
      width: 120,
      render: (report) => <span className={styles.cellBody}>{formatReportDate(report.created_at)}</span>,
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 96,
      render: (report) => (
        <div className={styles.actionColumn}>
          <button
            type="button"
            className={styles.actionLink}
            onClick={() => showToast('Content preview is not connected yet.', 'info', 2500)}
          >
            View
          </button>
          <button
            type="button"
            className={styles.actionLink}
            onClick={() => setPendingAction({ report, type: 'suspend' })}
          >
            Suspend
          </button>
          <button
            type="button"
            className={styles.actionLink}
            onClick={() => setPendingAction({ report, type: 'ban' })}
          >
            Ban
          </button>
          <button
            type="button"
            className={styles.actionLink}
            onClick={() => dismissReport(report)}
          >
            Dismiss
          </button>
        </div>
      ),
    },
  ];

  if (!workspace.isSuperAdmin) {
    return (
      <div className={styles.page}>
        <div className={styles.emptyState}>Reports are reserved for the Super Admin workspace.</div>
      </div>
    );
  }

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      <div className={`${styles.pageHeader} ${styles.reportsHeader}`}>
        <div className={styles.inlineHeaderMeta}>
          <h1 className={styles.pageTitle}>Reports</h1>
        </div>
        <SearchInput
          className={`${styles.searchControl} ${styles.reportsSearchControl}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search report number"
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
          <Menu
            align="start"
            items={exportMenuItems}
            trigger={(
              <Button variant="secondary" size="md">
                <DownloadSimple size={15} weight="bold" />
                Export
              </Button>
            )}
          />
          <span className={styles.selectionCount}>{filteredReports.length} reports in queue</span>
        </div>

        <div className={styles.filterRow}>
          <Menu
            align="start"
            items={createMenuItems(REPORT_TYPE_OPTIONS, typeFilter, setTypeFilter)}
            trigger={(
              <Button
                variant="secondary"
                size="md"
                className={`${styles.filterMenuTrigger} ${typeFilter !== 'all' ? styles.filterMenuTriggerActive : ''}`}
              >
                Type
                <CaretDown size={12} weight="bold" />
              </Button>
            )}
          />

          <Menu
            align="start"
            items={createMenuItems(reasonOptions, reasonFilter, setReasonFilter)}
            trigger={(
              <Button
                variant="secondary"
                size="md"
                className={`${styles.filterMenuTrigger} ${reasonFilter !== 'all' ? styles.filterMenuTriggerActive : ''}`}
              >
                Reason
                <CaretDown size={12} weight="bold" />
              </Button>
            )}
          />

          <AdminDateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            align="end"
            className={`${styles.filterMenuTrigger} ${!isDefaultAdminDateRange(dateRange) ? styles.filterMenuTriggerActive : ''}`}
          />

          <Button
            variant="secondary"
            size="md"
            type="button"
            onClick={clearFilters}
            className={`${styles.filterMenuTrigger} ${hasActiveFilters ? styles.filterMenuTriggerActive : styles.filterMenuTriggerMuted}`}
            aria-disabled={!hasActiveFilters}
          >
            Clear all
          </Button>
        </div>
      </section>

      <section className={styles.tablePanel}>
        <DataTable
          columns={columns}
          rows={pagedReports}
          loading={loading}
          minWidth={980}
          empty={reportsEmptyLabel}
          showEmptyTable
          emptyRowCount={10}
        />
      </section>

      {totalRecords > 0 ? (
        <div className={styles.resultsFooter}>
          <div className={styles.pagination}>
            <Button variant="secondary" size="sm" onClick={() => setPage((current) => Math.max(current - 1, 0))} disabled={page === 0}>
              Prev
            </Button>
            <span className={styles.paginationLabel}>Page</span>
            <input
              type="text"
              inputMode="numeric"
              className={styles.pageInput}
              value={pageInput}
              onChange={(event) => setPageInput(event.target.value.replace(/[^\d]/g, '').slice(0, 4))}
              onBlur={() => setPageInput(String(Math.min(page + 1, totalPages)))}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  commitPageInput(pageInput);
                }
              }}
              aria-label="Go to page"
            />
            <span>of {totalPages}</span>
            <Button variant="secondary" size="sm" onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))} disabled={page + 1 >= totalPages}>
              Next
            </Button>
          </div>
          <div className={styles.resultsMeta}>
            Showing results {pagedReports.length} out of {totalRecords}
          </div>
        </div>
      ) : null}

      {pendingAction ? (
        <div className={styles.modalOverlay}>
          <button type="button" className={styles.modalBackdrop} onClick={() => setPendingAction(null)} aria-label="Close report action confirmation" />
          <div className={`${styles.modalSurface} ${styles.modalSurfaceConfirm}`}>
            <div className={styles.modalHeader}>
              <div>
                <div className={styles.panelTitle}>{pendingAction.type === 'ban' ? 'Confirm Account Ban' : 'Confirm Account Suspension'}</div>
                <div className={styles.panelMeta}>{pendingAction.report.username ?? pendingAction.report.reported_entity_id ?? 'Unknown user'}</div>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setPendingAction(null)}>
                <XCircle size={18} weight="duotone" />
              </Button>
            </div>
            <div className={styles.cellBody}>
              {pendingAction.type === 'ban'
                ? 'This is an irreversible action. The user will be permanently restricted from the platform.'
                : 'This will temporarily restrict the reported account and flag it for review.'}
            </div>
            <div className={styles.modalActions}>
              <Button
                variant={pendingAction.type === 'ban' ? 'destructive' : 'secondary'}
                size="md"
                onClick={() => {
                  const targetLabel = pendingAction.report.username ?? pendingAction.report.reported_entity_id ?? 'the selected account';
                  showToast(`${pendingAction.type === 'ban' ? 'Ban' : 'Suspension'} queued for ${targetLabel}.`, 'warning', 3000);
                  setPendingAction(null);
                }}
              >
                Confirm Action
              </Button>
              <Button variant="ghost" size="md" onClick={() => setPendingAction(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

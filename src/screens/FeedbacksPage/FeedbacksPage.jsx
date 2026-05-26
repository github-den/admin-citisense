import { useEffect, useMemo, useState } from 'react';
import { CalendarBlank, CaretDown, ChartDonut, Clock, ClockCountdown, DownloadSimple, HandHeart, Lightbulb, MapPin, Star, Tag, Warning, X } from '@phosphor-icons/react';
import AdminDateRangeFilter from '../../components/ui/AdminDateRangeFilter.jsx';
import DataTable from '../../components/DataTable/DataTable.jsx';
import Button from '../../components/ui/Button.jsx';
import Menu from '../../components/ui/Menu.jsx';
import SearchInput from '../../components/ui/SearchInput.jsx';
import Tooltip from '../../components/ui/Tooltip.jsx';
import { POST_TYPES, URDANETA_BARANGAYS } from '../../constants/index.js';
import { useAdminWorkspace } from '@core/hooks/useAdminWorkspace.js';
import { useAdminFeed } from '@core/hooks/useAdminFeed.js';
import { useAdminReports } from '@core/hooks/useAdminReports.js';
import { getAdminPosts } from '@core/services/admin.js';
import {
  composeStatus,
  deriveResolutionStatus,
  deriveVerificationStatus,
  filterByDateRange,
  getOfficeForService,
  normalizeText,
  scopePostsToWorkspace,
} from '@core/lib/adminWorkspace.js';
import { createPresetAdminDateRange, isDefaultAdminDateRange } from '@core/lib/adminDateRange.js';
import { exportRowsToCsv, exportRowsToXlsx } from '@core/lib/exporters.js';
import { showToast } from '../../components/Toast/Toast.jsx';
import styles from '../../styles/adminWorkspace.module.css';

const VERIFICATION_OPTIONS = ['All', 'Under Review', 'Verified', 'Dismissed'];
const RESOLUTION_OPTIONS = ['All', 'Not Started', 'In Progress', 'On Hold', 'Resolved'];
const RESOLUTION_FILTER_OPTIONS = ['All', 'In Progress', 'On Hold', 'Resolved'];
const TYPE_OPTIONS = [
  { value: 'All', label: 'All' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'suggestion', label: 'Suggestion' },
  { value: 'compliment', label: 'Compliment' },
];
const TYPE_META = {
  complaint: { label: 'Complaint', Icon: Warning, toneClass: styles.typeComplaint },
  suggestion: { label: 'Suggestion', Icon: Lightbulb, toneClass: styles.typeSuggestion },
  compliment: { label: 'Compliment', Icon: Star, toneClass: styles.typeCompliment },
};
const PAGE_SIZE = 10;
const COMPLAINT_REVIEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function getDisplayFeedbackNo(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return 'Pending number';
  return normalized.replace(/^#/, '').replace(/^\d{4}-/, '');
}

function formatCompactDuration(ms) {
  const totalHours = Math.max(1, Math.ceil(Math.abs(ms) / 36e5));
  if (totalHours < 24) return `${totalHours} hr`;

  const totalDays = Math.ceil(totalHours / 24);
  if (totalDays < 14) return `${totalDays} d`;

  return `${Math.ceil(totalDays / 7)} w`;
}

function formatResponseWindow(post) {
  if (normalizeText(post.type) !== 'complaint') return 'N/A';

  const createdAt = Date.parse(post.created_at ?? '');
  if (!Number.isFinite(createdAt)) return 'N/A';

  if (post.verificationStatus !== 'Under Review') return 'Reviewed';

  const remainingMs = (createdAt + COMPLAINT_REVIEW_WINDOW_MS) - Date.now();
  return remainingMs >= 0
    ? `${formatCompactDuration(remainingMs)} left`
    : `${formatCompactDuration(remainingMs)} overdue`;
}

function formatDateTime(value) {
  const timestamp = Date.parse(value ?? '');
  if (!Number.isFinite(timestamp)) return '-';

  return new Date(timestamp).toLocaleString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function formatDate(value) {
  const timestamp = Date.parse(value ?? '');
  if (!Number.isFinite(timestamp)) return '-';
  return new Date(timestamp).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTime(value) {
  const timestamp = Date.parse(value ?? '');
  if (!Number.isFinite(timestamp)) return '-';
  return new Date(timestamp).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function getPreviewText(content) {
  const clean = String(content ?? '').replace(/\s+/g, ' ').trim();
  if (!clean) return 'No content available.';
  if (clean.length <= 500) return clean;
  return `${clean.slice(0, 500).trimEnd()}...`;
}

function isPostReport(report) {
  return ['post', 'feedback'].includes(normalizeText(report.normalizedType ?? report.reported_entity_type));
}

function buildReportLookup(reports) {
  const lookup = new Map();
  reports.filter(isPostReport).forEach((report) => {
    const key = String(report.reported_entity_id ?? '');
    const current = lookup.get(key) ?? { count: 0, reasons: [], handles: [] };
    current.count += 1;
    if (Array.isArray(report.selected_flags) && report.selected_flags.length > 0) {
      current.reasons.push(...report.selected_flags.map((flag) => String(flag ?? '').trim()).filter(Boolean));
    } else if (report.reason) {
      current.reasons.push(report.reason);
    }
    if (report.reporter_id) current.handles.push(`@${String(report.reporter_id).slice(0, 8)}`);
    lookup.set(key, current);
  });
  return lookup;
}

function computeAiFlag(post, reportMeta) {
  const content = normalizeText(post.content);
  const suspiciousKeywords = ['urgent', 'scam', 'fake', 'fraud', 'hack'];
  const hasSuspiciousLanguage = suspiciousKeywords.some((keyword) => content.includes(keyword));
  return reportMeta.count > 0 || hasSuspiciousLanguage || Number(post.reviewRejectionCount ?? 0) > 0;
}

function buildAiFlagReason(post, reportCount) {
  if (reportCount > 0) return `${reportCount} report${reportCount === 1 ? '' : 's'} linked to this feedback.`;
  if (Number(post.reviewRejectionCount ?? 0) > 0) return 'Previous review rejection found.';
  return 'Potentially suspicious wording detected.';
}

function getTypeLabel(type) {
  const config = POST_TYPES[normalizeText(type)];
  return config?.label ?? (String(type ?? '').trim() || 'General');
}

function getTypeMeta(type) {
  return TYPE_META[normalizeText(type)] ?? TYPE_META.complaint;
}

function getDisplayHandle(value) {
  const normalized = String(value ?? '').trim();
  if (!normalized) return 'Unknown user';
  return normalized.replace(/^@+/, '');
}

function isComplaintFeedback(post) {
  return normalizeText(post?.type) === 'complaint';
}

function getStatusLabel(post) {
  if (post.verificationStatus === 'Verified') {
    return post.resolutionStatus && post.resolutionStatus !== 'Not Started'
      ? `${post.verificationStatus} / ${post.resolutionStatus}`
      : post.verificationStatus;
  }

  return post.verificationStatus;
}

function createMenuItems(options, currentValue, onChange, valueMap = null) {
  return options.map((option) => {
    const value = valueMap ? valueMap(option) : (typeof option === 'string' ? option : option.value);
    const label = typeof option === 'string' ? option : option.label;
    return {
      key: String(value),
      label,
      active: currentValue === value,
      onClick: () => onChange(value),
    };
  });
}

function createStatusMenuItems({
  verificationFilter,
  resolutionFilter,
  setVerificationFilter,
  setResolutionFilter,
}) {
  return [
    {
      key: 'verification-all',
      label: 'All',
      active: verificationFilter === 'All' && resolutionFilter === 'All',
      onClick: () => {
        setVerificationFilter('All');
        setResolutionFilter('All');
      },
    },
    {
      key: 'verification-under-review',
      label: 'Under Review',
      active: verificationFilter === 'Under Review',
      onClick: () => {
        setVerificationFilter('Under Review');
        setResolutionFilter('All');
      },
    },
    {
      key: 'verification-verified',
      label: 'Verified',
      active: verificationFilter === 'Verified',
      items: [
        { key: 'resolution-label', type: 'label', label: 'Resolution Status' },
        ...RESOLUTION_FILTER_OPTIONS.map((option) => ({
          key: `resolution-${option.toLowerCase().replace(/\s+/g, '-')}`,
          label: option,
          active: verificationFilter === 'Verified' && resolutionFilter === option,
          onClick: () => {
            setVerificationFilter('Verified');
            setResolutionFilter(option);
          },
        })),
      ],
    },
    {
      key: 'verification-dismissed',
      label: 'Dismissed',
      active: verificationFilter === 'Dismissed',
      onClick: () => {
        setVerificationFilter('Dismissed');
        setResolutionFilter('All');
      },
    },
  ];
}

export default function FeedbacksPage() {
  const workspace = useAdminWorkspace();
  const [query, setQuery] = useState('');
  const [verificationFilter, setVerificationFilter] = useState('All');
  const [resolutionFilter, setResolutionFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [dateRange, setDateRange] = useState(() => createPresetAdminDateRange('all'));
  const [serviceFilter, setServiceFilter] = useState('all');
  const [barangayFilter, setBarangayFilter] = useState('all');
  const [page, setPage] = useState(0);
  const [selectedPostId, setSelectedPostId] = useState(null);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [dismissReasonDraft, setDismissReasonDraft] = useState('');
  const [dismissMode, setDismissMode] = useState(false);
  const [responseDrafts, setResponseDrafts] = useState({});
  const [routingDrafts, setRoutingDrafts] = useState({});
  const [selectedPostIds, setSelectedPostIds] = useState([]);
  const [pageInput, setPageInput] = useState('1');
  const hasActiveFilters = Boolean(
    query.trim()
    || verificationFilter !== 'All'
    || resolutionFilter !== 'All'
    || typeFilter !== 'All'
    || !isDefaultAdminDateRange(dateRange)
    || serviceFilter !== 'all'
    || barangayFilter !== 'all'
  );
  const isFilteredView = Boolean(
    hasActiveFilters
  );
  const feedFilters = useMemo(() => ({
    page: isFilteredView ? 0 : page,
    limit: isFilteredView ? undefined : PAGE_SIZE,
  }), [isFilteredView, page]);
  const { posts, count, loading, changeStatus, reload } = useAdminFeed(feedFilters);
  const { reports } = useAdminReports();

  useEffect(() => {
    setPage(0);
  }, [barangayFilter, dateRange, query, resolutionFilter, serviceFilter, typeFilter, verificationFilter]);

  const reportLookup = useMemo(() => buildReportLookup(reports), [reports]);

  const enrichedPosts = useMemo(() => {
    const scoped = scopePostsToWorkspace(posts, workspace);
    return scoped.map((post) => {
      const reportMeta = reportLookup.get(String(post.id)) ?? { count: 0, reasons: [], handles: [] };
      return {
        ...post,
        reportCount: reportMeta.count,
        reportReasons: reportMeta.reasons,
        reportHandles: reportMeta.handles,
        verificationStatus: deriveVerificationStatus(post.status),
        resolutionStatus: deriveResolutionStatus(post.status),
        office: getOfficeForService(post.service) ?? 'Unassigned office',
        aiFlagged: computeAiFlag(post, reportMeta),
        aiFlagReason: buildAiFlagReason(post, reportMeta.count),
      };
    });
  }, [posts, reportLookup, workspace]);

  const officeOptions = useMemo(() => Array.from(new Set(enrichedPosts.map((post) => post.office).filter(Boolean))).sort(), [enrichedPosts]);
  const serviceOptions = useMemo(
    () => Array.from(new Set(enrichedPosts.map((post) => post.service).filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b))),
    [enrichedPosts],
  );
  const barangayOptions = useMemo(() => URDANETA_BARANGAYS, []);
  const filteredPosts = useMemo(() => {
    let next = filterByDateRange(enrichedPosts, dateRange);

    if (verificationFilter !== 'All') next = next.filter((post) => post.verificationStatus === verificationFilter);
    if (resolutionFilter !== 'All') next = next.filter((post) => post.resolutionStatus === resolutionFilter);
    if (typeFilter !== 'All') next = next.filter((post) => normalizeText(post.type) === normalizeText(typeFilter));
    if (workspace.isSuperAdmin && serviceFilter !== 'all') next = next.filter((post) => post.service === serviceFilter);
    if (!workspace.isBarangayAdmin && barangayFilter !== 'all') next = next.filter((post) => post.location === barangayFilter);
    const normalizedQuery = normalizeText(query);
    if (normalizedQuery) {
      next = next.filter((post) => [
        post.feedbackNo,
        post.content,
        post.service,
        post.location,
        post.office,
        post.type,
        post.status,
      ].some((value) => normalizeText(value).includes(normalizedQuery)));
    }

    return next;
  }, [barangayFilter, dateRange, enrichedPosts, query, resolutionFilter, serviceFilter, typeFilter, verificationFilter, workspace.isBarangayAdmin, workspace.isSuperAdmin]);

  const pagedPosts = isFilteredView
    ? filteredPosts.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE)
    : filteredPosts;
  const totalRecords = isFilteredView ? filteredPosts.length : count;
  const totalPages = Math.max(1, Math.ceil(totalRecords / PAGE_SIZE));
  const selectedPost = filteredPosts.find((post) => post.id === selectedPostId) ?? null;
  const visiblePostIds = pagedPosts.map((post) => String(post.id));
  const allVisibleSelected = visiblePostIds.length > 0 && visiblePostIds.every((id) => selectedPostIds.includes(id));
  const selectedPosts = useMemo(
    () => filteredPosts.filter((post) => selectedPostIds.includes(String(post.id))),
    [filteredPosts, selectedPostIds],
  );
  const feedbacksEmptyLabel = hasActiveFilters ? 'No feedback records match your current filters.' : 'No feedbacks yet';

  useEffect(() => {
    setPageInput(String(Math.min(page + 1, totalPages || 1)));
  }, [page, totalPages]);

  useEffect(() => {
    if (!selectedPost && selectedPostId != null) {
      setSelectedPostId(null);
      setDismissMode(false);
      setReportsOpen(false);
    }
  }, [selectedPost, selectedPostId]);

  useEffect(() => {
    if (selectedPost) {
      setDismissReasonDraft('');
    }
  }, [selectedPostId]);

  useEffect(() => {
    if (!isFilteredView) return;
    setSelectedPostIds((current) => current.filter((id) => filteredPosts.some((post) => String(post.id) === id)));
  }, [filteredPosts, isFilteredView]);

  async function handleStatusPatch(post, nextVerification, nextResolution) {
    if (!isComplaintFeedback(post)) {
      showToast('Only complaint feedback can be updated.', 'warning');
      return;
    }

    try {
      const nextStatus = composeStatus(nextVerification, nextResolution);
      await changeStatus(post.id, nextStatus);
      showToast(`Feedback ${post.feedbackNo ?? ''} updated to ${nextStatus}.`, 'success');
      await reload();
    } catch (error) {
      showToast(error?.message ?? 'Unable to update the feedback status right now.', 'error');
    }
  }

  async function handleDismiss(post) {
    if (!isComplaintFeedback(post)) {
      showToast('Only complaint feedback can be updated.', 'warning');
      return;
    }

    if (!dismissReasonDraft.trim()) return;
    await handleStatusPatch(post, 'Dismissed', post.resolutionStatus);
    showToast('Dismissal reason saved locally for this session.', 'info', 3000);
    setDismissMode(false);
  }

  function handleResponseSave(post) {
    if (!isComplaintFeedback(post)) {
      showToast('Only complaint feedback can be updated.', 'warning');
      return;
    }

    const draft = responseDrafts[post.id] ?? '';
    if (!draft.trim()) return;
    showToast('Pinned response saved locally.', 'info', 3000);
  }

  function handleRouteAction(post, type) {
    const draft = routingDrafts[post.id] ?? {};
    const destination = type === 'delegate' ? draft.barangay : type === 'transferOffice' ? draft.office : type === 'reassignOffice' ? draft.office : draft.barangay;
    if (!destination || !String(destination).trim()) return;
    const message = type === 'delegate'
      ? `Delegation queued for ${destination}.`
      : type === 'transferOffice'
        ? `Transfer queued for ${destination}.`
        : `Reassignment queued for ${destination}.`;
    showToast(message, 'info', 3000);
  }

  function clearFilters() {
    setVerificationFilter('All');
    setResolutionFilter('All');
    setTypeFilter('All');
    setDateRange(createPresetAdminDateRange('all'));
    setServiceFilter('all');
    setBarangayFilter('all');
    setQuery('');
  }

  function buildExportRows(rows) {
    return rows.map((post) => ({
      feedback_no: post.feedbackNo ?? '',
      type: getTypeLabel(post.type),
      service_category: post.service ?? '',
      office: post.office ?? '',
      incident_location: post.location ?? '',
      submitted_at: formatDateTime(post.created_at),
      verification_status: post.verificationStatus,
      resolution_status: post.resolutionStatus,
      report_count: post.reportCount,
      ai_flagged: post.aiFlagged ? 'yes' : 'no',
    }));
  }

  async function resolveExportPosts(scope) {
    if (scope === 'selected') return selectedPosts;
    if (scope === 'current') return pagedPosts;
    if (isFilteredView) return filteredPosts;

    const result = await getAdminPosts();
    return scopePostsToWorkspace(result.data ?? [], workspace);
  }

  async function handleExport(scope, format) {
    try {
      const rows = await resolveExportPosts(scope);
      const exportRows = buildExportRows(rows);
      const filename = `feedbacks-${scope}.${format}`;
      const success = format === 'csv'
        ? exportRowsToCsv(filename, exportRows)
        : exportRowsToXlsx(filename, exportRows, 'Feedbacks');

      if (!success) {
        showToast('No feedback records are available to export.', 'warning');
        return;
      }

      showToast(`Feedback export generated as ${format.toUpperCase()}.`, 'success');
    } catch (error) {
      showToast(error?.message ?? 'Unable to prepare the export right now.', 'error');
    }
  }

  function toggleRowSelection(postId) {
    const normalizedId = String(postId);
    setSelectedPostIds((current) => (
      current.includes(normalizedId)
        ? current.filter((id) => id !== normalizedId)
        : [...current, normalizedId]
    ));
  }

  function toggleSelectAllVisible() {
    setSelectedPostIds((current) => {
      if (allVisibleSelected) {
        return current.filter((id) => !visiblePostIds.includes(id));
      }

      return Array.from(new Set([...current, ...visiblePostIds]));
    });
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
        { key: 'export-all-csv', label: 'CSV', onClick: () => handleExport('all', 'csv') },
        { key: 'export-all-xlsx', label: 'XLSX', onClick: () => handleExport('all', 'xlsx') },
      ],
    },
    {
      key: 'export-current',
      label: 'Current page',
      items: [
        { key: 'export-current-csv', label: 'CSV', onClick: () => handleExport('current', 'csv') },
        { key: 'export-current-xlsx', label: 'XLSX', onClick: () => handleExport('current', 'xlsx') },
      ],
    },
    ...(selectedPosts.length ? [{
      key: 'export-selected',
      label: 'Selected',
      items: [
        { key: 'export-selected-csv', label: 'CSV', onClick: () => handleExport('selected', 'csv') },
        { key: 'export-selected-xlsx', label: 'XLSX', onClick: () => handleExport('selected', 'xlsx') },
      ],
    }] : []),
  ];

  const columns = [
    {
      key: 'select',
      label: (
        <input
          type="checkbox"
          className={styles.tableCheckbox}
          aria-label="Select all visible feedback"
          checked={allVisibleSelected}
          onChange={toggleSelectAllVisible}
        />
      ),
      width: 40,
      render: (post) => (
        <input
          type="checkbox"
          className={styles.tableCheckbox}
          aria-label={`Select ${post.feedbackNo ?? 'feedback record'}`}
          checked={selectedPostIds.includes(String(post.id))}
          onChange={() => toggleRowSelection(post.id)}
        />
      ),
    },
    {
      key: 'feedback_no',
      label: 'NO.',
      width: 60,
      render: (post) => (
        <button type="button" className={styles.tableTrigger} onClick={() => setSelectedPostId(post.id)}>
          <span className={styles.feedbackNumber}>{getDisplayFeedbackNo(post.feedbackNo)}</span>
        </button>
      ),
    },
    {
      key: 'type',
      label: 'Type',
      width: 120,
      render: (post) => {
        const typeMeta = getTypeMeta(post.type);
        return (
          <span className={`${styles.typeText} ${typeMeta.toneClass}`}>
            <typeMeta.Icon size={14} weight="duotone" aria-hidden="true" />
            <span>{typeMeta.label}</span>
          </span>
        );
      },
    },
    {
      key: 'citizen',
      label: 'Citizen',
      width: 140,
      render: (post) => (
        <span className={styles.feedbackMetaRow}>
          {getDisplayHandle(post.handle)}
        </span>
      ),
    },
    {
      key: 'preview',
      label: 'Preview',
      render: (post) => (
        <button type="button" className={styles.feedbackPreview} onClick={() => setSelectedPostId(post.id)}>
          {getPreviewText(post.content)}
        </button>
      ),
    },
    {
      key: 'time_posted',
      label: 'Time Posted',
      width: 140,
      render: (post) => (
        <div className={styles.scopeCell}>
          <span className={styles.scopeItem}>
            <CalendarBlank size={14} weight="duotone" aria-hidden="true" />
            <span>{formatDate(post.created_at)}</span>
          </span>
          <span className={styles.scopeItem}>
            <Clock size={14} weight="duotone" aria-hidden="true" />
            <span>{formatTime(post.created_at)}</span>
          </span>
        </div>
      ),
    },
    {
      key: 'scope',
      label: 'Details',
      width: 200,
      render: (post) => (
        <div className={styles.scopeCell}>
          <Tooltip content={`Responsible office: ${post.office}`}>
            <span className={styles.scopeItem}>
              <HandHeart size={14} weight="duotone" aria-hidden="true" />
              <span>{post.service || 'General'}</span>
            </span>
          </Tooltip>
          <span className={styles.scopeItem}>
            <MapPin size={14} weight="duotone" aria-hidden="true" />
            <span>{post.location || '-'}</span>
          </span>
        </div>
      ),
    },
    {
      key: 'status',
      label: 'Status',
      width: 140,
      render: (post) => (
        <div className={styles.statusCell}>
          <div className={styles.scopeItem}>
            <ChartDonut size={14} weight="duotone" aria-hidden="true" />
            <div className={styles.statusPrimary}>{getStatusLabel(post)}</div>
          </div>
          <div className={`${styles.scopeItem} ${post.verificationStatus === 'Under Review' && normalizeText(post.type) === 'complaint' ? styles.statusSecondaryAlert : styles.statusSecondary}`}>
            <ClockCountdown size={14} weight="duotone" aria-hidden="true" />
            <div>{formatResponseWindow(post)}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'actions',
      label: 'Actions',
      width: 100,
      render: (post) => (
        <div className={styles.actionColumn}>
          <button
            type="button"
            className={styles.actionLink}
            onClick={() => {
              setSelectedPostId(post.id);
              setReportsOpen(false);
              setDismissMode(false);
            }}
          >
            View
          </button>
          {isComplaintFeedback(post) ? (
            <button
              type="button"
              className={styles.actionLink}
              onClick={() => {
                setSelectedPostId(post.id);
                setReportsOpen(false);
                setDismissMode(false);
              }}
            >
              Update
            </button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      <div className={`${styles.pageHeader} ${styles.feedbacksHeader}`}>
        <div className={styles.inlineHeaderMeta}>
          <h1 className={styles.pageTitle}>Feedbacks</h1>
        </div>
        <SearchInput
          className={`${styles.searchControl} ${styles.feedbacksSearchControl}`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search feedback number"
        />
      </div>

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
          <span className={styles.selectionCount}>{selectedPosts.length} selected</span>
        </div>
        <div className={styles.filterRow}>
          <Menu
            align="start"
            items={createStatusMenuItems({
              verificationFilter,
              resolutionFilter,
              setVerificationFilter,
              setResolutionFilter,
            })}
            trigger={(
              <Button
                variant="secondary"
                size="md"
                className={`${styles.filterMenuTrigger} ${verificationFilter !== 'All' ? styles.filterMenuTriggerActive : ''}`}
              >
                Status
                <CaretDown size={12} weight="bold" />
              </Button>
            )}
          />
          <Menu
            align="start"
            items={createMenuItems(TYPE_OPTIONS, typeFilter, setTypeFilter)}
            trigger={(
              <Button
                variant="secondary"
                size="md"
                className={`${styles.filterMenuTrigger} ${typeFilter !== 'All' ? styles.filterMenuTriggerActive : ''}`}
              >
                Type
                <CaretDown size={12} weight="bold" />
              </Button>
            )}
          />
          {!workspace.isBarangayAdmin ? (
            <Menu
              align="start"
              items={[
                { key: 'all-barangays', label: 'All incident locations', active: barangayFilter === 'all', onClick: () => setBarangayFilter('all') },
                ...createMenuItems(barangayOptions, barangayFilter, setBarangayFilter),
              ]}
              trigger={(
                <Button
                  variant="secondary"
                  size="md"
                  className={`${styles.filterMenuTrigger} ${barangayFilter !== 'all' ? styles.filterMenuTriggerActive : ''}`}
                >
                  Incident Location
                  <CaretDown size={12} weight="bold" />
                </Button>
              )}
            />
          ) : null}
          {workspace.isSuperAdmin ? (
            <Menu
              align="start"
              items={[
                { key: 'all-services', label: 'All service categories', active: serviceFilter === 'all', onClick: () => setServiceFilter('all') },
                ...createMenuItems(serviceOptions, serviceFilter, setServiceFilter),
              ]}
              trigger={(
                <Button
                  variant="secondary"
                  size="md"
                  className={`${styles.filterMenuTrigger} ${serviceFilter !== 'all' ? styles.filterMenuTriggerActive : ''}`}
                >
                  Service Category
                  <CaretDown size={12} weight="bold" />
                </Button>
              )}
            />
          ) : null}
          <AdminDateRangeFilter
            value={dateRange}
            onChange={setDateRange}
            align="end"
            className={`${styles.filterMenuTrigger} ${!isDefaultAdminDateRange(dateRange) ? styles.filterMenuTriggerActive : ''}`}
          />
          <Button
            variant="secondary"
            size="md"
            className={`${styles.filterMenuTrigger} ${hasActiveFilters ? styles.filterMenuTriggerActive : styles.filterMenuTriggerMuted}`}
            onClick={() => {
              if (hasActiveFilters) clearFilters();
            }}
            aria-disabled={!hasActiveFilters}
          >
            Clear all
          </Button>
        </div>
      </section>

      <section className={styles.tablePanel}>
        <DataTable
          columns={columns}
          rows={pagedPosts}
          loading={loading}
          minWidth={900}
          empty={feedbacksEmptyLabel}
          showEmptyTable
          emptyRowCount={10}
        />
      </section>

      {totalRecords > 0 ? (
        <div className={styles.resultsFooter}>
          <div className={styles.pagination}>
            <button disabled={page === 0} onClick={() => setPage((current) => Math.max(0, current - 1))}>Prev</button>
            <span>Page</span>
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
            <button disabled={page + 1 >= totalPages} onClick={() => setPage((current) => Math.min(totalPages - 1, current + 1))}>Next</button>
          </div>
          <div className={styles.resultsMeta}>
            Showing results {pagedPosts.length} out of {totalRecords}
          </div>
        </div>
      ) : null}

      <div className={styles.drawerShell} data-open={selectedPost ? 'true' : 'false'}>
        <button type="button" className={styles.drawerBackdrop} onClick={() => setSelectedPostId(null)} aria-label="Close feedback detail" />
        <aside className={styles.drawer}>
          {selectedPost ? (
            <>
              <div className={styles.drawerHeader}>
                <div>
                  <button type="button" className={styles.drawerBack} onClick={() => setSelectedPostId(null)}>
                    Back to list
                  </button>
                  <h2 className={styles.drawerTitle}>{getDisplayFeedbackNo(selectedPost.feedbackNo)}: {selectedPost.service ?? 'General'}</h2>
                  <div className={styles.drawerSubmeta}>
                    Submitted by {getDisplayHandle(selectedPost.handle)}, {selectedPost.created_at ? new Date(selectedPost.created_at).toLocaleString('en-PH') : '-'}, {selectedPost.location || 'No barangay'}
                  </div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setSelectedPostId(null)} aria-label="Close detail">
                  <X size={16} weight="bold" />
                </Button>
              </div>

              {selectedPost.aiFlagged ? (
                <div className={styles.neutralBanner}>
                  <div className={styles.neutralBannerTitle}>AI flag</div>
                  <div className={styles.neutralBannerText}>{selectedPost.aiFlagReason}</div>
                  {isComplaintFeedback(selectedPost) ? (
                    <div className={styles.buttonRow} style={{ marginTop: 10 }}>
                      <Button variant="secondary" size="sm" onClick={() => handleStatusPatch(selectedPost, 'Dismissed', selectedPost.resolutionStatus)}>Dismiss</Button>
                      <Button variant="ghost" size="sm" onClick={() => handleStatusPatch(selectedPost, 'Verified', selectedPost.resolutionStatus)}>Verify</Button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className={styles.drawerBlock}>
                <section className={styles.drawerSection}>
                  <div className={styles.panelTitle}>Feedback Content</div>
                  <div className={styles.cellBody} style={{ marginTop: 10 }}>{selectedPost.content || 'No content available.'}</div>
                  {selectedPost.imageUrl ? <div className={styles.cellSub}>Attachment: {selectedPost.imageUrl}</div> : null}
                </section>

                <section className={styles.drawerSection}>
                  <div className={styles.panelTitle}>Status</div>
                  {isComplaintFeedback(selectedPost) ? (
                    <div className={styles.statusRail} style={{ marginTop: 12 }}>
                      <div className={styles.statusBlock}>
                        <span className={styles.statusBlockLabel}>Verification</span>
                        <select className={styles.select} value={selectedPost.verificationStatus} onChange={(event) => handleStatusPatch(selectedPost, event.target.value, selectedPost.resolutionStatus)}>
                          {VERIFICATION_OPTIONS.filter((value) => value !== 'All').map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                      </div>
                      <div className={styles.statusBlock}>
                        <span className={styles.statusBlockLabel}>Resolution</span>
                        <select
                          className={styles.select}
                          value={selectedPost.resolutionStatus}
                          disabled={selectedPost.verificationStatus === 'Dismissed'}
                          onChange={(event) => handleStatusPatch(selectedPost, selectedPost.verificationStatus, event.target.value)}
                        >
                          {RESOLUTION_OPTIONS.filter((value) => value !== 'All').map((value) => <option key={value} value={value}>{value}</option>)}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className={styles.neutralBanner} style={{ marginTop: 12 }}>
                      <div className={styles.neutralBannerTitle}>Read-only feedback</div>
                      <div className={styles.neutralBannerText}>Only complaint feedback can be updated.</div>
                    </div>
                  )}
                </section>

                <section className={styles.collapsible}>
                  <button type="button" className={styles.collapsibleHeader} onClick={() => setReportsOpen((current) => !current)}>
                    <span className={styles.panelTitle}>Reports, {selectedPost.reportCount}</span>
                    <span className={styles.statusPill}>{reportsOpen ? 'Hide' : 'Show'}</span>
                  </button>
                  {reportsOpen ? (
                    <div className={styles.collapsibleBody}>
                      {selectedPost.reportCount ? selectedPost.reportReasons.map((reason, index) => (
                        <div key={`${reason}-${index}`} className={styles.reportItem}>
                          <div className={styles.cellTitle}>{reason}</div>
                          <div className={styles.cellSub}>{selectedPost.reportHandles[index] ?? '@unknown'}</div>
                        </div>
                      )) : <div className={styles.cellSub}>No reports for this feedback.</div>}
                    </div>
                  ) : null}
                </section>

                <section className={styles.drawerSection}>
                  <div className={styles.panelTitle}>Official Response</div>
                  <div className={styles.responseBox} style={{ marginTop: 12 }}>
                    <span className={styles.responseLabel}>Pinned response</span>
                    <textarea
                      className={styles.textarea}
                      value={responseDrafts[selectedPost.id] ?? ''}
                      onChange={(event) => setResponseDrafts((current) => ({ ...current, [selectedPost.id]: event.target.value }))}
                      placeholder={`Response from ${selectedPost.office}`}
                    />
                    {isComplaintFeedback(selectedPost) ? (
                      <div className={styles.buttonRow} style={{ marginTop: 10 }}>
                        <Button variant="secondary" size="sm" onClick={() => handleResponseSave(selectedPost)}>Add / Edit Response</Button>
                      </div>
                    ) : (
                      <div className={styles.cellSub} style={{ marginTop: 10 }}>Only complaint feedback can be updated.</div>
                    )}
                  </div>
                </section>

                <section className={styles.drawerSection}>
                  <div className={styles.panelTitle}>Actions</div>
                  {isComplaintFeedback(selectedPost) ? (
                    <div className={styles.actionStrip} style={{ marginTop: 12 }}>
                      {workspace.isLGUAdmin ? (
                        <>
                          <select
                            className={styles.select}
                            value={(routingDrafts[selectedPost.id] ?? {}).office ?? ''}
                            onChange={(event) => setRoutingDrafts((current) => ({ ...current, [selectedPost.id]: { ...(current[selectedPost.id] ?? {}), office: event.target.value } }))}
                          >
                            <option value="">Transfer Office</option>
                            {officeOptions.map((office) => <option key={office} value={office}>{office}</option>)}
                          </select>
                          <Button variant="secondary" size="sm" onClick={() => handleRouteAction(selectedPost, 'transferOffice')}>Transfer</Button>
                          <select
                            className={styles.select}
                            value={(routingDrafts[selectedPost.id] ?? {}).barangay ?? ''}
                            onChange={(event) => setRoutingDrafts((current) => ({ ...current, [selectedPost.id]: { ...(current[selectedPost.id] ?? {}), barangay: event.target.value } }))}
                          >
                            <option value="">Delegate to Barangay</option>
                            {barangayOptions.map((barangay) => <option key={barangay} value={barangay}>{barangay}</option>)}
                          </select>
                          <Button variant="secondary" size="sm" onClick={() => handleRouteAction(selectedPost, 'delegate')}>Delegate</Button>
                        </>
                      ) : null}
                      {workspace.isSuperAdmin ? (
                        <>
                          <select
                            className={styles.select}
                            value={(routingDrafts[selectedPost.id] ?? {}).office ?? ''}
                            onChange={(event) => setRoutingDrafts((current) => ({ ...current, [selectedPost.id]: { ...(current[selectedPost.id] ?? {}), office: event.target.value } }))}
                          >
                            <option value="">Reassign Office</option>
                            {officeOptions.map((office) => <option key={office} value={office}>{office}</option>)}
                          </select>
                          <Button variant="secondary" size="sm" onClick={() => handleRouteAction(selectedPost, 'reassignOffice')}>Reassign Office</Button>
                          <select
                            className={styles.select}
                            value={(routingDrafts[selectedPost.id] ?? {}).barangay ?? ''}
                            onChange={(event) => setRoutingDrafts((current) => ({ ...current, [selectedPost.id]: { ...(current[selectedPost.id] ?? {}), barangay: event.target.value } }))}
                          >
                            <option value="">Reassign Barangay</option>
                            {barangayOptions.map((barangay) => <option key={barangay} value={barangay}>{barangay}</option>)}
                          </select>
                          <Button variant="secondary" size="sm" onClick={() => handleRouteAction(selectedPost, 'reassignBarangay')}>Reassign Barangay</Button>
                        </>
                      ) : null}
                      <Button variant="outline" size="sm" onClick={() => setDismissMode((current) => !current)}>Dismiss with Reason</Button>
                    </div>
                  ) : (
                    <div className={styles.neutralBanner} style={{ marginTop: 12 }}>
                      <div className={styles.neutralBannerTitle}>Read-only actions</div>
                      <div className={styles.neutralBannerText}>Routing and dismissal are available for complaint feedback only.</div>
                    </div>
                  )}

                  {dismissMode ? (
                    <div className={styles.inlineForm}>
                      <label className={styles.fieldLabel}>Dismissal reason</label>
                      <textarea className={styles.textarea} value={dismissReasonDraft} onChange={(event) => setDismissReasonDraft(event.target.value)} />
                      <div className={styles.buttonRow}>
                        <Button variant="destructive" size="sm" onClick={() => handleDismiss(selectedPost)}>Confirm Dismissal</Button>
                        <Button variant="ghost" size="sm" onClick={() => setDismissMode(false)}>Cancel</Button>
                      </div>
                    </div>
                  ) : null}
                </section>
              </div>
            </>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

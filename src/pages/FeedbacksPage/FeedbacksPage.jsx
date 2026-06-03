import { useEffect, useMemo, useRef, useState } from 'react';
import { CalendarBlank, CaretDown, ChatsCircle, ChartDonut, Clock, ClockCountdown, DownloadSimple, FlagBanner, HandHeart, Lightbulb, MapPin, Paperclip, PaperPlaneTilt, Smiley, Star, Target, TrayArrowUp, Warning, X } from '@phosphor-icons/react';
import AdminDateRangeFilter from '../../components/ui/AdminDateRangeFilter.jsx';
import Avatar from '../../components/ui/Avatar.jsx';
import DataTable from '../../components/DataTable/DataTable.jsx';
import Button from '../../components/ui/Button.jsx';
import Menu from '../../components/ui/Menu.jsx';
import Popover from '../../components/ui/Popover.jsx';
import SearchInput from '../../components/ui/SearchInput.jsx';
import Tooltip from '../../components/ui/Tooltip.jsx';
import MediaCarousel from '../../components/MediaGrid/MediaCarousel.jsx';
import { POST_TYPES, SERVICE_CATEGORY_OPTIONS, URDANETA_BARANGAYS, DISMISS_REASON_OPTIONS, VERIFY_REASON_OPTIONS } from '../../constants/index.js';
import { useAuth } from '@core/context/AuthContext.jsx';
import { useAdminWorkspace } from '@core/hooks/useAdminWorkspace.js';
import { useAdminFeed } from '@core/hooks/useAdminFeed.js';
import { useAdminReports } from '@core/hooks/useAdminReports.js';
import { useDiscussions } from '@core/hooks/useDiscussions.js';
import { getAdminPosts } from '@core/services/admin.js';
import { postDiscuss } from '@core/services/posts.js';
import { uploadMediaFiles } from '@core/services/media.js';
import {
  composeStatus,
  deriveResolutionStatus,
  deriveVerificationStatus,
  filterByDateRange,
  getOfficeForService,
  normalizeText,
  scopePostsToWorkspace,
} from '@core/lib/adminWorkspace.js';
import { formatMoodLabel, getMoodEmoji, resolveFeedbackMood } from '@core/utils/mood.js';
import { createPresetAdminDateRange, isDefaultAdminDateRange } from '@core/lib/adminDateRange.js';
import { exportRowsToXlsx } from '@core/lib/exporters.js';
import { lockPageScroll } from '@core/utils/lockPageScroll.js';
import { formatCount, formatTime as formatRelativeTime } from '@core/utils/format.js';
import { showToast } from '../../components/Toast/Toast.jsx';
import MarkLocationModal from '../../components/MarkLocationModal/MarkLocationModal.jsx';
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
const DETAIL_CLOSE_ANIMATION_MS = 200;
const MAX_ATTACHMENTS = 5;
const ROUTING_NOTE_MAX_LENGTH = 240;
const DEFAULT_VISIBLE_REPLIES = 5;

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

function formatCompactResponseDuration(ms) {
  const totalHours = Math.max(1, Math.ceil(Math.abs(ms) / 36e5));
  if (totalHours < 24) return `${totalHours}h`;

  const totalDays = Math.ceil(totalHours / 24);
  if (totalDays < 14) return `${totalDays}d`;

  return `${Math.ceil(totalDays / 7)}w`;
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

function formatTimelineResponseWindow(post) {
  if (normalizeText(post?.type) !== 'complaint') return '';

  const createdAt = Date.parse(post?.created_at ?? '');
  if (!Number.isFinite(createdAt)) return '';

  const deadline = createdAt + COMPLAINT_REVIEW_WINDOW_MS;

  if (post.verificationStatus === 'Under Review') {
    const remainingMs = deadline - Date.now();
    return remainingMs >= 0
      ? `${formatCompactResponseDuration(remainingMs)} left`
      : `${formatCompactResponseDuration(remainingMs)} overdue`;
  }

  const reviewedAt = Date.parse(post?.closedAt ?? post?.updated_at ?? '');
  if (!Number.isFinite(reviewedAt)) return '';

  const responseDeltaMs = reviewedAt - deadline;
  return responseDeltaMs > 0
    ? `${formatCompactResponseDuration(responseDeltaMs)} late`
    : 'on time';
}

function getTimelineResponseTone(value) {
  const normalized = normalizeText(value);
  if (normalized.includes('overdue')) return 'overdue';
  if (normalized.includes('late')) return 'late';
  if (normalized.includes('left') || normalized === 'on time') return 'onTime';
  return '';
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

function formatTimelineDateTime(value) {
  const timestamp = Date.parse(value ?? '');
  if (!Number.isFinite(timestamp)) return '-';

  const date = new Date(timestamp);
  const datePart = date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
  const timePart = date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return `${datePart} ${timePart}`;
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

function resolveFeedbackMood(post) {
  const moodValue = post?.finalMood ?? post?.predictedMood ?? null;
  const label = formatMoodLabel(moodValue);
  if (!label) return null;

  return {
    label,
    emoji: getMoodEmoji(moodValue),
  };
}

function isComplaintFeedback(post) {
  return normalizeText(post?.type) === 'complaint';
}

function isVideo(url) {
  return /\.(mp4|webm|ogg|mov)(\?.*)?$/i.test(String(url ?? ''));
}

function isImage(url) {
  return /\.(png|jpe?g|gif|webp|avif|bmp|svg)(\?.*)?$/i.test(String(url ?? ''));
}

function getAvatarSrc(value) {
  const normalized = String(value ?? '').trim();
  if (normalized.startsWith('/avatars/')) return normalized;
  if (/^(https?:|data:|blob:)/i.test(normalized)) return normalized;
  return null;
}

function buildStatusTimeline(post) {
  if (!post) return [];
  const submittedAt = formatTimelineDateTime(post.created_at);
  const updatedAt = formatTimelineDateTime(post.updated_at);
  const verification = post.verificationStatus;
  const resolution = post.resolutionStatus;
  const verificationWindow = formatTimelineResponseWindow(post);

  const timeline = [
    {
      key: 'submitted',
      label: 'Posted',
      value: submittedAt,
      state: 'done',
      detail: post.service ? `Assigned category: ${post.service}` : 'Feedback entered the admin queue.',
    },
    {
      key: 'verification',
      label: verification,
      responseWindow: verificationWindow,
      responseTone: getTimelineResponseTone(verificationWindow),
      value: verification === 'Under Review' ? formatResponseWindow(post) : updatedAt,
      state: verification === 'Under Review' ? 'current' : verification === 'Dismissed' ? 'blocked' : 'done',
      detail: getVerificationDescription(verification),
    },
  ];

  // Resolution sub-status tracking only applies to complaints;
  // compliments and suggestions are simply marked Verified with no further resolution flow
  if (verification === 'Verified' && normalizeText(post?.type) === 'complaint') {
    timeline.push({
      key: 'resolution',
      label: resolution,
      value: updatedAt,
      state: resolution === 'Resolved' ? 'done' : 'current',
      detail: getResolutionDescription(resolution),
    });
  }

  return timeline;
}

function makeAttachment(file) {
  return {
    id: crypto.randomUUID(),
    file,
    url: URL.createObjectURL(file),
    type: file.type?.startsWith('video/') ? 'video' : 'image',
  };
}

function formatDiscussionTimestamp(value) {
  if (!value) return '';
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return '';

  const diff = Date.now() - timestamp;
  if (diff < 24 * 60 * 60 * 1000) return formatRelativeTime(value);

  const date = new Date(timestamp);
  const day = date.toLocaleDateString('en-GB', { day: '2-digit' });
  const month = date.toLocaleDateString('en-GB', { month: 'short' });
  const year = date.toLocaleDateString('en-GB', { year: '2-digit' });
  return `${day} ${month} '${year}`;
}

function buildDiscussionGroups(items, sortMode = 'popular') {
  const byId = new Map(items.map((item) => [String(item.id), item]));
  const byParent = new Map();

  items.forEach((item) => {
    const key = String(item.parentId ?? 'root');
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(item);
  });

  function getReplies(parentId) {
    const nodes = [...(byParent.get(String(parentId)) ?? [])]
      .sort((left, right) => Date.parse(left.createdAt ?? '') - Date.parse(right.createdAt ?? ''));

    return nodes.flatMap((node) => {
      const parent = byId.get(String(node.parentId));
      const replyTarget = parent?.author?.fullName ?? null;
      return [
        {
          ...node,
          replyTarget,
          displayTime: formatDiscussionTimestamp(node.createdAt),
        },
        ...getReplies(node.id),
      ];
    });
  }

  return items
    .filter((item) => !item.parentId)
      .filter((item) => (sortMode === 'lgu-response' ? item.isPinned || item.isAdmin : true))
    .map((item) => ({
      ...item,
      replies: getReplies(item.id),
      displayTime: formatDiscussionTimestamp(item.createdAt),
    }))
    .sort((left, right) => {
      if (left.isPinned !== right.isPinned) return left.isPinned ? -1 : 1;
      if (sortMode === 'popular') {
        const likeDelta = Number(right.likes ?? 0) - Number(left.likes ?? 0);
        if (likeDelta !== 0) return likeDelta;
      }
      return Date.parse(right.createdAt ?? '') - Date.parse(left.createdAt ?? '');
    });
}

function getStatusLabel(post) {
  if (post.verificationStatus === 'Verified') {
    return post.resolutionStatus && post.resolutionStatus !== 'Not Started'
      ? `${post.verificationStatus} / ${post.resolutionStatus}`
      : post.verificationStatus;
  }

  return post.verificationStatus;
}

function formatInlineComplaintStatus(post) {
  const status = getStatusLabel(post);
  const responseWindow = formatResponseWindow(post);

  if (isComplaintFeedback(post) && post.verificationStatus === 'Under Review' && responseWindow !== 'N/A') {
    return `${status} - ${responseWindow}`;
  }

  return status;
}

function getVerificationDescription(value) {
  if (value === 'Under Review') return 'Keep the feedback in intake while the office checks details.';
  if (value === 'Verified') return 'Acknowledged as valid feedback.';
  if (value === 'Dismissed') return 'Close this as not actionable for the current workflow.';
  return '';
}

function getResolutionDescription(value) {
  if (value === 'Not Started') return 'Verified, but no resolution work has started yet.';
  if (value === 'In Progress') return 'Work is actively moving with the responsible office.';
  if (value === 'On Hold') return 'Progress is paused while waiting for input or resources.';
  if (value === 'Resolved') return 'The issue has been completed and can be communicated as resolved.';
  return '';
}

function getDismissReportItems(post) {
  const reasons = Array.isArray(post?.reportReasons) ? post.reportReasons : [];
  const count = Number(post?.reportCount ?? 0);

  if (reasons.length > 0) {
    const byReason = new Map();
    reasons.forEach((reason) => {
      const label = String(reason ?? '').trim();
      if (!label) return;
      byReason.set(label, (byReason.get(label) ?? 0) + 1);
    });

    return Array.from(byReason.entries()).map(([reason, reasonCount], index) => ({
      id: `report-${index}-${reason}`,
      title: reason,
      count: reasonCount,
    }));
  }

  if (count > 0) {
    return Array.from({ length: count }, (_, index) => ({
      id: `report-${index}`,
      title: 'Report submitted',
      count: 1,
    }));
  }

  return [];
}

function FeedbackDetailsPopover({ post, typeLabel, relativeTime, onViewLocation }) {
  const displayLocation = String(post.location ?? '').trim();
  const hasLocationCoords = typeof post.latitude === 'number' && typeof post.longitude === 'number';
  const moodSummary = resolveFeedbackMood(post);

  return (
    <div className={styles.feedbackDetails}>
      <div className={styles.detailsHeader}>Feedback details</div>
      <div className={styles.detailsTwoCol}>
        <div className={styles.detailsCol}>
          <div className={styles.detailsRow}>
            <span>Feedback No.</span>
            <strong>{getDisplayFeedbackNo(post.feedbackNo)}</strong>
          </div>
          <div className={styles.detailsRow}>
            <span>Citizen</span>
            <strong>{getDisplayHandle(post.handle)}</strong>
          </div>
          <div className={styles.detailsRow}>
            <span>Posted</span>
            <Tooltip content={formatDateTime(post.created_at)} align="left">
              <strong className={styles.postedTime}>{relativeTime}</strong>
            </Tooltip>
          </div>
        </div>
        <div className={styles.detailsCol}>
          <div className={styles.detailsRow}>
            <span>Feedback Type</span>
            <strong>{typeLabel}</strong>
          </div>
          <div className={styles.detailsRow}>
            <span>Service Category</span>
            {post.service ? <strong>{post.service}</strong> : <span className={styles.detailsEmpty}>-</span>}
          </div>
          <div className={styles.detailsRow}>
            <span>Location of Incident</span>
            {displayLocation ? (
              <div className={styles.locationValue}>
                <strong>{displayLocation}</strong>
                {hasLocationCoords && onViewLocation && (
                  <button
                    type="button"
                    className={styles.locationMapBtn}
                    onClick={(e) => {
                      e.stopPropagation();
                      onViewLocation();
                    }}
                    aria-label="View location on map"
                  >
                    <Target size={16} weight="fill" />
                  </button>
                )}
              </div>
            ) : (
              <span className={styles.detailsEmpty}>-</span>
            )}
          </div>
        </div>
      </div>

      {moodSummary ? (
        <div className={styles.moodSection}>
          <div className={styles.moodRow}>
            <span className={styles.moodEmoji}>{moodSummary.emoji}</span>
            <span className={styles.moodLabel}>The mood of this feedback is most likely <strong>{moodSummary.label.toLowerCase()}</strong></span>
          </div>
        </div>
      ) : null}
    </div>
  );
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

function DiscussionThreadSkeleton() {
  return (
    <div className={styles.threadLoading} aria-hidden="true">
      <div className={styles.threadSkeletonCard}>
        <div className={styles.threadSkeletonHeader}>
          <div className={styles.threadSkeletonAvatar} />
          <div className={styles.threadSkeletonMeta}>
            <div className={styles.threadSkeletonName} />
            <div className={styles.threadSkeletonTime} />
          </div>
        </div>
        <div className={styles.threadSkeletonBody}>
          <div className={styles.threadSkeletonLine} />
          <div className={`${styles.threadSkeletonLine} ${styles.threadSkeletonLineShort}`} />
        </div>
        <div className={styles.threadSkeletonFooter}>
          <div className={styles.threadSkeletonChip} />
          <div className={styles.threadSkeletonChip} />
          <div className={styles.threadSkeletonChip} />
        </div>
      </div>
    </div>
  );
}

function FeedbackDiscussCard({ post }) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [locationModalOpen, setLocationModalOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const typeMeta = getTypeMeta(post.type);
  const author = getDisplayHandle(post.handle);
  const relativeTime = formatRelativeTime(post.created_at);
  const inlineStatus = formatInlineComplaintStatus(post);
  const moodSummary = resolveFeedbackMood(post);
  const mediaUrl = post.imageUrl || post.images?.[0];
  const mediaItems = [post.imageUrl, ...(Array.isArray(post.images) ? post.images : [])]
    .filter((url) => isImage(url) || isVideo(url));
  const authorAvatarSrc = getAvatarSrc(post.bg);
  const raiseCount = formatCount(post.raises ?? 0);
  const reactionCount = formatCount(post.reacts ?? 0);
  const discussionCount = formatCount(post.discuss ?? 0);
  const reportCount = formatCount(post.reportCount ?? 0);

  useEffect(() => {
    if (!detailsOpen) return undefined;

    function closeDetailsOnScroll() {
      setDetailsOpen(false);
    }

    window.addEventListener('scroll', closeDetailsOnScroll, true);
    return () => window.removeEventListener('scroll', closeDetailsOnScroll, true);
  }, [detailsOpen]);

  return (
    <article className={`${styles.feedCard} ${styles.feedCardNoRadius}`} aria-labelledby={`post-username-${post.id}`} role="article">
      <div className={styles.topRow}>
        <div className={styles.identity}>
          <span className={styles.avatarButton}>
            <Avatar
              size="lg"
              name={post.user}
              initials={post.initials}
              src={authorAvatarSrc}
            />
          </span>
          <div className={styles.identityCopy}>
            <div className={styles.usernameRow}>
              <span className={styles.usernameButton} id={`post-username-${post.id}`}>
                {author}
              </span>
            </div>
            <div className={styles.metadataRow}>
              <span className={styles.timeButton} aria-label={`Posted ${formatDateTime(post.created_at)}`}>
                {relativeTime}
              </span>
              <span className={styles.metadataSeparator}>&middot;</span>
              <span className={`${styles.typeButton} ${typeMeta.toneClass}`}>
                <typeMeta.Icon size={14} weight="duotone" aria-hidden="true" />
                <span>{typeMeta.label}</span>
              </span>
              {inlineStatus ? (
                <>
                  <span className={styles.metadataSeparator}>&middot;</span>
                  <span className={`${styles.statusButton} ${post.verificationStatus === 'Under Review' ? styles.statusButtonAlert : ''}`}>
                    <ChartDonut size={14} weight="duotone" aria-hidden="true" />
                    <span>{inlineStatus}</span>
                  </span>
                </>
              ) : null}
              {moodSummary ? (
                <>
                  <span className={styles.metadataSeparator}>&middot;</span>
                  <span className={styles.moodInline}>
                    {moodSummary.emoji} {moodSummary.label}
                  </span>
                </>
              ) : null}
              <span className={styles.metadataSeparator}>&middot;</span>
              <Popover
                align="start"
                open={detailsOpen}
                onOpenChange={setDetailsOpen}
                panelClassName={styles.detailsPopover}
                trigger={<button type="button" className={styles.moreButton}>{detailsOpen ? 'less' : 'more'}</button>}
              >
                <FeedbackDetailsPopover 
                  post={post} 
                  typeLabel={typeMeta.label} 
                  relativeTime={relativeTime} 
                  onViewLocation={() => {
                    setSelectedLocation({ latitude: post.latitude, longitude: post.longitude });
                    setLocationModalOpen(true);
                  }}
                />
              </Popover>
            </div>
          </div>
        </div>
      </div>

      <div className={styles.captionRow}>
        <div className={styles.captionWrap}>
          <span className={`${styles.caption} ${styles.captionFull}`}>{post.content || 'No content available.'}</span>
        </div>
      </div>

      {mediaItems.length > 0 ? (
        <MediaCarousel items={mediaItems} className={styles.feedMediaBlock} />
      ) : mediaUrl ? (
        <a className={styles.attachment} href={mediaUrl} target="_blank" rel="noreferrer">{mediaUrl}</a>
      ) : null}

      <div className={styles.actionRow} aria-label="Feedback metrics">
        <div className={styles.actionCluster}>
          <Tooltip content={`${raiseCount} ${raiseCount === '1' ? 'raise' : 'raises'}`}>
            <span className={styles.actionMetric} tabIndex={0} aria-label={`${raiseCount} raises`}>
              <TrayArrowUp size={20} weight="regular" aria-hidden="true" />
              <strong>{raiseCount}</strong>
            </span>
          </Tooltip>

          <Tooltip content={`${reportCount} ${reportCount === '1' ? 'report' : 'reports'}`}>
            <span className={styles.actionMetric} tabIndex={0} aria-label={`${reportCount} reports`}>
              <FlagBanner size={20} weight="regular" aria-hidden="true" />
              <strong>{reportCount}</strong>
            </span>
          </Tooltip>

          <Tooltip content={`${reactionCount} ${reactionCount === '1' ? 'reaction' : 'reactions'}`}>
            <span className={styles.actionMetric} tabIndex={0} aria-label={`${reactionCount} reactions`}>
              <Smiley size={20} weight="regular" aria-hidden="true" />
              <strong>{reactionCount}</strong>
            </span>
          </Tooltip>

          <Tooltip content={`${discussionCount} ${discussionCount === '1' ? 'discussion' : 'discussions'}`}>
            <span className={`${styles.actionMetric} ${styles.actionMetricActive}`} tabIndex={0} aria-label={`${discussionCount} discussions`}>
              <ChatsCircle size={20} weight="duotone" aria-hidden="true" />
              <strong>{discussionCount}</strong>
            </span>
          </Tooltip>
        </div>
      </div>

      <MarkLocationModal
        open={locationModalOpen}
        onClose={() => setLocationModalOpen(false)}
        initialLocation={selectedLocation}
      />
    </article>
  );
}

function DiscussionComposer({ postId, onSent }) {
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [isFocused, setIsFocused] = useState(false);
  const [hoveredIcon, setHoveredIcon] = useState(null);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const attachmentsRef = useRef([]);
  const { session } = useAuth() ?? {};
  const remainingAttachments = MAX_ATTACHMENTS - attachments.length;
  const hasInput = input.trim().length > 0 || attachments.length > 0;

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => () => {
    attachmentsRef.current.forEach((item) => URL.revokeObjectURL(item.url));
  }, []);

  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (!isFocused && !hasInput) {
      textarea.style.height = '44px';
      return;
    }
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(Math.max(textarea.scrollHeight, 80), 225)}px`;
  }, [input, isFocused, hasInput]);

  function chooseFiles(files) {
    const incoming = Array.from(files ?? [])
      .filter((file) => file.type?.startsWith('image/') || file.type?.startsWith('video/'))
      .slice(0, remainingAttachments)
      .map(makeAttachment);

    if (incoming.length === 0) return;
    setAttachments((current) => [...current, ...incoming].slice(0, MAX_ATTACHMENTS));
  }

  function removeAttachment(id) {
    setAttachments((current) => {
      const item = current.find((row) => row.id === id);
      if (item) URL.revokeObjectURL(item.url);
      return current.filter((row) => row.id !== id);
    });
  }

  async function handleSend() {
    const body = input.trim();
    if ((!body && attachments.length === 0) || sending) return;

    setSending(true);
    setError('');

    const { data: uploadedUrls, error: uploadError } = await uploadMediaFiles(
      attachments.map((item) => item.file),
      { ownerId: session?.user?.id, folder: 'discuss' },
    );

    if (uploadError) {
      setError(uploadError.message ?? 'Unable to upload attachment.');
      setSending(false);
      return;
    }

    const extraUrls = uploadedUrls.slice(1);
    const finalBody = [
      body || 'Attached media',
      extraUrls.length > 0 ? `Additional media:\n${extraUrls.join('\n')}` : '',
    ].filter(Boolean).join('\n\n');

    const { error: submitError } = await postDiscuss(postId, finalBody, {
      parentId: null,
      imageUrl: uploadedUrls[0] || null,
      userId: session?.user?.id,
      isPinned: true,
    });

    if (submitError) {
      setError(submitError.message ?? 'Unable to post discussion.');
    } else {
      setInput('');
      attachments.forEach((item) => URL.revokeObjectURL(item.url));
      setAttachments([]);
      setIsFocused(false);
      onSent?.();
    }

    setSending(false);
  }

  return (
    <div className={styles.composerCard}>
      <div className={styles.composerMain}>
        <div className={[styles.inputBox, isFocused || hasInput ? styles.inputBoxFocused : ''].join(' ')}>
          <div className={styles.inputRow1}>
            <textarea
              ref={textareaRef}
              className={styles.discussInput}
              placeholder="Add official response"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onFocus={() => setIsFocused(true)}
              onBlur={() => {
                if (input.length === 0 && attachments.length === 0) setIsFocused(false);
              }}
            />
            {!isFocused && !hasInput ? (
              <div className={styles.inputIconsRight}>
                <button className={styles.miniIconBtn} type="button" onClick={() => fileInputRef.current?.click()} aria-label="Attach media">
                  <Paperclip size={18} />
                </button>
              </div>
            ) : null}
          </div>

          {isFocused || hasInput ? (
            <div className={styles.inputRow2}>
              <div className={styles.row2Left}>
                <button
                  className={styles.iconBtn}
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  onMouseEnter={() => setHoveredIcon('media')}
                  onMouseLeave={() => setHoveredIcon(null)}
                  aria-label="Attach media"
                >
                  <Paperclip size={18} weight={hoveredIcon === 'media' ? 'duotone' : 'regular'} />
                </button>
              </div>
              <button className={styles.sendBtn} disabled={!hasInput || sending} onClick={handleSend} aria-label="Send">
                <PaperPlaneTilt size={18} weight="fill" />
              </button>
            </div>
          ) : null}
        </div>
        <input
          ref={fileInputRef}
          className={styles.fileInput}
          type="file"
          accept="image/*,video/*"
          multiple
          onChange={(event) => {
            chooseFiles(event.target.files);
            event.target.value = '';
          }}
        />
      </div>

      {attachments.length > 0 ? (
        <div className={styles.attachTray}>
          <div className={styles.attachPreviewGrid}>
            {attachments.map((item) => (
              <div key={item.id} className={styles.attachPreview}>
                {item.type === 'video' ? <video src={item.url} muted playsInline preload="metadata" /> : <img src={item.url} alt="" />}
                <button type="button" onClick={() => removeAttachment(item.id)} aria-label="Remove">
                  <X size={14} weight="bold" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}

function CustomDropdown({ value, onChange, options, placeholder, disabled, ariaLabel }) {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div 
      ref={dropdownRef} 
      className={[
        styles.customDropdownRoot,
        disabled ? styles.customDropdownDisabled : '',
        isOpen ? styles.customDropdownOpen : ''
      ].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        className={styles.customDropdownTrigger}
        onClick={() => !disabled && setIsOpen(!isOpen)}
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
      >
        <span className={value ? styles.customDropdownValue : styles.customDropdownPlaceholder}>
          {value || placeholder}
        </span>
        <CaretDown 
          size={16} 
          weight="bold" 
          className={styles.customDropdownCaret} 
          style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}
        />
      </button>

      {isOpen && (
        <ul className={styles.customDropdownMenu} role="listbox">
          <li
            className={[styles.customDropdownOption, !value ? styles.customDropdownOptionActive : ''].filter(Boolean).join(' ')}
            onClick={() => {
              onChange('');
              setIsOpen(false);
            }}
            role="option"
            aria-selected={!value}
          >
            {placeholder}
          </li>
          {options.map((option) => (
            <li
              key={option}
              className={[styles.customDropdownOption, value === option ? styles.customDropdownOptionActive : ''].filter(Boolean).join(' ')}
              onClick={() => {
                onChange(option);
                setIsOpen(false);
              }}
              role="option"
              aria-selected={value === option}
            >
              {option}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function StatusUpdateModal({
  post,
  visible,
  workspace,
  officeOptions = [],
  barangayOptions = [],
  onClose,
  onStatusPatch,
  onAdminAction,
}) {
  const [savingStatus, setSavingStatus] = useState('');
  const [confirmMode, setConfirmMode] = useState('');
  const [verifyChecklist, setVerifyChecklist] = useState([]);
  const [verifyError, setVerifyError] = useState('');
  const [dismissReason, setDismissReason] = useState([]);
  const [dismissError, setDismissError] = useState('');
  const [routeDestination, setRouteDestination] = useState('');
  const [routeNote, setRouteNote] = useState('');
  const [routeError, setRouteError] = useState('');
  const [resolutionNote, setResolutionNote] = useState('');
  const [resolutionPhotos, setResolutionPhotos] = useState([]);
  const [resolutionError, setResolutionError] = useState('');
  const resolutionPhotoRef = useRef(null);

  useEffect(() => {
    setSavingStatus('');
    closeConfirm();
  }, [post?.id, visible]);

  if (!post) return null;

  // All feedback types (complaints, suggestions, compliments) can be verified, dismissed,
  // transferred, and delegated. Resolution tracking (In Progress / On Hold / Resolved) is
  // complaint-only and is handled downstream in composeStatus and buildStatusTimeline.
  const canUpdate = true;
  const isComplaint = isComplaintFeedback(post);
  const isUnderReview = post.verificationStatus === 'Under Review';
  const timeline = buildStatusTimeline(post);
  const dismissReportItems = getDismissReportItems(post);

  function closeConfirm() {
    setConfirmMode('');
    setVerifyChecklist([]);
    setVerifyError('');
    setDismissReason([]);
    setDismissError('');
    setRouteDestination('');
    setRouteNote('');
    setRouteError('');
    setResolutionNote('');
    setResolutionPhotos([]);
    setResolutionError('');
  }

  function openConfirm(mode) {
    if (savingStatus) return;
    setVerifyError('');
    setDismissError('');
    setRouteError('');
    setResolutionError('');
    setConfirmMode(mode);
  }

  async function submitStatus(nextVerification, nextResolution, options = {}) {
    const { adminNotes = null } = options;
    const statusKey = `${nextVerification}-${nextResolution}`;
    setSavingStatus(statusKey);

    try {
      const updated = await onStatusPatch(post, nextVerification, nextResolution, { adminNotes });
      if (updated !== false) closeConfirm();
    } finally {
      setSavingStatus('');
    }
  }

  async function submitVerify() {
    // Complaints auto-enter In Progress when verified (resolution tracking begins).
    // Compliments and suggestions stay at Verified — no resolution sub-status assigned.
    const nextResolution = isComplaint
      ? (post.resolutionStatus === 'Not Started' ? 'In Progress' : post.resolutionStatus)
      : post.resolutionStatus;

    if (!verificationChecklistComplete) {
      setVerifyError('Complete every verification requirement.');
      return;
    }

    setVerifyError('');
    // No adminNotes passed — notes are only relevant for transfer/delegate
    await submitStatus('Verified', nextResolution);
  }

  function toggleVerifyChecklistItem(item) {
    setVerifyChecklist((current) => (
      current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item]
    ));
    setVerifyError('');
  }

  function submitDismiss() {
    if (dismissReason.length === 0) {
      setDismissError('Select at least one reason for dismissal.');
      return;
    }
    // No adminNotes passed — notes are only relevant for transfer/delegate
    submitStatus('Dismissed', post.resolutionStatus);
  }

  async function submitAdminAction() {
    const destination = routeDestination.trim();
    const note = routeNote.trim().slice(0, ROUTING_NOTE_MAX_LENGTH);

    if (!destination || !note) {
      setRouteError('Select a destination and add a note.');
      return;
    }

    const statusKey = `${confirmMode}-${destination}`;
    setSavingStatus(statusKey);
    setRouteError('');

    try {
      const updated = await onAdminAction?.(post, confirmMode, { destination, note });
      if (updated !== false) closeConfirm();
    } finally {
      setSavingStatus('');
    }
  }

  async function submitResolutionAction() {
    const note = resolutionNote.trim();
    const isPhotoRequired = confirmMode === 'add-progress' || confirmMode === 'resolved';

    if (confirmMode !== 'back-to-progress') {
      if (!note) {
        setResolutionError('A note is required.');
        return;
      }
      if (isPhotoRequired && resolutionPhotos.length === 0) {
        setResolutionError('At least one photo is required as evidence.');
        return;
      }
    }

    setResolutionError('');

    let uploadedUrls = [];
    if (resolutionPhotos.length > 0) {
      setSavingStatus('uploading');
      try {
        const { data, error: uploadErr } = await uploadMediaFiles(resolutionPhotos, { folder: 'resolution' });
        if (uploadErr) {
          setResolutionError(`Photo upload failed: ${uploadErr.message}`);
          setSavingStatus('');
          return;
        }
        uploadedUrls = data ?? [];
      } catch {
        setResolutionError('Photo upload failed. Please try again.');
        setSavingStatus('');
        return;
      }
    }

    const nextResolution = confirmMode === 'resolved' ? 'Resolved'
      : confirmMode === 'on-hold' ? 'On Hold'
      : 'In Progress';

    const adminNotes = [note, uploadedUrls.length > 0 ? `Evidence: ${uploadedUrls.join(', ')}` : ''].filter(Boolean).join('\n') || null;


    await submitStatus('Verified', nextResolution, { adminNotes });
  }

  const isVerifyConfirm = confirmMode === 'verify';
  const isDismissConfirm = confirmMode === 'dismiss';
  const isTransferConfirm = confirmMode === 'transfer';
  const isDelegateConfirm = confirmMode === 'delegate';
  const isRoutingConfirm = isTransferConfirm || isDelegateConfirm;
  const isAddProgressConfirm = confirmMode === 'add-progress';
  const isOnHoldConfirm = confirmMode === 'on-hold';
  const isResolvedConfirm = confirmMode === 'resolved';
  const isBackToProgressConfirm = confirmMode === 'back-to-progress';
  const isResolutionConfirm = isAddProgressConfirm || isOnHoldConfirm || isResolvedConfirm || isBackToProgressConfirm;
  const verificationChecklistComplete = VERIFY_REASON_OPTIONS.every((item) => verifyChecklist.includes(item));
  const confirmTitle = isVerifyConfirm
    ? 'Verify feedback'
    : isDismissConfirm
      ? 'Dismiss feedback'
      : isTransferConfirm
        ? 'Transfer feedback'
        : isDelegateConfirm
          ? 'Delegate feedback'
          : isAddProgressConfirm
            ? 'Add progress update'
            : isOnHoldConfirm
              ? 'Put on hold'
              : isResolvedConfirm
                ? 'Mark as resolved'
                : 'Resume: In Progress';
  const currentAdminInCharge = post.office || post.service || 'Unassigned office';
  const routingOptions = isDelegateConfirm ? barangayOptions : officeOptions;
  const showResolutionActions = canUpdate && isComplaint && !isUnderReview
    && post.verificationStatus === 'Verified'
    && (post.resolutionStatus === 'In Progress' || post.resolutionStatus === 'On Hold');

  return (
    <div
      className={[styles.feedbackModalOverlay, visible ? styles.feedbackModalOverlayVisible : ''].join(' ')}
      onMouseDown={onClose}
    >
      <section
        className={[styles.statusModal, visible ? styles.feedbackModalVisible : ''].join(' ')}
        role="dialog"
        aria-modal="true"
        aria-labelledby="status-update-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <header className={styles.statusModalHeader}>
          <div>
            <h2 id="status-update-title" className={styles.statusModalTitle}>Update status</h2>
          </div>
          <button type="button" className={styles.feedbackModalClose} onClick={onClose} aria-label="Close status update">
            <X size={20} weight="bold" />
          </button>
        </header>

        <div className={styles.statusModalBody}>
          <section className={styles.statusTimelinePanel}>
            <div className={styles.statusPanelHeader}>
              <strong>Status Timeline</strong>
            </div>
            <div className={styles.statusTimelineList}>
              {timeline.map((item) => {
                const showVerificationActions = canUpdate && isUnderReview && item.key === 'verification' && !workspace?.isSuperAdmin;
                const showSuperAdminActions = canUpdate && isUnderReview && item.key === 'verification' && workspace?.isSuperAdmin;
                return (
                  <div key={item.key} className={styles.statusTimelineItem}>
                    <span className={`${styles.statusTimelineDot} ${styles[`statusTimelineDot_${item.state}`]}`} aria-hidden="true" />
                    <div className={styles.statusTimelineContent}>
                      <div className={styles.statusTimelineTopline}>
                        <strong>
                          <span>{item.label}</span>
                        </strong>
                        <span className={styles.statusTimelineMeta}>{item.value}</span>
                      </div>
                      {showVerificationActions ? (
                        <div className={styles.statusTimelineAssigneeSection}>
                          <div className={styles.statusTimelineAssignee}>
                            In-charge: {currentAdminInCharge}
                          </div>
                          <div className={styles.statusTimelineActionsBelow}>
                            <button
                              type="button"
                              className={styles.statusTimelineAction}
                              onClick={() => openConfirm('verify')}
                              disabled={Boolean(savingStatus)}
                            >
                              {savingStatus.startsWith('Verified-') ? 'Verifying...' : 'Verify'}
                            </button>
                            <button
                              type="button"
                              className={`${styles.statusTimelineAction} ${styles.statusTimelineActionDanger}`}
                              onClick={() => openConfirm('dismiss')}
                              disabled={Boolean(savingStatus)}
                            >
                              {savingStatus.startsWith('Dismissed-') ? 'Dismissing...' : 'Dismiss'}
                            </button>
                          </div>
                        </div>
                      ) : showSuperAdminActions ? (
                        <div className={styles.statusTimelineActionRows}>
                          <div className={styles.statusTimelineAssigneeSection}>
                            <div className={styles.statusTimelineAssignee}>
                              In-charge: {currentAdminInCharge}
                            </div>
                            <div className={styles.statusTimelineActionsBelow}>
                              <button
                                type="button"
                                className={styles.statusTimelineAction}
                                onClick={() => openConfirm('transfer')}
                                disabled={Boolean(savingStatus)}
                              >
                                Transfer
                              </button>
                              <button
                                type="button"
                                className={styles.statusTimelineAction}
                                onClick={() => openConfirm('delegate')}
                                disabled={Boolean(savingStatus)}
                              >
                                Delegate
                              </button>
                            </div>
                          </div>

                          <div className={styles.statusTimelineActionsTakeRow}>
                            <span className={styles.statusTimelineActionsLabel}>Take actions</span>
                            <div className={styles.statusTimelineActionsBelow}>
                              <button
                                type="button"
                                className={`${styles.statusTimelineAction} ${styles.statusTimelineActionPrimary}`}
                                onClick={() => openConfirm('verify')}
                                disabled={Boolean(savingStatus)}
                              >
                                {savingStatus.startsWith('Verified-') ? 'Verifying...' : 'Verify'}
                              </button>
                              <button
                                type="button"
                                className={`${styles.statusTimelineAction} ${styles.statusTimelineActionDanger}`}
                                onClick={() => openConfirm('dismiss')}
                                disabled={Boolean(savingStatus)}
                              >
                                {savingStatus.startsWith('Dismissed-') ? 'Dismissing...' : 'Dismiss'}
                              </button>
                            </div>
                          </div>
                        </div>
                      ) : null}
                      {showResolutionActions && item.key === 'resolution' ? (
                        <div className={styles.statusTimelineAssigneeSection}>
                          <div className={styles.statusTimelineActionsBelow}>
                            {post.resolutionStatus === 'In Progress' ? (
                              <>
                                <button
                                  type="button"
                                  className={styles.statusTimelineAction}
                                  onClick={() => openConfirm('add-progress')}
                                  disabled={Boolean(savingStatus)}
                                >
                                  Add Progress
                                </button>
                                <button
                                  type="button"
                                  className={styles.statusTimelineAction}
                                  onClick={() => openConfirm('on-hold')}
                                  disabled={Boolean(savingStatus)}
                                >
                                  On Hold
                                </button>
                                <button
                                  type="button"
                                  className={`${styles.statusTimelineAction} ${styles.statusTimelineActionPrimary}`}
                                  onClick={() => openConfirm('resolved')}
                                  disabled={Boolean(savingStatus)}
                                >
                                  Resolved
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className={styles.statusTimelineAction}
                                onClick={() => openConfirm('back-to-progress')}
                                disabled={Boolean(savingStatus)}
                              >
                                Back to In Progress
                              </button>
                            )}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className={styles.statusReportsPanel}>
            <div className={styles.dismissReportsBox}>
              <div className={styles.dismissReportsHeader}>
                <strong className={styles.dismissReportsTitle}>
                  <span>{dismissReportItems.length || 0}</span>
                  <span>Reports</span>
                </strong>
              </div>
              <div className={styles.dismissReportsList}>
                {dismissReportItems.length > 0 ? (
                  dismissReportItems.map((report) => (
                    <article key={report.id} className={styles.dismissReportItem}>
                      <FlagBanner size={16} weight="duotone" aria-hidden="true" />
                      <strong>{report.title}</strong>
                      <span className={styles.dismissReportCount}>{report.count}</span>
                    </article>
                  ))
                ) : (
                  <div className={styles.dismissReportsEmpty}>
                    <FlagBanner size={30} weight="duotone" aria-hidden="true" />
                    <span>No reports for this feedback.</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>
      </section>
      {confirmMode ? (
        <div
          className={styles.statusConfirmOverlay}
          onMouseDown={(event) => {
            event.stopPropagation();
            if (!savingStatus) closeConfirm();
          }}
        >
          <section
            className={styles.statusConfirmModal}
            role="dialog"
            aria-modal="true"
            aria-labelledby="status-confirm-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header className={styles.statusConfirmHeader}>
              <div className={styles.statusConfirmTitleBlock}>
                <h3 id="status-confirm-title">{confirmTitle}</h3>
              </div>
              <button
                type="button"
                className={styles.feedbackModalClose}
                onClick={closeConfirm}
                aria-label="Close confirmation"
                disabled={Boolean(savingStatus)}
              >
                <X size={18} weight="bold" />
              </button>
            </header>

            <div className={styles.statusConfirmBody}>
              {isRoutingConfirm ? (
                <>
                  <label className={styles.statusConfirmField}>
                    <CustomDropdown
                      value={routeDestination}
                      onChange={(val) => {
                        setRouteDestination(val);
                        setRouteError('');
                      }}
                      options={routingOptions}
                      placeholder={isDelegateConfirm ? 'Select barangay' : 'Select LGU office'}
                      disabled={Boolean(savingStatus)}
                      ariaLabel={isDelegateConfirm ? 'Delegate to barangay admin' : 'Transfer to LGU office'}
                    />
                  </label>
                  <label className={styles.statusConfirmField}>
                    <textarea
                      className={styles.statusConfirmTextarea}
                      aria-label="Action note"
                      placeholder="Note for this action"
                      rows={5}
                      maxLength={ROUTING_NOTE_MAX_LENGTH}
                      value={routeNote}
                      onChange={(event) => {
                        setRouteNote(event.target.value.slice(0, ROUTING_NOTE_MAX_LENGTH));
                        setRouteError('');
                      }}
                      disabled={Boolean(savingStatus)}
                    />
                    <span className={styles.statusConfirmCharCount}>
                      {routeNote.length}/{ROUTING_NOTE_MAX_LENGTH}
                    </span>
                  </label>
                  {routeError ? <span className={styles.statusConfirmError}>{routeError}</span> : null}
                </>
              ) : isVerifyConfirm ? (
                <div className={styles.statusConfirmField}>
                  <div className={styles.statusVerifyChecklistHeader}>
                    <strong>Requirements met</strong>
                    <span>{verifyChecklist.length}/{VERIFY_REASON_OPTIONS.length}</span>
                  </div>
                  <div className={styles.statusVerifyChecklist}>
                    {VERIFY_REASON_OPTIONS.map((item) => (
                      <label key={item} className={styles.statusVerifyChecklistItem}>
                        <input
                          type="checkbox"
                          checked={verifyChecklist.includes(item)}
                          onChange={() => toggleVerifyChecklistItem(item)}
                          disabled={Boolean(savingStatus)}
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                  {verifyError ? <span className={styles.statusConfirmError}>{verifyError}</span> : null}
                </div>
              ) : isResolutionConfirm ? (
                <div className={styles.statusConfirmField}>
                  {isBackToProgressConfirm ? (
                    <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary, #888)' }}>
                      This will move the feedback back to <strong>In Progress</strong> and resume resolution tracking.
                    </p>
                  ) : (
                    <>
                      <label className={styles.statusConfirmField}>
                        <span style={{ display: 'block', marginBottom: '6px', fontSize: '0.8125rem', fontWeight: 600 }}>
                          {isOnHoldConfirm ? 'Reason for holding *' : isResolvedConfirm ? 'Resolution summary *' : 'Progress note *'}
                        </span>
                        <textarea
                          className={styles.statusConfirmTextarea}
                          aria-label="Resolution note"
                          placeholder={
                            isOnHoldConfirm
                              ? 'Describe why this is being put on hold...'
                              : isResolvedConfirm
                                ? 'Describe what was done to resolve this issue...'
                                : 'Describe progress made on this feedback...'
                          }
                          rows={4}
                          maxLength={500}
                          value={resolutionNote}
                          onChange={(e) => { setResolutionNote(e.target.value.slice(0, 500)); setResolutionError(''); }}
                          disabled={Boolean(savingStatus)}
                        />
                        <span className={styles.statusConfirmCharCount}>{resolutionNote.length}/500</span>
                      </label>
                      {(isAddProgressConfirm || isResolvedConfirm) && (
                        <div style={{ marginTop: '10px' }}>
                          <span style={{ display: 'block', marginBottom: '6px', fontSize: '0.8125rem', fontWeight: 600 }}>Photo evidence *</span>
                          <button
                            type="button"
                            className={styles.statusTimelineAction}
                            onClick={() => resolutionPhotoRef.current?.click()}
                            disabled={Boolean(savingStatus)}
                            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
                          >
                            <Paperclip size={15} /> Attach photos
                          </button>
                          <input
                            ref={resolutionPhotoRef}
                            type="file"
                            accept="image/*"
                            multiple
                            style={{ display: 'none' }}
                            onChange={(e) => {
                              const files = Array.from(e.target.files ?? []).slice(0, 5);
                              setResolutionPhotos(files);
                              setResolutionError('');
                              e.target.value = '';
                            }}
                          />
                          {resolutionPhotos.length > 0 && (
                            <div style={{ marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                              {resolutionPhotos.map((f, i) => (
                                <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.8rem', padding: '4px 8px', borderRadius: '6px', background: 'var(--surface-2, #f0f0f0)' }}>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '180px' }}>{f.name}</span>
                                  <button
                                    type="button"
                                    onClick={() => setResolutionPhotos((prev) => prev.filter((_, j) => j !== i))}
                                    aria-label="Remove photo"
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', display: 'flex', alignItems: 'center' }}
                                  >
                                    <X size={13} />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </>
                  )}
                  {resolutionError ? <span className={styles.statusConfirmError}>{resolutionError}</span> : null}
                </div>
              ) : (
                <div className={styles.statusConfirmField}>
                  <div className={styles.statusVerifyChecklistHeader}>
                    <strong>Reason for dismissal</strong>
                    <span>{dismissReason.length} selected</span>
                  </div>
                  <div className={styles.statusVerifyChecklist}>
                    {DISMISS_REASON_OPTIONS.map((item) => (
                      <label key={item} className={styles.statusVerifyChecklistItem}>
                        <input
                          type="checkbox"
                          checked={dismissReason.includes(item)}
                          onChange={() => {
                            setDismissReason((current) =>
                              current.includes(item)
                                ? current.filter((v) => v !== item)
                                : [...current, item]
                            );
                            setDismissError('');
                          }}
                          disabled={Boolean(savingStatus)}
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                  {dismissError ? <span className={styles.statusConfirmError}>{dismissError}</span> : null}
                </div>
              )}
            </div>

            <footer className={styles.statusConfirmFooter}>
              <button
                type="button"
                className={styles.statusConfirmSecondary}
                onClick={closeConfirm}
                disabled={Boolean(savingStatus)}
              >
                Cancel
              </button>
              <button
                type="button"
                className={[
                  styles.statusConfirmPrimary,
                  isDismissConfirm ? styles.statusConfirmDanger : '',
                ].join(' ')}
                onClick={
                  isRoutingConfirm ? submitAdminAction
                    : isVerifyConfirm ? submitVerify
                    : isResolutionConfirm ? submitResolutionAction
                    : submitDismiss
                }
                disabled={Boolean(savingStatus) || (isVerifyConfirm && !verificationChecklistComplete)}
              >
                {savingStatus === 'uploading' ? 'Uploading...'
                  : isVerifyConfirm ? (savingStatus ? 'Verifying...' : 'Verify')
                  : isDismissConfirm ? (savingStatus ? 'Dismissing...' : 'Dismiss')
                  : isTransferConfirm ? (savingStatus ? 'Transferring...' : 'Transfer')
                  : isDelegateConfirm ? (savingStatus ? 'Delegating...' : 'Delegate')
                  : isAddProgressConfirm ? (savingStatus ? 'Saving...' : 'Save Progress')
                  : isOnHoldConfirm ? (savingStatus ? 'Updating...' : 'Put On Hold')
                  : isResolvedConfirm ? (savingStatus ? 'Resolving...' : 'Mark Resolved')
                  : (savingStatus ? 'Updating...' : 'Confirm')}
              </button>
            </footer>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function FeedbackDiscussionContent({ post }) {
  const [refresh, setRefresh] = useState(0);
  const [sortMode, setSortMode] = useState('lgu-response');
  const [expandedReplies, setExpandedReplies] = useState({});
  const { discussions, loading, error: discussionsError } = useDiscussions(post?.id, refresh);

  const discussionGroups = useMemo(() => buildDiscussionGroups(discussions, sortMode), [discussions, sortMode]);
  const activeDiscussionCount = discussionGroups.length;
  const allTopLevelDiscussionCount = useMemo(
    () => discussions.filter((discussion) => !discussion.parentId).length,
    [discussions],
  );

  useEffect(() => {
    const handleRefresh = () => setRefresh((current) => current + 1);
    window.addEventListener('citicontrol:refresh-discussions', handleRefresh);
    return () => window.removeEventListener('citicontrol:refresh-discussions', handleRefresh);
  }, []);

  function getVisibleReplyCount(group) {
    if (!group?.replies?.length) return 0;
    return expandedReplies[group.id] ?? 0;
  }

  function handleShowMoreReplies(group) {
    setExpandedReplies((current) => ({
      ...current,
      [group.id]: Math.min(group.replies.length, getVisibleReplyCount(group) + DEFAULT_VISIBLE_REPLIES),
    }));
  }

  function handleCollapseReplies(group) {
    setExpandedReplies((current) => ({ ...current, [group.id]: 0 }));
  }

  function renderMedia(url) {
    if (!url) return null;
    if (isImage(url)) {
      return (
        <a className={styles.mediaAttachment} href={url} target="_blank" rel="noreferrer">
          <img src={url} alt="" />
        </a>
      );
    }
    if (isVideo(url)) {
      return (
        <div className={styles.mediaAttachment}>
          <video src={url} controls playsInline preload="metadata" />
        </div>
      );
    }
    return <a className={styles.attachment} href={url} target="_blank" rel="noreferrer">{url}</a>;
  }

  if (!post) return null;

  return (
    <div className={styles.discussContainer}>
      <div className={styles.cardWrap}>
        <FeedbackDiscussCard post={{ ...post, discuss: allTopLevelDiscussionCount }} />
      </div>

      <section className={styles.discussSection}>
        <div className={styles.statsRow}>
          <div className={styles.statsLeft}>
            <strong>{activeDiscussionCount} {activeDiscussionCount === 1 ? 'discussion' : 'discussions'}</strong>
          </div>
          <div className={styles.statsRight}>
            <button type="button" className={`${styles.filterBtn} ${sortMode === 'lgu-response' ? styles.filterBtnActive : ''}`} onClick={() => setSortMode('lgu-response')}>
              LGU Response
            </button>
            <button type="button" className={`${styles.filterBtn} ${sortMode === 'popular' ? styles.filterBtnActive : ''}`} onClick={() => setSortMode('popular')}>
              Popular
            </button>
            <button type="button" className={`${styles.filterBtn} ${sortMode === 'recent' ? styles.filterBtnActive : ''}`} onClick={() => setSortMode('recent')}>
              Recent
            </button>
          </div>
        </div>

        <div className={styles.thread}>
          {loading ? <DiscussionThreadSkeleton /> : null}
          {!loading && discussionsError ? <div className={styles.threadError}>Discussion could not load.</div> : null}

          {!loading && discussionGroups.map((discussion) => {
            const visibleReplyCount = getVisibleReplyCount(discussion);
            const visibleReplies = discussion.replies.slice(0, visibleReplyCount);
            const hiddenReplyCount = Math.max(0, discussion.replies.length - visibleReplyCount);
            const showMoreCount = Math.min(DEFAULT_VISIBLE_REPLIES, hiddenReplyCount);
            return (
              <article key={discussion.id} className={styles.discussionCard}>
                <div className={styles.discussionHeader}>
                  <div className={styles.avatar} style={(discussion.author.bg?.startsWith?.('/avatars/') || discussion.author.bg?.startsWith?.('http')) ? { backgroundImage: `url(${discussion.author.bg})` } : { background: discussion.author.bg }}>
                    {!(discussion.author.bg?.startsWith?.('/avatars/') || discussion.author.bg?.startsWith?.('http')) ? discussion.author.initials : null}
                  </div>
                  <div className={styles.discussionHeaderMeta}>
                    <div className={styles.discussionAuthorRow}>
                      <span className={styles.name}>{discussion.author.fullName}</span>
                      {discussion.isAdmin ? <span className={styles.badge}>Admin</span> : null}
                      {discussion.isPinned ? <span className={styles.badgePinned}>LGU Response</span> : null}
                    </div>
                    <div className={styles.discussionTime}>{discussion.displayTime}</div>
                  </div>
                </div>

                <div className={styles.discussionBody}>{discussion.body}</div>
                {renderMedia(discussion.imageUrl)}

                <div className={styles.discussionFooter}>
                  <span className={styles.replyCountLabel}>{discussion.replies.length} {discussion.replies.length === 1 ? 'reply' : 'replies'}</span>
                  <span className={styles.footerDivider} aria-hidden="true" />
                  <Tooltip content={`${formatCount(discussion.likes ?? 0)} ${Number(discussion.likes ?? 0) === 1 ? 'raise' : 'raises'}`}>
                    <span className={styles.discussionMetric} tabIndex={0} aria-label={`${formatCount(discussion.likes ?? 0)} raises`}>
                      <TrayArrowUp size={15} weight="regular" aria-hidden="true" />
                      <span>{formatCount(discussion.likes ?? 0)}</span>
                    </span>
                  </Tooltip>
                </div>

                {visibleReplies.length > 0 ? (
                  <div className={styles.replyList}>
                    {visibleReplies.map((reply) => (
                        <div key={reply.id} className={styles.replyCard}>
                          <div className={styles.replyHeader}>
                            <div className={styles.avatar} style={(reply.author.bg?.startsWith?.('/avatars/') || reply.author.bg?.startsWith?.('http')) ? { backgroundImage: `url(${reply.author.bg})` } : { background: reply.author.bg }}>
                              {!(reply.author.bg?.startsWith?.('/avatars/') || reply.author.bg?.startsWith?.('http')) ? reply.author.initials : null}
                            </div>
                            <div className={styles.replyMeta}>
                              <div className={styles.replyNames}>
                                <span className={styles.replyAuthor}>{reply.author.fullName}</span>
                                {reply.replyTarget ? (
                                  <>
                                    <span className={styles.replyArrow} aria-hidden="true">&gt;</span>
                                    <span className={styles.replyTarget}>{reply.replyTarget}</span>
                                  </>
                                ) : null}
                              </div>
                              <div className={styles.replyTime}>{reply.displayTime}</div>
                            </div>
                          </div>
                          <div className={styles.replyBody}>{reply.body}</div>
                          {renderMedia(reply.imageUrl)}
                          <div className={styles.replyFooter}>
                            <Tooltip content={`${formatCount(reply.likes ?? 0)} ${Number(reply.likes ?? 0) === 1 ? 'raise' : 'raises'}`}>
                              <span className={styles.discussionMetric} tabIndex={0} aria-label={`${formatCount(reply.likes ?? 0)} raises`}>
                                <TrayArrowUp size={15} weight="regular" aria-hidden="true" />
                                <span>{formatCount(reply.likes ?? 0)}</span>
                              </span>
                            </Tooltip>
                          </div>
                        </div>
                    ))}
                  </div>
                ) : null}

                {discussion.replies.length > 0 ? (
                  <div className={`${styles.replyToggleRow} ${visibleReplyCount > 0 ? styles.replyToggleRowIndented : ''}`}>
                    {showMoreCount > 0 ? (
                      <button type="button" className={styles.replyToggleBtn} onClick={() => handleShowMoreReplies(discussion)}>
                        {visibleReplyCount > 0
                          ? `Show ${showMoreCount} more ${showMoreCount === 1 ? 'reply' : 'replies'}`
                          : `Show ${showMoreCount} ${showMoreCount === 1 ? 'reply' : 'replies'}`}
                      </button>
                    ) : null}
                    {visibleReplyCount > 0 ? (
                      <button type="button" className={styles.replyToggleBtn} onClick={() => handleCollapseReplies(discussion)}>Collapse replies</button>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>

        {!loading && !discussionsError && discussionGroups.length === 0 ? (
          <div className={styles.emptyCompactState}>
            <span className={styles.emptyBee} role="img" aria-label="Bee">🐝</span>
            <p>{sortMode === 'lgu-response' ? 'No LGU response yet' : 'No discussion yet'}</p>
            <span>{sortMode === 'lgu-response' ? 'Add an official response so citizens can see the admin update first.' : 'Citizen discussion will appear here for review.'}</span>
          </div>
        ) : null}
      </section>
    </div>
  );
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
  const [detailVisible, setDetailVisible] = useState(false);
  const [statusPostId, setStatusPostId] = useState(null);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [reportsOpen, setReportsOpen] = useState(false);
  const [dismissReasonDraft, setDismissReasonDraft] = useState('');
  const [dismissMode, setDismissMode] = useState(false);
  const [responseDrafts, setResponseDrafts] = useState({});
  const [routingDrafts, setRoutingDrafts] = useState({});
  const [selectedPostIds, setSelectedPostIds] = useState([]);
  const [pageInput, setPageInput] = useState('1');
  const closeTimerRef = useRef(null);
  const statusCloseTimerRef = useRef(null);
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
  const transferOfficeOptions = useMemo(
    () => Array.from(new Set(SERVICE_CATEGORY_OPTIONS.map((option) => option.office).filter(Boolean))).sort((a, b) => a.localeCompare(b)),
    [],
  );
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
  const statusPost = filteredPosts.find((post) => post.id === statusPostId) ?? null;
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
    if (!statusPost && statusPostId != null) {
      setStatusPostId(null);
      setStatusModalVisible(false);
    }
  }, [statusPost, statusPostId]);

  useEffect(() => {
    if (!selectedPost) {
      setDetailVisible(false);
      return undefined;
    }

    const showTimer = window.setTimeout(() => setDetailVisible(true), 10);
    const unlockPageScroll = lockPageScroll();

    return () => {
      window.clearTimeout(showTimer);
      unlockPageScroll();
    };
  }, [selectedPost]);

  useEffect(() => {
    if (!statusPost) {
      setStatusModalVisible(false);
      return undefined;
    }

    const showTimer = window.setTimeout(() => setStatusModalVisible(true), 10);
    const unlockPageScroll = lockPageScroll();

    return () => {
      window.clearTimeout(showTimer);
      unlockPageScroll();
    };
  }, [statusPost]);

  useEffect(() => () => {
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    if (statusCloseTimerRef.current) window.clearTimeout(statusCloseTimerRef.current);
  }, []);

  useEffect(() => {
    if (selectedPost) {
      setDismissReasonDraft('');
    }
  }, [selectedPostId]);

  useEffect(() => {
    if (!isFilteredView) return;
    setSelectedPostIds((current) => current.filter((id) => filteredPosts.some((post) => String(post.id) === id)));
  }, [filteredPosts, isFilteredView]);

  async function handleStatusPatch(post, nextVerification, nextResolution, options = {}) {
    // All feedback types can be verified or dismissed.
    // composeStatus uses post.type to decide whether to enter resolution tracking.
    try {
      const nextStatus = composeStatus(nextVerification, nextResolution, post.type);
      await changeStatus(post.id, nextStatus, options);
      showToast(`Feedback ${post.feedbackNo ?? ''} updated to ${nextStatus}.`, 'success');
      await reload();
      return true;
    } catch (error) {
      showToast(error?.message ?? 'Unable to update the feedback status right now.', 'error');
      return false;
    }
  }

  async function handleDismiss(post) {
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
    showToast('Official response saved locally.', 'info', 3000);
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

  async function handleAdminRoutingAction(post, type, { destination, note }) {
    if (!workspace.isSuperAdmin) {
      showToast('Only Super Admin can transfer or delegate feedback.', 'warning');
      return false;
    }

    const actionLabel = type === 'delegate' ? 'Delegation' : 'Transfer';
    const adminNotes = `${actionLabel}: ${destination}\nNote: ${note}`;


    try {
      await changeStatus(post.id, post.status, { adminNotes });
      showToast(`${actionLabel} queued for ${destination}.`, 'success');
      await reload();
      return true;
    } catch (error) {
      showToast(error?.message ?? `Unable to queue ${actionLabel.toLowerCase()} right now.`, 'error');
      return false;
    }
  }

  function openFeedbackDetail(postId) {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }

    setSelectedPostId(postId);
    setReportsOpen(false);
    setDismissMode(false);
  }

  function openFeedbackUpdate(post) {
    if (statusCloseTimerRef.current) {
      window.clearTimeout(statusCloseTimerRef.current);
      statusCloseTimerRef.current = null;
    }

    setStatusPostId(post.id);
  }

  function closeFeedbackDetail() {
    setDetailVisible(false);
    if (closeTimerRef.current) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = window.setTimeout(() => {
      setSelectedPostId(null);
      setReportsOpen(false);
      setDismissMode(false);
      closeTimerRef.current = null;
    }, DETAIL_CLOSE_ANIMATION_MS);
  }

  function closeFeedbackUpdate() {
    setStatusModalVisible(false);
    if (statusCloseTimerRef.current) window.clearTimeout(statusCloseTimerRef.current);
    statusCloseTimerRef.current = window.setTimeout(() => {
      setStatusPostId(null);
      statusCloseTimerRef.current = null;
    }, DETAIL_CLOSE_ANIMATION_MS);
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
      const filename = `feedbacks-${scope}.xlsx`;
      const success = exportRowsToXlsx(filename, exportRows, 'Feedbacks');

      if (!success) {
        showToast('No feedback records are available to export.', 'warning');
        return;
      }

      showToast('Feedback export generated as EXCEL.', 'success');
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
        { key: 'export-all-xlsx', label: 'EXCEL', onClick: () => handleExport('all', 'xlsx') },
      ],
    },
    {
      key: 'export-current',
      label: 'Current page',
      items: [
        { key: 'export-current-xlsx', label: 'EXCEL', onClick: () => handleExport('current', 'xlsx') },
      ],
    },
    ...(selectedPosts.length ? [{
      key: 'export-selected',
      label: 'Selected',
      items: [
        { key: 'export-selected-xlsx', label: 'EXCEL', onClick: () => handleExport('selected', 'xlsx') },
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
        <button type="button" className={styles.tableTrigger} onClick={() => openFeedbackDetail(post.id)}>
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
        <button type="button" className={styles.feedbackPreview} onClick={() => openFeedbackDetail(post.id)}>
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
      width: 120,
      render: (post) => (
        <div className={styles.actionColumn}>
          <button
            type="button"
            className={styles.actionLink}
            onClick={() => openFeedbackDetail(post.id)}
          >
            View
          </button>
          <button
            type="button"
            className={styles.actionLink}
            onClick={() => openFeedbackUpdate(post)}
          >
            Update
          </button>
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

      <div
        className={[styles.feedbackModalOverlay, selectedPost && detailVisible ? styles.feedbackModalOverlayVisible : ''].join(' ')}
        onMouseDown={closeFeedbackDetail}
      >
        <section
          className={[styles.feedbackModal, selectedPost && detailVisible ? styles.feedbackModalVisible : ''].join(' ')}
          role="dialog"
          aria-modal="true"
          aria-labelledby="feedback-detail-title"
          onMouseDown={(event) => event.stopPropagation()}
        >
          {selectedPost ? (
            <>
              <header className={styles.feedbackModalHeader}>
                <h2 id="feedback-detail-title" className={styles.feedbackModalTitle}>
                  {getDisplayHandle(selectedPost.handle)}'s feedback
                </h2>
                <button type="button" className={styles.feedbackModalClose} onClick={closeFeedbackDetail} aria-label="Close detail">
                  <X size={20} weight="bold" />
                </button>
              </header>

              <div className={styles.feedbackModalContent}>
                <FeedbackDiscussionContent post={selectedPost} />
              </div>

              <footer className={styles.feedbackModalFooter}>
                <DiscussionComposer
                  postId={selectedPost.id}
                  onSent={() => {
                    window.dispatchEvent(new CustomEvent('citicontrol:refresh-discussions'));
                  }}
                />
              </footer>
            </>
          ) : null}
        </section>
      </div>

      <StatusUpdateModal
        post={statusPost}
        visible={Boolean(statusPost && statusModalVisible)}
        workspace={workspace}
        officeOptions={transferOfficeOptions}
        barangayOptions={barangayOptions}
        onClose={closeFeedbackUpdate}
        onStatusPatch={handleStatusPatch}
        onAdminAction={handleAdminRoutingAction}
      />
    </div>
  );
}

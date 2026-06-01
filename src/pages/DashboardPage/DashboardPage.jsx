import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart, ResponsiveContainer, Sector, Tooltip, XAxis, YAxis } from 'recharts';
import {
  CaretDown,
  ClockCountdown,
  DownloadSimple,
  FunnelSimple,
  Sparkle,
  SmileyWink,
  StarHalf,
  Wrench,
} from '@phosphor-icons/react';
import Button from '../../components/ui/Button.jsx';
import Menu from '../../components/ui/Menu.jsx';
import DashboardDateRangeFilter from './DashboardDateRangeFilter.jsx';
import { SERVICE_CATEGORIES, URDANETA_BARANGAYS } from '../../constants/index.js';
import { useAdminStats } from '@core/hooks/useAdminStats.js';
import { useAdminWorkspace } from '@core/hooks/useAdminWorkspace.js';
import { formatMoodLabel, getMoodEmoji } from '@core/utils/mood.js';
import {
  buildAiSummary,
  deriveVerificationStatus,
  getOfficeForService,
  normalizeText,
  scopePostsToWorkspace,
} from '@core/lib/adminWorkspace.js';
import { getScopedMoodSummary } from '@core/services/admin.js';
import { exportRowsToCsv, exportRowsToXlsx, exportSectionsToPrint } from '@core/lib/exporters.js';
import { showToast } from '../../components/Toast/Toast.jsx';
import styles from '../../styles/adminWorkspace.module.css';

const TYPE_COLORS = {
  feedback: '#64748b',
  complaint: '#dc2626',
  suggestion: '#2563eb',
  compliment: '#16a34a',
};

const VERIFIED_STATUSES = ['In Progress', 'On Hold', 'Resolved'];
const DISMISSED_STATUSES = ['Dismissed', 'Closed', 'Invalid'];
const TREND_SERIES = [
  { key: 'feedback', label: 'Feedback' },
  { key: 'complaint', label: 'Complaint' },
  { key: 'suggestion', label: 'Suggestion' },
  { key: 'compliment', label: 'Compliment' },
];
const PERFORMANCE_METRIC_OPTIONS = [
  { value: 'avgResolutionTime', label: 'Avg. resolution time' },
  { value: 'resolutionRate', label: 'Resolution rate' },
  { value: 'satisfactionRate', label: 'Satisfaction rate' },
];
const COMPLAINT_REVIEW_WINDOW_MS = 3 * 24 * 60 * 60 * 1000;

function getDashboardDateRangeLabel(selection) {
  if (selection?.kind === 'month') {
    return new Date(selection.year, selection.month, 1).toLocaleDateString('en-PH', {
      month: 'long',
      year: 'numeric',
    });
  }

  if (selection?.kind === 'preset') {
    if (selection.value === '15d') return 'Last 15 days';
    if (selection.value === '30d') return 'Last 30 days';
  }

  return 'All time';
}

function getReactionDateWindow(selection) {
  if (!selection || (selection.kind === 'preset' && selection.value === 'all')) {
    return { startAt: null, endAt: null };
  }

  if (selection.kind === 'preset') {
    const days = Number.parseInt(selection.value, 10);
    if (!Number.isFinite(days) || days <= 0) {
      return { startAt: null, endAt: null };
    }

    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date(end);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    return {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    };
  }

  if (selection.kind === 'month') {
    const start = new Date(selection.year, selection.month, 1, 0, 0, 0, 0);
    const end = new Date(selection.year, selection.month + 1, 0, 23, 59, 59, 999);
    return {
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    };
  }

  return { startAt: null, endAt: null };
}

function filterPostsByDashboardDateRange(posts, selection) {
  if (!selection) return posts;

  if (selection.kind === 'preset') {
    if (selection.value === 'all') return posts;
    const days = Number.parseInt(selection.value, 10);
    if (!Number.isFinite(days)) return posts;
    const cutoff = Date.now() - (days * 24 * 60 * 60 * 1000);
    return posts.filter((post) => {
      const timestamp = Date.parse(post?.created_at ?? '');
      return Number.isFinite(timestamp) && timestamp >= cutoff;
    });
  }

  if (selection.kind === 'month') {
    return posts.filter((post) => {
      const timestamp = Date.parse(post?.created_at ?? '');
      if (!Number.isFinite(timestamp)) return false;
      const date = new Date(timestamp);
      return date.getFullYear() === selection.year && date.getMonth() === selection.month;
    });
  }

  return posts;
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

function getComplaintPosts(posts) {
  return posts.filter((post) => normalizeText(post.type) === 'complaint');
}

function formatDuration(ms) {
  const hours = Math.max(1, Math.round(ms / 36e5));
  if (hours < 24) return `${hours} hr`;

  const days = ms / (24 * 60 * 60 * 1000);
  if (days < 10) return `${days.toFixed(1)} d`;
  return `${Math.round(days)} d`;
}

function formatMetricValue(metric, value) {
  if (metric === 'avgResolutionTime') {
    if (value == null || !Number.isFinite(value) || value <= 0) return '--';
    return formatDuration(value);
  }

  return `${Math.round(value ?? 0)}%`;
}

function getAverageResolutionDuration(posts) {
  const resolvedDurations = getComplaintPosts(posts)
    .filter((post) => normalizeText(post.status) === 'resolved')
    .map((post) => {
      const createdAt = Date.parse(post.created_at ?? '');
      const closedAt = Date.parse(post.closedAt ?? post.updated_at ?? '');
      if (!Number.isFinite(createdAt) || !Number.isFinite(closedAt) || closedAt <= createdAt) return null;
      return closedAt - createdAt;
    })
    .filter(Boolean);

  if (!resolvedDurations.length) return null;
  return resolvedDurations.reduce((sum, value) => sum + value, 0) / resolvedDurations.length;
}

function getAverageResolutionTime(posts) {
  const averageMs = getAverageResolutionDuration(posts);
  if (!averageMs) {
    return { value: '--', label: 'No resolved feedback yet' };
  }

  return {
    value: formatDuration(averageMs),
    label: 'from the feedbacks',
  };
}

function getResolutionRateValue(posts) {
  const complaintPosts = getComplaintPosts(posts);
  const verifiedCount = complaintPosts.filter((post) => VERIFIED_STATUSES.includes(post.status)).length;
  const resolvedCount = complaintPosts.filter((post) => normalizeText(post.status) === 'resolved').length;

  if (!verifiedCount) return 0;
  return (resolvedCount / verifiedCount) * 100;
}

function getResolutionRate(posts) {
  const complaintPosts = getComplaintPosts(posts);
  const verifiedCount = complaintPosts.filter((post) => VERIFIED_STATUSES.includes(post.status)).length;
  const resolvedCount = complaintPosts.filter((post) => normalizeText(post.status) === 'resolved').length;

  if (!verifiedCount) {
    return { value: '0%', label: `0 of ${complaintPosts.length} complaints resolved` };
  }

  return {
    value: `${Math.round((resolvedCount / verifiedCount) * 100)}%`,
    label: `${resolvedCount} of ${verifiedCount} verified complaints resolved`,
  };
}

function getSatisfactionRateValue(posts) {
  if (!posts.length) return 0;
  const compliments = posts.filter((post) => normalizeText(post.type) === 'compliment').length;
  return (compliments / posts.length) * 100;
}

function getSatisfactionRate(posts) {
  if (!posts.length) {
    return { value: '0%', label: 'No compliments recorded' };
  }

  const compliments = posts.filter((post) => normalizeText(post.type) === 'compliment').length;
  return {
    value: `${Math.round((compliments / posts.length) * 100)}%`,
    label: `${compliments} compliment${compliments === 1 ? '' : 's'} recorded`,
  };
}

function getMoodMetric(summary) {
  if (!summary.total) {
    return {
      icon: '\u{1F636}',
      label: 'No mood data yet',
      detail: 'No reactions recorded in the current scope',
      totalReactions: 0,
      share: null,
    };
  }

  if (!summary.mood) {
    return {
      icon: '\u{1F636}',
      label: 'Low confidence',
      detail: `${summary.total} reactions are still mixed in the current scope`,
      totalReactions: summary.total,
      share: null,
    };
  }

  const share = Math.round(summary.confidence * 100);
  return {
    icon: getMoodEmoji(summary.mood),
    label: formatMoodLabel(summary.mood),
    detail: `${summary.total} reactions in scope | ${share}% dominant share`,
    totalReactions: summary.total,
    share,
  };
}

function buildFeedbacksChart(posts) {
  return [
    { name: 'Complaint', value: posts.filter((post) => normalizeText(post.type) === 'complaint').length, color: TYPE_COLORS.complaint },
    { name: 'Suggestion', value: posts.filter((post) => normalizeText(post.type) === 'suggestion').length, color: TYPE_COLORS.suggestion },
    { name: 'Compliment', value: posts.filter((post) => normalizeText(post.type) === 'compliment').length, color: TYPE_COLORS.compliment },
  ];
}

function buildComplaintsChart(posts) {
  const complaints = getComplaintPosts(posts);
  return [
    { name: 'Under review', value: complaints.filter((post) => deriveVerificationStatus(post.status) === 'Under Review').length, color: '#64748b' },
    { name: 'Verified', value: complaints.filter((post) => VERIFIED_STATUSES.includes(post.status)).length, color: '#2563eb' },
    { name: 'Dismissed', value: complaints.filter((post) => DISMISSED_STATUSES.includes(post.status)).length, color: '#dc2626' },
  ];
}

function buildVerifiedChart(posts) {
  const verified = getComplaintPosts(posts).filter((post) => VERIFIED_STATUSES.includes(post.status));
  return [
    { name: 'In progress', value: verified.filter((post) => post.status === 'In Progress').length, color: '#3b82f6' },
    { name: 'On hold', value: verified.filter((post) => post.status === 'On Hold').length, color: '#f59e0b' },
    { name: 'Resolved', value: verified.filter((post) => normalizeText(post.status) === 'resolved').length, color: '#16a34a' },
  ];
}

function buildResolutionFunnel(posts) {
  const complaints = getComplaintPosts(posts);
  return [
    {
      key: 'under-review',
      label: 'Under Review',
      value: complaints.filter((post) => deriveVerificationStatus(post.status) === 'Under Review').length,
      color: '#64748b',
    },
    {
      key: 'verified',
      label: 'Verified',
      value: complaints.filter((post) => VERIFIED_STATUSES.includes(post.status)).length,
      color: '#2563eb',
    },
    {
      key: 'resolved',
      label: 'Resolved',
      value: complaints.filter((post) => normalizeText(post.status) === 'resolved').length,
      color: '#16a34a',
    },
  ];
}

function buildResponseWindowStatus(posts) {
  const now = Date.now();
  const complaints = getComplaintPosts(posts);
  const result = {
    onTime: 0,
    late: 0,
    overdue: 0,
  };

  complaints.forEach((post) => {
    const createdAt = Date.parse(post.created_at ?? '');
    if (!Number.isFinite(createdAt)) return;

    const deadline = createdAt + COMPLAINT_REVIEW_WINDOW_MS;
    const verificationStatus = deriveVerificationStatus(post.status);

    if (verificationStatus === 'Under Review') {
      if (now > deadline) result.overdue += 1;
      else result.onTime += 1;
      return;
    }

    const reviewedAt = Date.parse(post.closedAt ?? post.updated_at ?? '');
    if (Number.isFinite(reviewedAt) && reviewedAt > deadline) result.late += 1;
    else result.onTime += 1;
  });

  return [
    { key: 'on-time', name: 'On time', value: result.onTime, color: '#16a34a' },
    { key: 'late', name: 'Late', value: result.late, color: '#f59e0b' },
    { key: 'overdue', name: 'Overdue', value: result.overdue, color: '#dc2626' },
  ];
}

function buildDashboardExportRows(posts) {
  return posts.map((post) => ({
    feedback_no: post.feedbackNo ?? '',
    type: post.type ?? '',
    service_category: post.service ?? '',
    office: getOfficeForService(post.service) ?? '',
    incident_location: post.location ?? '',
    status: post.status ?? '',
    final_mood: post.finalMood ? formatMoodLabel(post.finalMood) : '',
    mood_source: post.moodSource ?? '',
    mood_confidence: post.moodConfidence ? Number(post.moodConfidence).toFixed(2) : '',
    reaction_total: post.reactionSummary?.total ?? post.reacts ?? 0,
    created_at: post.created_at ?? '',
  }));
}

function renderBarValueLabel({ x, y, width, value }) {
  return (
    <text
      x={x + width / 2}
      y={y - 10}
      fill="#64748b"
      fontSize={11}
      fontWeight={800}
      textAnchor="middle"
    >
      {value}
    </text>
  );
}

function formatDayKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDateRangeBounds(selection, posts) {
  const today = new Date();
  const end = new Date(today.getFullYear(), today.getMonth(), today.getDate());

  if (selection?.kind === 'preset') {
    if (selection.value === 'all') {
      const timestamps = posts
        .map((post) => Date.parse(post.created_at ?? ''))
        .filter((value) => Number.isFinite(value))
        .sort((a, b) => a - b);

      if (!timestamps.length) return { start: end, end };

      const first = new Date(timestamps[0]);
      return {
        start: new Date(first.getFullYear(), first.getMonth(), first.getDate()),
        end,
      };
    }

    const days = Number.parseInt(selection.value, 10);
    const start = new Date(end);
    start.setDate(end.getDate() - (Math.max(days, 1) - 1));
    return { start, end };
  }

  if (selection?.kind === 'month') {
    const start = new Date(selection.year, selection.month, 1);
    const monthEnd = new Date(selection.year, selection.month + 1, 0);
    return {
      start,
      end: monthEnd > end ? end : monthEnd,
    };
  }

  return { start: end, end };
}

function buildFeedbacksOverTimeData(posts, selection) {
  const { start, end } = getDateRangeBounds(selection, posts);
  const counts = new Map();

  posts.forEach((post) => {
    const timestamp = Date.parse(post.created_at ?? '');
    if (!Number.isFinite(timestamp)) return;
    const date = new Date(timestamp);
    const key = formatDayKey(date);
    const current = counts.get(key) ?? { feedback: 0, complaint: 0, suggestion: 0, compliment: 0 };
    current.feedback += 1;
    const type = normalizeText(post.type);
    if (type === 'complaint' || type === 'suggestion' || type === 'compliment') current[type] += 1;
    counts.set(key, current);
  });

  const rows = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    const key = formatDayKey(cursor);
    const snapshot = counts.get(key) ?? { feedback: 0, complaint: 0, suggestion: 0, compliment: 0 };
    rows.push({
      key,
      label: cursor.toLocaleDateString('en-PH', { month: 'short', day: 'numeric' }),
      feedback: snapshot.feedback,
      complaint: snapshot.complaint,
      suggestion: snapshot.suggestion,
      compliment: snapshot.compliment,
    });
    cursor.setDate(cursor.getDate() + 1);
  }

  return rows;
}

function buildVolumeBreakdownData(posts, keyGetter) {
  const buckets = new Map();

  posts.forEach((post) => {
    const key = String(keyGetter(post) ?? '').trim();
    if (!key) return;
    const current = buckets.get(key) ?? { name: key, feedback: 0, complaint: 0, suggestion: 0, compliment: 0 };
    current.feedback += 1;
    const type = normalizeText(post.type);
    if (type === 'complaint' || type === 'suggestion' || type === 'compliment') current[type] += 1;
    buckets.set(key, current);
  });

  return Array.from(buckets.values())
    .sort((left, right) => right.feedback - left.feedback || left.name.localeCompare(right.name))
    .slice(0, 10);
}

function getPerformanceMetricValue(posts, metric) {
  if (metric === 'avgResolutionTime') return getAverageResolutionDuration(posts);
  if (metric === 'resolutionRate') return getResolutionRateValue(posts);
  return getSatisfactionRateValue(posts);
}

function buildPerformanceRankingData(posts, metric, keyGetter) {
  const buckets = new Map();

  posts.forEach((post) => {
    const key = String(keyGetter(post) ?? '').trim();
    if (!key) return;
    const current = buckets.get(key) ?? [];
    current.push(post);
    buckets.set(key, current);
  });

  const ranked = Array.from(buckets.entries())
    .map(([name, groupPosts]) => {
      const rawValue = getPerformanceMetricValue(groupPosts, metric);
      return {
        name,
        value: Number.isFinite(rawValue) ? rawValue : 0,
        displayValue: formatMetricValue(metric, rawValue),
      };
    })
    .filter((entry) => metric !== 'avgResolutionTime' || entry.value > 0);

  const comparator = metric === 'avgResolutionTime'
    ? (left, right) => left.value - right.value || left.name.localeCompare(right.name)
    : (left, right) => right.value - left.value || left.name.localeCompare(right.name);

  return ranked.sort(comparator).slice(0, 10);
}

function summarizeSimpleBars(title, data) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const lead = [...data].sort((left, right) => right.value - left.value)[0];
  if (!lead) return `${title}: no records are available in the current scope.`;
  return `${title}: ${total} records in view, led by ${lead.name.toLowerCase()} with ${lead.value}.`;
}

function summarizeFunnel(data) {
  const [underReview, verified, resolved] = data;
  if (!underReview && !verified && !resolved) return 'Resolution funnel: no complaint activity is available in the current scope.';
  return `Resolution funnel: ${underReview.value} under review, ${verified.value} verified, and ${resolved.value} resolved.`;
}

function summarizeTrend(data, visibleSeries) {
  const activeSeries = TREND_SERIES.filter((series) => visibleSeries[series.key]);
  if (!activeSeries.length || !data.length) return 'Feedbacks over time: no active series are currently visible.';

  const peak = data.reduce((best, row) => {
    const total = activeSeries.reduce((sum, series) => sum + (row[series.key] ?? 0), 0);
    if (!best || total > best.total) return { label: row.label, total };
    return best;
  }, null);

  const labels = activeSeries.map((series) => series.label.toLowerCase()).join(', ');
  return `Feedbacks over time: tracking ${labels}, with the highest combined volume on ${peak?.label ?? 'the current range'} at ${peak?.total ?? 0}.`;
}

function summarizeVolumeBreakdown(title, data) {
  if (!data.length) return `${title}: no volume is available for the selected date range.`;
  const lead = data[0];
  return `${title}: ${lead.name} leads with ${lead.feedback} feedback records, including ${lead.complaint} complaints, ${lead.suggestion} suggestions, and ${lead.compliment} compliments.`;
}

function summarizePerformance(title, data, metric) {
  if (!data.length) return `${title}: no qualifying performance records are available for the selected date range.`;
  const lead = data[0];
  const metricLabel = PERFORMANCE_METRIC_OPTIONS.find((option) => option.value === metric)?.label ?? 'performance';
  return `${title}: ${lead.name} currently leads for ${metricLabel.toLowerCase()} at ${lead.displayValue}.`;
}

function humanizeKey(value) {
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function buildPrintRows(rows) {
  return rows.map((row) => {
    const entries = Object.entries(row);
    const [firstKey, firstValue] = entries[0] ?? ['label', ''];
    const details = entries
      .slice(1)
      .map(([key, value]) => `${humanizeKey(key)}: ${value}`)
      .join(', ');

    return {
      label: `${humanizeKey(firstKey)} ${firstValue}`,
      value: details || String(firstValue),
    };
  });
}

function DashboardBarChart({ data }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ top: 24, right: 0, left: 0, bottom: 0 }}>
        <XAxis
          dataKey="name"
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
        />
        <YAxis hide />
        <Bar dataKey="value" radius={[6, 6, 2, 2]} barSize={54} minPointSize={4}>
          {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
          <LabelList dataKey="value" position="top" content={renderBarValueLabel} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function DashboardStackedChart({ data, labelKey = 'name' }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 10, right: 30, left: 24, bottom: 0 }}
        barGap="-100%"
        barCategoryGap="26%"
      >
        <CartesianGrid strokeDasharray="3 3" stroke="var(--ui-border)" horizontal={false} />
        <XAxis type="number" allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }} />
        <YAxis
          type="category"
          dataKey={labelKey}
          tickLine={false}
          axisLine={false}
          width={138}
          tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: '1px solid var(--ui-border)',
            fontSize: 12,
            boxShadow: '0 8px 22px rgba(15, 23, 42, 0.08)',
          }}
        />
        <Bar dataKey="feedback" fill={TYPE_COLORS.feedback} radius={[0, 6, 6, 0]} opacity={0.18} />
        <Bar dataKey="complaint" stackId="types" fill={TYPE_COLORS.complaint} radius={[0, 0, 0, 0]} />
        <Bar dataKey="suggestion" stackId="types" fill={TYPE_COLORS.suggestion} radius={[0, 0, 0, 0]} />
        <Bar dataKey="compliment" stackId="types" fill={TYPE_COLORS.compliment} radius={[0, 6, 6, 0]}>
          <LabelList dataKey="feedback" position="right" fill="#64748b" fontSize={11} fontWeight={800} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function renderActiveDonutShape(activeProps) {
  const {
    cx,
    cy,
    innerRadius,
    outerRadius,
    startAngle,
    endAngle,
    fill,
  } = activeProps;

  return (
    <g>
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={innerRadius}
        outerRadius={outerRadius}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
      <Sector
        cx={cx}
        cy={cy}
        innerRadius={outerRadius + 4}
        outerRadius={outerRadius + 8}
        startAngle={startAngle}
        endAngle={endAngle}
        fill={fill}
      />
    </g>
  );
}

function DashboardDonutChart({ data, activeIndex, onSliceEnter, onSliceLeave }) {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  const activeItem = activeIndex == null ? null : data[activeIndex];
  const centerValue = activeItem ? activeItem.value : total;
  const centerLabel = activeItem ? activeItem.name : 'Total';

  return (
    <div className={styles.dashboardDonutWrap}>
      <ResponsiveContainer width="100%" height={260}>
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={96}
            paddingAngle={2}
            activeIndex={activeIndex ?? undefined}
            activeShape={renderActiveDonutShape}
            onMouseEnter={(_, index) => onSliceEnter(index)}
            onMouseLeave={onSliceLeave}
            stroke="none"
          >
            {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
          </Pie>
          <text x="50%" y="46%" textAnchor="middle" dominantBaseline="central" className={styles.dashboardDonutCenterValue}>
            {centerValue}
          </text>
          <text x="50%" y="58%" textAnchor="middle" dominantBaseline="central" className={styles.dashboardDonutCenterLabel}>
            {centerLabel}
          </text>
        </PieChart>
      </ResponsiveContainer>

      <div className={styles.dashboardDonutLegend}>
        {data.map((entry, index) => (
          <button
            key={entry.key ?? entry.name}
            type="button"
            className={styles.dashboardDonutLegendItem}
            onMouseEnter={() => onSliceEnter(index)}
            onMouseLeave={onSliceLeave}
          >
            <span className={styles.dashboardTrendSwatch} style={{ '--trend-color': entry.color }} />
            <span className={styles.dashboardDonutLegendLabel}>{entry.name}</span>
            <span className={styles.dashboardDonutLegendValue}>{entry.value}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function DashboardPerformanceChart({ data, metric }) {
  return (
    <ResponsiveContainer width="100%" height={320}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 50, left: 24, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--ui-border)" horizontal={false} />
        <XAxis
          type="number"
          tickLine={false}
          axisLine={false}
          tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
          tickFormatter={(value) => (metric === 'avgResolutionTime' ? Math.round(value / 36e5) : Math.round(value))}
        />
        <YAxis
          type="category"
          dataKey="name"
          tickLine={false}
          axisLine={false}
          width={150}
          tick={{ fill: '#334155', fontSize: 11, fontWeight: 700 }}
        />
        <Tooltip
          formatter={(value) => formatMetricValue(metric, Number(value))}
          contentStyle={{
            borderRadius: 12,
            border: '1px solid var(--ui-border)',
            fontSize: 12,
            boxShadow: '0 8px 22px rgba(15, 23, 42, 0.08)',
          }}
        />
        <Bar dataKey="value" fill="#2563eb" radius={[0, 6, 6, 0]}>
          <LabelList dataKey="displayValue" position="right" fill="#64748b" fontSize={11} fontWeight={800} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export default function DashboardPage() {
  const { stats, loading } = useAdminStats();
  const workspace = useAdminWorkspace();
  const [dateRange, setDateRange] = useState({ kind: 'preset', value: '30d' });
  const [serviceFilter, setServiceFilter] = useState('all');
  const [barangayFilter, setBarangayFilter] = useState('all');
  const [moodSummary, setMoodSummary] = useState({
    mood: null,
    total: 0,
    confidence: 0,
  });
  const [moodLoading, setMoodLoading] = useState(true);
  const [performanceMetric, setPerformanceMetric] = useState('avgResolutionTime');
  const [visibleSeries, setVisibleSeries] = useState({
    feedback: true,
    complaint: true,
    suggestion: true,
    compliment: true,
  });
  const [activeExplanationKey, setActiveExplanationKey] = useState(null);
  const [activeDonutSlice, setActiveDonutSlice] = useState({
    feedbacks: null,
    complaints: null,
    verified: null,
    responseWindow: null,
  });

  const workspaceScopedPosts = useMemo(
    () => scopePostsToWorkspace(stats?.posts ?? [], workspace),
    [stats?.posts, workspace],
  );

  const scopeFilteredPosts = useMemo(() => workspaceScopedPosts.filter((post) => {
    if (workspace.isSuperAdmin && serviceFilter !== 'all') {
      const service = String(post.service ?? '').trim();
      if (service !== serviceFilter) return false;
    }

    if (workspace.isSuperAdmin && barangayFilter !== 'all') {
      const location = String(post.location ?? '').trim();
      if (location !== barangayFilter) return false;
    }

    return true;
  }), [barangayFilter, serviceFilter, workspace.isSuperAdmin, workspaceScopedPosts]);

  const dateScopedPosts = useMemo(() => {
    const posts = workspaceScopedPosts;
    return filterPostsByDashboardDateRange(posts, dateRange);
  }, [dateRange, workspaceScopedPosts]);

  const filteredPosts = useMemo(() => dateScopedPosts.filter((post) => {
    if (workspace.isSuperAdmin && serviceFilter !== 'all') {
      const service = String(post.service ?? '').trim();
      if (service !== serviceFilter) return false;
    }

    if (workspace.isSuperAdmin && barangayFilter !== 'all') {
      const location = String(post.location ?? '').trim();
      if (location !== barangayFilter) return false;
    }

    return true;
  }), [barangayFilter, dateScopedPosts, serviceFilter, workspace.isSuperAdmin]);

  useEffect(() => {
    let mounted = true;
    const postIds = scopeFilteredPosts.map((post) => post.id).filter(Boolean);
    const { startAt, endAt } = getReactionDateWindow(dateRange);

    if (!postIds.length) {
      setMoodSummary({ mood: null, total: 0, confidence: 0 });
      setMoodLoading(false);
      return () => { mounted = false; };
    }

    setMoodLoading(true);
    getScopedMoodSummary({ postIds, startAt, endAt })
      .then((summary) => {
        if (!mounted) return;
        setMoodSummary(summary);
      })
      .catch((error) => {
        console.error('Dashboard mood summary failed:', error);
        if (!mounted) return;
        setMoodSummary({ mood: null, total: 0, confidence: 0 });
      })
      .finally(() => {
        if (mounted) setMoodLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [dateRange, scopeFilteredPosts]);

  const resolvedCount = filteredPosts.filter((post) => normalizeText(post.status) === 'resolved').length;
  const dismissedCount = filteredPosts.filter((post) => deriveVerificationStatus(post.status) === 'Dismissed').length;

  const serviceOptions = useMemo(
    () => SERVICE_CATEGORIES.filter((category) => (stats?.posts ?? []).some((post) => String(post.service ?? '').trim() === category)),
    [stats?.posts],
  );
  const barangayOptions = useMemo(
    () => URDANETA_BARANGAYS.filter((barangay) => (stats?.posts ?? []).some((post) => String(post.location ?? '').trim() === barangay)),
    [stats?.posts],
  );

  const moodMetric = useMemo(() => getMoodMetric(moodSummary), [moodSummary]);
  const avgResolutionMetric = useMemo(() => getAverageResolutionTime(filteredPosts), [filteredPosts]);
  const resolutionRateMetric = useMemo(() => getResolutionRate(filteredPosts), [filteredPosts]);
  const satisfactionRateMetric = useMemo(() => getSatisfactionRate(filteredPosts), [filteredPosts]);

  const feedbacksChart = useMemo(() => buildFeedbacksChart(filteredPosts), [filteredPosts]);
  const complaintsChart = useMemo(() => buildComplaintsChart(filteredPosts), [filteredPosts]);
  const verifiedChart = useMemo(() => buildVerifiedChart(filteredPosts), [filteredPosts]);
  const resolutionFunnel = useMemo(() => buildResolutionFunnel(filteredPosts), [filteredPosts]);
  const responseWindowChart = useMemo(() => buildResponseWindowStatus(filteredPosts), [filteredPosts]);
  const feedbacksOverTimeData = useMemo(() => buildFeedbacksOverTimeData(filteredPosts, dateRange), [dateRange, filteredPosts]);

  const topServiceCategories = useMemo(
    () => buildVolumeBreakdownData(dateScopedPosts, (post) => post.service),
    [dateScopedPosts],
  );
  const topIncidentLocations = useMemo(
    () => buildVolumeBreakdownData(dateScopedPosts, (post) => post.location),
    [dateScopedPosts],
  );
  const topOfficesByPerformance = useMemo(
    () => buildPerformanceRankingData(dateScopedPosts, performanceMetric, (post) => getOfficeForService(post.service)),
    [dateScopedPosts, performanceMetric],
  );
  const topBarangaysByPerformance = useMemo(
    () => buildPerformanceRankingData(dateScopedPosts, performanceMetric, (post) => post.location),
    [dateScopedPosts, performanceMetric],
  );

  const dashboardSummary = buildAiSummary({
    roleLabel: workspace.roleLabel,
    scopeLabel: workspace.scopeLabel,
    totalPosts: filteredPosts.length,
    pendingCount: getComplaintPosts(filteredPosts).filter((post) => deriveVerificationStatus(post.status) === 'Under Review').length,
    resolvedCount,
    dismissedCount,
    topService: serviceFilter !== 'all' ? serviceFilter : null,
  });

  const chartExplanations = useMemo(() => ({
    feedbacks: summarizeSimpleBars('Feedbacks', feedbacksChart),
    complaints: summarizeSimpleBars('Complaints', complaintsChart),
    verified: summarizeSimpleBars('Verified', verifiedChart),
    trend: summarizeTrend(feedbacksOverTimeData, visibleSeries),
    funnel: summarizeFunnel(resolutionFunnel),
    responseWindow: summarizeSimpleBars('Response window status', responseWindowChart),
    serviceVolume: summarizeVolumeBreakdown('Top service categories by feedback volume', topServiceCategories),
    locationVolume: summarizeVolumeBreakdown('Top incident locations by feedback volume', topIncidentLocations),
    officePerformance: summarizePerformance('Top LGU offices by performance', topOfficesByPerformance, performanceMetric),
    barangayPerformance: summarizePerformance('Top barangay offices by performance', topBarangaysByPerformance, performanceMetric),
  }), [
    complaintsChart,
    feedbacksChart,
    feedbacksOverTimeData,
    performanceMetric,
    resolutionFunnel,
    responseWindowChart,
    topBarangaysByPerformance,
    topIncidentLocations,
    topOfficesByPerformance,
    topServiceCategories,
    verifiedChart,
    visibleSeries,
  ]);

  function handleCsvExport() {
    const success = exportRowsToCsv('admin-dashboard-feedback.csv', buildDashboardExportRows(filteredPosts));
    if (!success) {
      showToast('No dashboard records are available to export yet.', 'warning');
      return;
    }
    showToast('Dashboard CSV export prepared.', 'success');
  }

  function handleXlsxExport() {
    const success = exportRowsToXlsx('admin-dashboard-feedback.xlsx', buildDashboardExportRows(filteredPosts), 'Dashboard');
    if (!success) {
      showToast('No dashboard records are available to export yet.', 'warning');
      return;
    }
    showToast('Dashboard XLSX export prepared.', 'success');
  }

  function handlePdfExport() {
    const success = exportSectionsToPrint({
      title: `${workspace.roleLabel} Dashboard Report`,
      subtitle: `${workspace.scopeLabel} | ${filteredPosts.length} feedback records in scope`,
      sections: [
        {
          heading: 'Key Performance Indicators',
          rows: [
            { label: 'Mood', value: moodMetric.label },
            { label: 'Mood detail', value: moodMetric.detail },
            { label: 'Avg. resolution time', value: avgResolutionMetric.value },
            { label: 'Resolution rate', value: resolutionRateMetric.value },
            { label: 'Satisfaction rate', value: satisfactionRateMetric.value },
          ],
        },
        {
          heading: 'Summary',
          rows: [
            { label: 'Scope', value: workspace.scopeLabel },
            { label: 'Date range', value: getDashboardDateRangeLabel(dateRange) },
            { label: 'Feedback volume', value: String(filteredPosts.length) },
            { label: 'Resolved', value: String(resolvedCount) },
            { label: 'Dismissed', value: String(dismissedCount) },
            { label: 'Narrative', value: dashboardSummary },
          ],
        },
      ],
    });

    if (!success) {
      showToast('Allow pop-ups first so the printable report can open.', 'warning');
      return;
    }
    showToast('Printable dashboard report opened in a new window.', 'success');
  }

  function handleChartExport(format, { filename, title, rows }) {
    if (!rows.length) {
      showToast('No chart data is available to export yet.', 'warning');
      return;
    }

    if (format === 'csv') {
      exportRowsToCsv(`${filename}.csv`, rows);
      showToast(`${title} CSV export prepared.`, 'success');
      return;
    }

    if (format === 'xlsx') {
      exportRowsToXlsx(`${filename}.xlsx`, rows, title);
      showToast(`${title} XLSX export prepared.`, 'success');
      return;
    }

    const success = exportSectionsToPrint({
      title: `${title} Report`,
      subtitle: `${workspace.scopeLabel} | ${getDashboardDateRangeLabel(dateRange)}`,
      sections: [{ heading: title, rows: buildPrintRows(rows) }],
    });
    if (!success) {
      showToast('Allow pop-ups first so the printable report can open.', 'warning');
      return;
    }
    showToast(`Printable ${title.toLowerCase()} report opened in a new window.`, 'success');
  }

  function getChartExportItems(config) {
    return [
      { key: `${config.filename}-csv`, label: 'CSV', onClick: () => handleChartExport('csv', config) },
      { key: `${config.filename}-xlsx`, label: 'XLSX', onClick: () => handleChartExport('xlsx', config) },
      { key: `${config.filename}-pdf`, label: 'PDF', onClick: () => handleChartExport('pdf', config) },
    ];
  }

  function toggleExplanation(chartKey) {
    setActiveExplanationKey((current) => (current === chartKey ? null : chartKey));
  }

  function setDonutHover(chartKey, index) {
    setActiveDonutSlice((current) => ({ ...current, [chartKey]: index }));
  }

  function renderChartTools(chartKey, exportConfig, leadingActions = null) {
    return (
      <div className={styles.chartActions}>
        {leadingActions}

        <Button
          type="button"
          variant={activeExplanationKey === chartKey ? 'secondary' : 'ghost'}
          size="icon"
          className={styles.chartIconButton}
          aria-label="Explain this chart"
          title="Explain this chart"
          onClick={() => toggleExplanation(chartKey)}
        >
          <Sparkle size={16} weight="bold" />
        </Button>

        <Menu
          align="end"
          items={getChartExportItems(exportConfig)}
          trigger={(
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={styles.chartIconButton}
              aria-label="Export chart"
              title="Export chart"
            >
              <DownloadSimple size={16} weight="bold" />
            </Button>
          )}
        />
      </div>
    );
  }

  const exportMenuItems = [
    { key: 'export-csv', label: 'CSV', onClick: handleCsvExport },
    { key: 'export-xlsx', label: 'XLSX', onClick: handleXlsxExport },
    { key: 'export-pdf', label: 'PDF', onClick: handlePdfExport },
  ];

  const performanceMetricTrigger = (
    <Menu
      align="end"
      items={createMenuItems(PERFORMANCE_METRIC_OPTIONS, performanceMetric, setPerformanceMetric)}
      trigger={(
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={styles.chartIconButton}
          aria-label="Choose performance metric"
          title="Choose performance metric"
        >
          <FunnelSimple size={16} weight="bold" />
        </Button>
      )}
    />
  );

  return (
    <div className={`${styles.page} ${styles.pageWide}`}>
      <div className={`${styles.pageHeader} ${styles.dashboardHeader}`}>
        <div>
          <h1 className={styles.pageTitle}>Dashboard</h1>
          <p className={styles.pageSubtitle}>{workspace.scopeLabel}</p>
        </div>

        <div className={`${styles.pageActions} ${styles.dashboardActions}`}>
          <div className={styles.dashboardFilterGroup}>
            <DashboardDateRangeFilter
              value={dateRange}
              onChange={setDateRange}
              className={`${styles.filterMenuTrigger} ${dateRange.kind === 'month' || dateRange.value !== 'all' ? styles.filterMenuTriggerActive : ''}`}
            />
            {workspace.isSuperAdmin ? (
              <Menu
                align="start"
                items={[
                  { key: 'all-services', label: 'All category', active: serviceFilter === 'all', onClick: () => setServiceFilter('all') },
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
            {workspace.isSuperAdmin ? (
              <Menu
                align="start"
                items={[
                  { key: 'all-barangays', label: 'All location', active: barangayFilter === 'all', onClick: () => setBarangayFilter('all') },
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
          </div>

          <Menu
            align="end"
            items={exportMenuItems}
            trigger={(
              <Button variant="secondary" size="md">
                <DownloadSimple size={15} weight="bold" />
                Export
              </Button>
            )}
          />
        </div>
      </div>

      <section className={styles.kpiRail}>
        <div className={styles.kpiGrid}>
          <article className={styles.kpiCard}>
            <div className={styles.kpiTopRow}>
              <span className={styles.kpiTitle}>Mood</span>
              <span className={styles.kpiIcon}><SmileyWink size={18} weight="duotone" /></span>
            </div>
            <strong className={styles.kpiValue}>{loading || moodLoading ? '...' : moodMetric.icon}</strong>
            <span className={styles.kpiValueLabel}>{loading || moodLoading ? 'Loading mood signal' : moodMetric.label}</span>
            <span className={styles.kpiMeta}>{loading || moodLoading ? 'Checking current scope reactions' : moodMetric.detail}</span>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiTopRow}>
              <span className={styles.kpiTitle}>Avg. Resolution Time</span>
              <span className={styles.kpiIcon}><ClockCountdown size={18} weight="duotone" /></span>
            </div>
            <strong className={styles.kpiValue}>{loading ? '...' : avgResolutionMetric.value}</strong>
            <span className={styles.kpiValueLabel}>{avgResolutionMetric.label}</span>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiTopRow}>
              <span className={styles.kpiTitle}>Resolution Rate</span>
              <span className={styles.kpiIcon}><Wrench size={18} weight="duotone" /></span>
            </div>
            <strong className={styles.kpiValue}>{loading ? '...' : resolutionRateMetric.value}</strong>
            <span className={styles.kpiValueLabel}>{resolutionRateMetric.label}</span>
          </article>

          <article className={styles.kpiCard}>
            <div className={styles.kpiTopRow}>
              <span className={styles.kpiTitle}>Satisfaction Rate</span>
              <span className={styles.kpiIcon}><StarHalf size={18} weight="duotone" /></span>
            </div>
            <strong className={styles.kpiValue}>{loading ? '...' : satisfactionRateMetric.value}</strong>
            <span className={styles.kpiValueLabel}>{satisfactionRateMetric.label}</span>
          </article>
        </div>
      </section>

      <div className={styles.dashboardBarRow}>
        <article className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <strong className={styles.dashboardChartTitle}>Feedbacks</strong>
            {renderChartTools('feedbacks', {
              filename: 'dashboard-feedbacks',
              title: 'Feedbacks',
              rows: feedbacksChart.map((item) => ({ label: item.name, count: item.value })),
            })}
          </div>
          {activeExplanationKey === 'feedbacks' ? <div className={styles.summaryBox}>{chartExplanations.feedbacks}</div> : null}
          <div className={styles.dashboardDonutBody}>
            <DashboardDonutChart
              data={feedbacksChart}
              activeIndex={activeDonutSlice.feedbacks}
              onSliceEnter={(index) => setDonutHover('feedbacks', index)}
              onSliceLeave={() => setDonutHover('feedbacks', null)}
            />
          </div>
        </article>

        <article className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <strong className={styles.dashboardChartTitle}>Complaints</strong>
            {renderChartTools('complaints', {
              filename: 'dashboard-complaints',
              title: 'Complaints',
              rows: complaintsChart.map((item) => ({ label: item.name, count: item.value })),
            })}
          </div>
          {activeExplanationKey === 'complaints' ? <div className={styles.summaryBox}>{chartExplanations.complaints}</div> : null}
          <div className={styles.dashboardDonutBody}>
            <DashboardDonutChart
              data={complaintsChart}
              activeIndex={activeDonutSlice.complaints}
              onSliceEnter={(index) => setDonutHover('complaints', index)}
              onSliceLeave={() => setDonutHover('complaints', null)}
            />
          </div>
        </article>

        <article className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <strong className={styles.dashboardChartTitle}>Verified</strong>
            {renderChartTools('verified', {
              filename: 'dashboard-verified',
              title: 'Verified',
              rows: verifiedChart.map((item) => ({ label: item.name, count: item.value })),
            })}
          </div>
          {activeExplanationKey === 'verified' ? <div className={styles.summaryBox}>{chartExplanations.verified}</div> : null}
          <div className={styles.dashboardDonutBody}>
            <DashboardDonutChart
              data={verifiedChart}
              activeIndex={activeDonutSlice.verified}
              onSliceEnter={(index) => setDonutHover('verified', index)}
              onSliceLeave={() => setDonutHover('verified', null)}
            />
          </div>
        </article>
      </div>

      <article className={`${styles.chartCard} ${styles.dashboardTrendCard}`}>
        <div className={`${styles.chartHeader} ${styles.dashboardTrendHeader}`}>
          <div className={styles.dashboardTrendHeaderMain}>
            <strong className={styles.dashboardChartTitle}>Feedbacks Over Time</strong>
            <div className={styles.dashboardTrendLegend}>
              {TREND_SERIES.map((series) => (
                <label key={series.key} className={styles.dashboardTrendLegendItem}>
                  <input
                    type="checkbox"
                    className={styles.dashboardTrendCheckbox}
                    checked={visibleSeries[series.key]}
                    onChange={() => setVisibleSeries((current) => ({ ...current, [series.key]: !current[series.key] }))}
                  />
                  <span
                    className={styles.dashboardTrendSwatch}
                    style={{ '--trend-color': TYPE_COLORS[series.key] }}
                  />
                  <span className={styles.dashboardTrendLabel}>{series.label}</span>
                </label>
              ))}
            </div>
          </div>
          {renderChartTools('trend', {
            filename: 'dashboard-feedbacks-over-time',
            title: 'Feedbacks Over Time',
            rows: feedbacksOverTimeData,
          })}
        </div>

        {activeExplanationKey === 'trend' ? <div className={styles.summaryBox}>{chartExplanations.trend}</div> : null}

        <div className={styles.dashboardTrendChartBody}>
          <ResponsiveContainer width="100%" height={320}>
            <LineChart data={feedbacksOverTimeData} margin={{ top: 24, right: 8, left: -8, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ui-border)" vertical={false} />
              <XAxis
                dataKey="label"
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
                interval={0}
                angle={feedbacksOverTimeData.length > 12 ? -35 : 0}
                textAnchor={feedbacksOverTimeData.length > 12 ? 'end' : 'middle'}
                height={feedbacksOverTimeData.length > 12 ? 56 : 32}
              />
              <YAxis
                allowDecimals={false}
                tickLine={false}
                axisLine={false}
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 700 }}
              />
              <Tooltip
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid var(--ui-border)',
                  fontSize: 12,
                  boxShadow: '0 8px 22px rgba(15, 23, 42, 0.08)',
                }}
              />
              {TREND_SERIES.filter((series) => visibleSeries[series.key]).map((series) => (
                <Line
                  key={series.key}
                  type="monotone"
                  dataKey={series.key}
                  stroke={TYPE_COLORS[series.key]}
                  strokeWidth={2.5}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </article>

      <div className={styles.dashboardTwinGrid}>
        <article className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <strong className={styles.dashboardChartTitle}>Resolution Funnel</strong>
            {renderChartTools('funnel', {
              filename: 'dashboard-resolution-funnel',
              title: 'Resolution Funnel',
              rows: resolutionFunnel.map((step) => ({ stage: step.label, count: step.value })),
            })}
          </div>
          {activeExplanationKey === 'funnel' ? <div className={styles.summaryBox}>{chartExplanations.funnel}</div> : null}
          <div className={styles.dashboardFunnelBody}>
            <div className={styles.dashboardFunnelStack}>
              {resolutionFunnel.map((step, index) => {
                const maxValue = resolutionFunnel[0]?.value || 1;
                const relativeWidth = Math.max(42, Math.round((step.value / maxValue) * 100));
                return (
                  <div key={step.key} className={styles.dashboardFunnelStepWrap}>
                    <div
                      className={styles.dashboardFunnelStep}
                      style={{ '--funnel-width': `${relativeWidth}%`, '--funnel-color': step.color }}
                    >
                      <span className={styles.dashboardFunnelLabel}>{step.label}</span>
                      <strong className={styles.dashboardFunnelValue}>{step.value}</strong>
                    </div>
                    {index < resolutionFunnel.length - 1 ? <div className={styles.dashboardFunnelConnector} aria-hidden="true" /> : null}
                  </div>
                );
              })}
            </div>
          </div>
        </article>

        <article className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <strong className={styles.dashboardChartTitle}>Response Window Status</strong>
            {renderChartTools('responseWindow', {
              filename: 'dashboard-response-window-status',
              title: 'Response Window Status',
              rows: responseWindowChart.map((item) => ({ status: item.name, count: item.value })),
            })}
          </div>
          {activeExplanationKey === 'responseWindow' ? <div className={styles.summaryBox}>{chartExplanations.responseWindow}</div> : null}
          <div className={styles.dashboardDonutBody}>
            <DashboardDonutChart
              data={responseWindowChart}
              activeIndex={activeDonutSlice.responseWindow}
              onSliceEnter={(index) => setDonutHover('responseWindow', index)}
              onSliceLeave={() => setDonutHover('responseWindow', null)}
            />
          </div>
        </article>
      </div>

      {workspace.isSuperAdmin ? (
        <section className={styles.dashboardSection}>
          <div className={styles.dashboardSectionHeader}>
            <h2 className={styles.dashboardSectionTitle}>Time-Based Charts</h2>
          </div>

          <div className={styles.dashboardTwinGrid}>
            <article className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <strong className={styles.dashboardChartTitle}>Top 10 Service Categories by Feedback Volume</strong>
                {renderChartTools('serviceVolume', {
                  filename: 'dashboard-top-service-categories',
                  title: 'Top Service Categories by Feedback Volume',
                  rows: topServiceCategories,
                })}
              </div>
              {activeExplanationKey === 'serviceVolume' ? <div className={styles.summaryBox}>{chartExplanations.serviceVolume}</div> : null}
              <div className={styles.dashboardLargeChartBody}>
                <DashboardStackedChart data={topServiceCategories} />
              </div>
            </article>

            <article className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <strong className={styles.dashboardChartTitle}>Top 10 Incident Locations by Feedback Volume</strong>
                {renderChartTools('locationVolume', {
                  filename: 'dashboard-top-incident-locations',
                  title: 'Top Incident Locations by Feedback Volume',
                  rows: topIncidentLocations,
                })}
              </div>
              {activeExplanationKey === 'locationVolume' ? <div className={styles.summaryBox}>{chartExplanations.locationVolume}</div> : null}
              <div className={styles.dashboardLargeChartBody}>
                <DashboardStackedChart data={topIncidentLocations} />
              </div>
            </article>
          </div>

          <div className={styles.dashboardTwinGrid}>
            <article className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <strong className={styles.dashboardChartTitle}>Top 10 LGU Offices by Performance</strong>
                {renderChartTools(
                  'officePerformance',
                  {
                    filename: 'dashboard-top-lgu-offices',
                    title: 'Top LGU Offices by Performance',
                    rows: topOfficesByPerformance.map((item) => ({ office: item.name, metric: item.displayValue })),
                  },
                  performanceMetricTrigger,
                )}
              </div>
              {activeExplanationKey === 'officePerformance' ? <div className={styles.summaryBox}>{chartExplanations.officePerformance}</div> : null}
              <div className={styles.dashboardLargeChartBody}>
                <DashboardPerformanceChart data={topOfficesByPerformance} metric={performanceMetric} />
              </div>
            </article>

            <article className={styles.chartCard}>
              <div className={styles.chartHeader}>
                <strong className={styles.dashboardChartTitle}>Top 10 Barangay Offices by Performance</strong>
                {renderChartTools(
                  'barangayPerformance',
                  {
                    filename: 'dashboard-top-barangay-offices',
                    title: 'Top Barangay Offices by Performance',
                    rows: topBarangaysByPerformance.map((item) => ({ barangay: item.name, metric: item.displayValue })),
                  },
                  performanceMetricTrigger,
                )}
              </div>
              {activeExplanationKey === 'barangayPerformance' ? <div className={styles.summaryBox}>{chartExplanations.barangayPerformance}</div> : null}
              <div className={styles.dashboardLargeChartBody}>
                <DashboardPerformanceChart data={topBarangaysByPerformance} metric={performanceMetric} />
              </div>
            </article>
          </div>
        </section>
      ) : null}
    </div>
  );
}

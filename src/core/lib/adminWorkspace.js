import { SERVICE_CATEGORY_OPTIONS } from '@/constants/index.js';
import { USER_ROLES } from './auth/roles.js';

export const DATE_RANGE_OPTIONS = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
  { value: 'all', label: 'All time' },
];

export const ROLE_PAGE_CONFIG = {
  [USER_ROLES.LGU_ADMIN]: [
    { key: 'dashboard', icon: 'SquaresFour', label: 'Dashboard' },
    { key: 'feedbacks', icon: 'Rows', label: 'Feedbacks' },
    { key: 'activity', icon: 'Scroll', label: 'Activity Logs' },
    { key: 'exports', icon: 'DownloadSimple', label: 'Exports' },
  ],
  [USER_ROLES.BARANGAY_ADMIN]: [
    { key: 'dashboard', icon: 'SquaresFour', label: 'Dashboard' },
    { key: 'feedbacks', icon: 'Rows', label: 'Feedbacks' },
    { key: 'activity', icon: 'Scroll', label: 'Activity Logs' },
    { key: 'exports', icon: 'DownloadSimple', label: 'Exports' },
  ],
  [USER_ROLES.SUPER_ADMIN]: [
    { key: 'dashboard', icon: 'SquaresFour', label: 'Dashboard' },
    { key: 'feedbacks', icon: 'Rows', label: 'Feedbacks' },
    { key: 'reports', icon: 'WarningCircle', label: 'Reports' },
    { key: 'accounts', icon: 'Users', label: 'Accounts' },
    { key: 'activity', icon: 'Scroll', label: 'Activity Logs' },
    { key: 'exports', icon: 'DownloadSimple', label: 'Exports' },
  ],
};

export function normalizeText(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function getOfficeForService(service) {
  const match = SERVICE_CATEGORY_OPTIONS.find(({ value }) => normalizeText(value) === normalizeText(service));
  return match?.office ?? null;
}

export function inferServiceCategoryFromOffice(office) {
  const match = SERVICE_CATEGORY_OPTIONS.find(({ office: optionOffice }) => normalizeText(optionOffice) === normalizeText(office));
  return match?.value ?? null;
}

export function getRoleLabel(role) {
  if (role === USER_ROLES.SUPER_ADMIN) return 'Super Admin';
  if (role === USER_ROLES.BARANGAY_ADMIN) return 'Barangay Admin';
  return 'LGU Admin';
}

export function getRoleSummary(role) {
  if (role === USER_ROLES.SUPER_ADMIN) return 'Platform oversight, account control, and system governance.';
  if (role === USER_ROLES.BARANGAY_ADMIN) return 'Barangay queue review, status updates, and delegated action.';
  return 'Office queue review, service coordination, and delegation.';
}

export function getScopeLabel(workspace) {
  if (workspace.role === USER_ROLES.SUPER_ADMIN) return 'System-wide scope';
  if (workspace.role === USER_ROLES.BARANGAY_ADMIN) return workspace.barangay ? `Barangay ${workspace.barangay}` : 'Barangay scope';
  if (workspace.office && workspace.serviceCategory) return `${workspace.office} / ${workspace.serviceCategory}`;
  return workspace.office || workspace.serviceCategory || 'Office scope';
}

export function scopePostsToWorkspace(posts = [], workspace) {
  if (!Array.isArray(posts)) return [];
  if (!workspace || workspace.role === USER_ROLES.SUPER_ADMIN) return posts;

  if (workspace.role === USER_ROLES.BARANGAY_ADMIN) {
    const barangay = normalizeText(workspace.barangay);
    return posts.filter((post) => {
      const location = normalizeText(post.location ?? post.barangay);
      return barangay && location.includes(barangay);
    });
  }

  const serviceCategory = normalizeText(workspace.serviceCategory);
  const office = normalizeText(workspace.office);
  return posts.filter((post) => {
    const postService = normalizeText(post.service);
    const postOffice = normalizeText(getOfficeForService(post.service));
    return (
      (serviceCategory && postService === serviceCategory) ||
      (office && postOffice === office)
    );
  });
}

export function filterByDateRange(rows = [], range = 'all', dateKey = 'created_at') {
  if (range === 'all') return rows;

  const days = Number.parseInt(range, 10);
  if (!Number.isFinite(days)) return rows;

  const now = Date.now();
  const cutoff = now - (days * 24 * 60 * 60 * 1000);
  return rows.filter((row) => {
    const timestamp = Date.parse(row?.[dateKey] ?? '');
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  });
}

export function deriveVerificationStatus(status) {
  const normalized = normalizeText(status);
  if (normalized === 'dismissed' || normalized === 'invalid' || normalized === 'closed') return 'Dismissed';
  if (normalized === 'in progress' || normalized === 'on hold' || normalized === 'resolved') return 'Verified';
  return 'Under Review';
}

export function deriveResolutionStatus(status) {
  const normalized = normalizeText(status);
  if (normalized === 'in progress') return 'In Progress';
  if (normalized === 'on hold') return 'On Hold';
  if (normalized === 'resolved') return 'Resolved';
  return 'Not Started';
}

export function composeStatus(verification, resolution) {
  if (verification === 'Dismissed') return 'Dismissed';
  if (verification === 'Verified') {
    if (resolution === 'Resolved') return 'Resolved';
    if (resolution === 'On Hold') return 'On hold';
    return 'In Progress';
  }
  return 'Under Review';
}

export function buildAiSummary({ roleLabel, scopeLabel, totalPosts, pendingCount, resolvedCount, dismissedCount, topService }) {
  const serviceLine = topService ? `Highest volume: ${topService}.` : 'No dominant service category.';
  return `${roleLabel}, ${scopeLabel}: ${totalPosts} records in scope, ${pendingCount} need attention, ${resolvedCount} resolved, ${dismissedCount} dismissed. ${serviceLine}`;
}

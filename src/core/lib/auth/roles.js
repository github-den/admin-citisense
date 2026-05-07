export const USER_ROLES = Object.freeze({
  GUEST: 'guest',
  CITIZEN: 'citizen',
  LGU_ADMIN: 'lgu_admin',
  BARANGAY_ADMIN: 'barangay_admin',
  SUPER_ADMIN: 'super_admin',
});

const ADMIN_ROLE_SET = new Set([
  USER_ROLES.LGU_ADMIN,
  USER_ROLES.BARANGAY_ADMIN,
  USER_ROLES.SUPER_ADMIN,
]);

const ROLE_CAPABILITIES = {
  [USER_ROLES.GUEST]: [
    'feed.read.public',
    'auth.login',
    'auth.signup',
    'shared.feedback.read',
    'shared.feedbox.read',
  ],
  [USER_ROLES.CITIZEN]: [
    'feed.read.personalized',
    'feedback.create',
    'feedback.raise',
    'feedback.react',
    'feedback.share',
    'feedback.save',
    'discussion.create',
    'discussion.reply',
    'discussion.react',
    'profile.edit',
    'track.read.own',
    'notifications.read',
  ],
  [USER_ROLES.LGU_ADMIN]: [
    'admin.dashboard.read.office',
    'admin.feedback.manage.office',
    'admin.feedbox.read.office',
    'admin.initiative.manage',
    'admin.activity.read.ownOffice',
  ],
  [USER_ROLES.BARANGAY_ADMIN]: [
    'admin.dashboard.read.barangay',
    'admin.feedback.manage.delegated',
    'admin.feedbox.read.barangay',
    'admin.activity.read.ownBarangay',
  ],
  [USER_ROLES.SUPER_ADMIN]: [
    'admin.dashboard.read.system',
    'admin.feedback.manage.all',
    'admin.accounts.manage',
    'admin.reports.manage',
    'admin.feedbox.manage.all',
    'admin.system.manage',
  ],
};

export function normalizeRole(role) {
  const normalized = String(role ?? '').trim().toLowerCase();
  if (!normalized) return USER_ROLES.GUEST;
  // Map generic admin to lgu_admin if legacy data exists
  if (normalized === 'admin') return USER_ROLES.LGU_ADMIN;
  return normalized;
}

export function getUserRole(session) {
  if (!session?.user) return USER_ROLES.GUEST;

  const metadataRole = session.user.user_metadata?.role;
  const appRole = session.user.app_metadata?.role;
  const resolvedRole = normalizeRole(metadataRole || appRole);

  if (resolvedRole === USER_ROLES.GUEST) return USER_ROLES.CITIZEN;
  return resolvedRole;
}

export function isAdminRole(roleOrSession) {
  if (typeof roleOrSession === 'string') {
    return ADMIN_ROLE_SET.has(normalizeRole(roleOrSession));
  }
  return ADMIN_ROLE_SET.has(getUserRole(roleOrSession));
}

export function getRoleCapabilities(roleOrSession) {
  const role = typeof roleOrSession === 'string'
    ? normalizeRole(roleOrSession)
    : getUserRole(roleOrSession);
  return ROLE_CAPABILITIES[role] ?? [];
}

export function hasCapability(roleOrSession, capability) {
  return getRoleCapabilities(roleOrSession).includes(capability);
}

export function getUserAudience(session) {
  const role = getUserRole(session);
  if (role === USER_ROLES.GUEST) return USER_ROLES.GUEST;
  if (isAdminRole(role)) return 'admin';
  return 'citizen';
}
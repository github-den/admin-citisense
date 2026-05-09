import { useMemo } from 'react';
import { useAuth } from '@core/context/AuthContext.jsx';
import { getUserRole, USER_ROLES } from '@core/lib/auth/roles.js';
import { getInitials } from '@core/utils/format.js';
import {
  ROLE_PAGE_CONFIG,
  getRoleLabel,
  getRoleSummary,
  getScopeLabel,
  inferServiceCategoryFromOffice,
} from '@core/lib/adminWorkspace.js';

export function useAdminWorkspace() {
  const { session } = useAuth();

  return useMemo(() => {
    const role = getUserRole(session);
    const metadata = session?.user?.user_metadata ?? {};
    const email = session?.user?.email ?? '';
    const displayName = metadata.username || metadata.full_name || email || 'Admin User';
    const office = metadata.office ?? null;
    const barangay = metadata.barangay ?? null;
    const serviceCategory = metadata.service_category ?? inferServiceCategoryFromOffice(office);
    const pages = ROLE_PAGE_CONFIG[role] ?? ROLE_PAGE_CONFIG[USER_ROLES.LGU_ADMIN];

    const workspace = {
      role,
      roleLabel: getRoleLabel(role),
      roleSummary: getRoleSummary(role),
      office,
      barangay,
      serviceCategory,
      displayName,
      email,
      avatarUrl: metadata.avatar ?? null,
      initials: getInitials(displayName) || 'A',
      pages,
      scopeLabel: '',
      isSuperAdmin: role === USER_ROLES.SUPER_ADMIN,
      isLGUAdmin: role === USER_ROLES.LGU_ADMIN,
      isBarangayAdmin: role === USER_ROLES.BARANGAY_ADMIN,
      session,
    };

    workspace.scopeLabel = getScopeLabel(workspace);
    return workspace;
  }, [session]);
}

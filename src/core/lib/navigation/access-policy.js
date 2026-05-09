import { getUserAudience, USER_ROLES } from '../auth/roles.js';
import { routes } from './routes.js';

function normalizePathname(pathname) {
  const value = String(pathname ?? '/');
  if (value.length > 1 && value.endsWith('/')) return value.slice(0, -1);
  return value || '/';
}

export function resolveRouteAccess({ pathname, session }) {
  const normalizedPath = normalizePathname(pathname);
  const audience = getUserAudience(session);

  // 1. Allow access to the public admin entry routes.
  if (normalizedPath === routes.root || normalizedPath === routes.login) {
    return { allowed: true };
  }

  // 2. If not logged in, send the user back to the public entry screen.
  if (audience === USER_ROLES.GUEST) {
    return {
      allowed: false,
      redirectTo: routes.login,
      promptLogin: true,
      promptMessage: 'Please sign in with an Admin account.',
    };
  }

  // 3. If logged in but NOT an admin, send them back to the public entry screen.
  if (audience !== 'admin') {
    return {
      allowed: false,
      redirectTo: routes.login,
      promptLogin: true,
      promptMessage: 'Access Denied: Admin role required.',
    };
  }

  // 4. Admin audience allowed everywhere in this repo
  return { allowed: true };
}

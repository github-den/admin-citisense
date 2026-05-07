'use client';

import { useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@core/context/AuthContext.jsx';
import { resolveRouteAccess } from '@core/lib/navigation/access-policy.js';

export default function RouteAccessGuard() {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, session } = useAuth();

  useEffect(() => {
    if (loading) return;

    const normalizedPath = pathname && pathname !== '/' && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;

    const decision = resolveRouteAccess({ pathname: normalizedPath, session });
    
    if (decision.allowed) return;

    if (decision.redirectTo && decision.redirectTo !== pathname) {
      router.replace(decision.redirectTo);
    }
  }, [loading, pathname, router, session]);

  return null;
}

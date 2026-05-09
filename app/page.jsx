'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../src/core/context/AuthContext.jsx';
import { isAdminRole } from '../src/core/lib/auth/roles.js';

export default function RootRedirect() {
  const router = useRouter();
  const { loading, session } = useAuth();

  useEffect(() => {
    if (loading) return;
    router.replace(isAdminRole(session) ? '/dashboard' : '/login');
  }, [loading, router, session]);

  return null;
}

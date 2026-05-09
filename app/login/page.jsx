'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AdminLoginPage from '../../src/AdminLoginPage.jsx';
import { useAuth } from '../../src/core/context/AuthContext.jsx';
import { isAdminRole } from '../../src/core/lib/auth/roles.js';

export default function AdminLoginRoute() {
  const router = useRouter();
  const { loading, session } = useAuth();

  useEffect(() => {
    if (loading || !isAdminRole(session)) return;
    router.replace('/dashboard');
  }, [loading, router, session]);

  if (loading) return null;
  if (isAdminRole(session)) return null;

  return <AdminLoginPage />;
}

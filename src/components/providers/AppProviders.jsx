'use client';

import { Suspense } from 'react';
import { AuthProvider } from '@core/context/AuthContext.jsx';
import AdminLoginModal from '../AdminLoginModal/AdminLoginModal.jsx';
import RouteAccessGuard from './RouteAccessGuard.jsx';
import NavigationLoader from '../NavigationLoader/NavigationLoader.jsx';

export default function AppProviders({ children }) {
  return (
    <AuthProvider>
      <Suspense fallback={null}>
        <NavigationLoader />
      </Suspense>
      <RouteAccessGuard />
      {children}
      <AdminLoginModal />
    </AuthProvider>
  );
}

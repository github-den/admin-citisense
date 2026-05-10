'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { getSession, signIn, signOut, onAuthStateChange } from '@core/services/auth.js';
import { isAdminRole } from '@core/lib/auth/roles.js';

const AUTH_BOOT_TIMEOUT_MS = 3500;

const noop = () => {};
const noopAsync = async () => {};

function withTimeout(promise, fallback, ms = AUTH_BOOT_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise((resolve) => {
      window.setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

export const AuthContext = createContext(null);

const defaultAuthContext = {
  session: null,
  isAuthenticated: false,
  loading: true,
  modalOpen: false,
  modalMessage: '',
  modalTab: 'login',
  adminModalOpen: false,
  confirmEmailOpen: false,
  confirmEmail: '',
  needsSetup: false,
  requireAuth: noop,
  openModal: noop,
  closeModal: noop,
  openAdminModal: noop,
  closeAdminModal: noop,
  closeConfirmEmail: noop,
  handleSignIn: noopAsync,
  handleSignUp: noopAsync,
  handleVerifySignupOtp: noopAsync,
  handleGoogleSignIn: noopAsync,
  handleCompleteSetup: noopAsync,
  handleAdminSignIn: noopAsync,
  handleSignOut: noopAsync,
  continueAsGuest: noop,
};

export const useAuth = () => useContext(AuthContext) ?? defaultAuthContext;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    withTimeout(getSession().catch(() => null), null).then((nextSession) => {
      if (!mounted) return;
      if (nextSession && !isAdminRole(nextSession)) {
        signOut().catch(() => {});
        setSession(null);
        setLoading(false);
        return;
      }
      setSession(nextSession);
      setLoading(false);
    });

    const unsub = onAuthStateChange((nextSession) => {
      if (!mounted) return;
      if (nextSession && !isAdminRole(nextSession)) {
        signOut().catch(() => {});
        setSession(null);
        setLoading(false);
        return;
      }
      setSession(nextSession);
      setLoading(false);
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  async function handleAdminSignIn(email, password) {
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));

    try {
      const nextSession = await signIn(email, password);
      setSession(nextSession);
    } catch (error) {
      throw error;
    } finally {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('citicontrol:stop-loader'));
      }, 450);
    }
  }

  async function handleSignOut() {
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));

    try {
      await signOut();
      setSession(null);
    } finally {
      window.setTimeout(() => {
        window.dispatchEvent(new CustomEvent('citicontrol:stop-loader'));
      }, 450);
    }
  }

  const value = {
    ...defaultAuthContext,
    session,
    isAuthenticated: !!session && isAdminRole(session),
    loading,
    handleAdminSignIn,
    handleSignOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

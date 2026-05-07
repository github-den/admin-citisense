'use client';
import { supabase } from '@core/lib/supabase.js';


import { createContext, useContext, useReducer, useEffect, useCallback, useRef } from 'react';
import {
  getSession,
  signIn,
  signUp,
  signOut,
  signInWithGoogle,
  verifySignupOtp,
  updateProfile,
  onAuthStateChange,
  enrichSession,
} from '@core/services/auth.js';
import { isAdminRole, normalizeRole } from '@core/lib/auth/roles.js';

const DEMO_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_AUTH === 'true';
const DEMO_USER_EMAIL = 'user';
const TEMP_DEMO_USER_EMAIL = 'u';
const DEMO_ADMIN_EMAIL = 'admin@citisense.demo';
const DEMO_USER_PASSWORD = 'pw';
const TEMP_DEMO_USER_PASSWORD = '1';
const DEMO_ADMIN_PASSWORD = '1';
const AUTH_BOOT_TIMEOUT_MS = 3500;

const initialState = {
  session:          null,
  loading:          true,
  modalOpen:        false,
  modalMessage:     '',
  modalTab:         'login',
  adminModalOpen:   false,
  confirmEmailOpen: false,
  confirmEmail:     '',
  needsSetup:       false,
};

function needsProfileSetup(session) {
  return !!session && !session.user?.user_metadata?.setup_complete;
}

function withTimeout(promise, fallback, ms = AUTH_BOOT_TIMEOUT_MS) {
  return Promise.race([
    promise,
    new Promise(resolve => {
      window.setTimeout(() => resolve(fallback), ms);
    }),
  ]);
}

function createDemoSession({ role = 'citizen', email = DEMO_USER_EMAIL, setupComplete = true } = {}) {
  const normalizedRole = normalizeRole(role);
  const isAdmin = isAdminRole(normalizedRole);

  return {
    access_token: `demo-${role}-token`,
    token_type: 'bearer',
    user: {
      id: `demo-${role}`,
      email,
      app_metadata: { role: normalizedRole },
      user_metadata: {
        role: normalizedRole,
        username: isAdmin ? 'demo_admin' : 'demo_citizen',
        avatar: isAdmin ? '/avatars/avatar_8.png' : '/avatars/avatar_1.png',
        setup_complete: setupComplete,
      },
    },
  };
}

function getDemoSession(email, password, role = 'citizen') {
  const normalizedEmail = email.trim().toLowerCase();

  // Admin demo credentials
  if (role === 'admin') {
    if (password === DEMO_ADMIN_PASSWORD) {
      return createDemoSession({ role: 'admin', email: DEMO_ADMIN_EMAIL });
    }
    return null;
  }

  // Citizen demo credentials (for testing setup flow)
  if (normalizedEmail === TEMP_DEMO_USER_EMAIL && password === TEMP_DEMO_USER_PASSWORD) {
    return createDemoSession({ role: 'citizen', email: TEMP_DEMO_USER_EMAIL, setupComplete: false });
  }

  return null;
}

function getDemoSignupSession(email, password) {
  return null;
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_SESSION':
      return { 
        ...state, 
        session: action.session, 
        needsSetup: action.needsSetup ?? needsProfileSetup(action.session),
        loading: false 
      };
    case 'OPEN_MODAL':
      return { ...state, modalOpen: true, modalMessage: action.message ?? '', modalTab: action.tab ?? 'login' };
    case 'CLOSE_MODAL':
      return { ...state, modalOpen: false, modalMessage: '' };
    case 'OPEN_ADMIN_MODAL':
      return { ...state, adminModalOpen: true };
    case 'CLOSE_ADMIN_MODAL':
      return { ...state, adminModalOpen: false };
    case 'SHOW_CONFIRM_EMAIL':
      return { ...state, modalOpen: false, modalMessage: '', confirmEmailOpen: true, confirmEmail: action.email };
    case 'HIDE_CONFIRM_EMAIL':
      return { ...state, confirmEmailOpen: false, confirmEmail: '' };
    case 'SET_NEEDS_SETUP':
      return { ...state, needsSetup: true };
    case 'COMPLETE_SETUP':
      return { ...state, needsSetup: false };
    default:
      return state;
  }
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
  requireAuth: () => {},
  openModal: () => {},
  closeModal: () => {},
  openAdminModal: () => {},
  closeAdminModal: () => {},
  closeConfirmEmail: () => {},
  handleSignIn: async () => {},
  handleSignUp: async () => {},
  handleVerifySignupOtp: async () => {},
  handleGoogleSignIn: async () => {},
  handleCompleteSetup: async () => {},
  handleAdminSignIn: async () => {},
  handleSignOut: async () => {},
  continueAsGuest: () => {},
};

export const useAuth = () => useContext(AuthContext) ?? defaultAuthContext;

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const pendingAction = useRef(null);

  useEffect(() => {
    let mounted = true;

    withTimeout(getSession().catch(() => null), null).then(session => {
      if (!mounted) return;
      dispatch({ type: 'SET_SESSION', session });
    });

    const unsub = onAuthStateChange(session => {
      if (!mounted) return;
      dispatch({ type: 'SET_SESSION', session });
      if (!session) dispatch({ type: 'COMPLETE_SETUP' });
    });

    return () => {
      mounted = false;
      unsub();
    };
  }, []);

  const requireAuth = useCallback((action, message) => {
    if (state.session) {
      action();
    } else {
      pendingAction.current = action;
      dispatch({ type: 'OPEN_MODAL', message });
    }
  }, [state.session]);

  async function handleSignIn(identifier, password) {
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));

    const demoSession = getDemoSession(identifier, password);
    if (demoSession) {
      dispatch({ type: 'SET_SESSION', session: demoSession });
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('citicontrol:stop-loader'));
        dispatch({ type: 'CLOSE_MODAL' });
        window.location.href = '/setup';
      }, 450);
      return;
    }

    const isEmail = identifier.includes('@');
    const cleanIdentifier = identifier.trim().toLowerCase();

    try {
      let emailToUse = cleanIdentifier;

      // 1. Hierarchical Existence Check
      if (isEmail) {
        const { data, error: existenceError } = await supabase
          .from('profiles')
          .select('id')
          .eq('email', cleanIdentifier)
          .maybeSingle();

        if (!data && (!existenceError || existenceError.code !== '42703')) {
          throw new Error('Email not registered to CitiSense');
        }
      } else {
        const { data, error: existenceError } = await supabase
          .from('profiles')
          .select('email')
          .eq('username', cleanIdentifier)
          .maybeSingle();

        if (existenceError) throw existenceError;
        if (!data) throw new Error('Username does not exist');
        if (data.email) emailToUse = data.email;
      }

      // 2. Password Match Check
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password: password
      });

      if (authError) {
        if (authError.message?.toLowerCase().includes('invalid login credentials')) {
          throw new Error("Password doesn't match");
        }
        throw authError;
      }

      // 3. Success & Dynamic Redirection
      const fullSession = await enrichSession(authData.session);
      dispatch({ type: 'SET_SESSION', session: fullSession });
      
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('citicontrol:stop-loader'));
        dispatch({ type: 'CLOSE_MODAL' });

        const setupComplete = fullSession?.user?.user_metadata?.setup_complete;
        window.location.href = setupComplete ? '/feed' : '/setup';
      }, 450);

    } catch (err) {
      window.dispatchEvent(new CustomEvent('citicontrol:stop-loader'));
      throw err;
    }
  }

  async function handleSignUp(email, password) {
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));

    const demoSession = getDemoSignupSession(email, password);
    if (demoSession) {
      dispatch({ type: 'SET_SESSION', session: demoSession });
      dispatch({ type: 'CLOSE_MODAL' });

      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('citicontrol:stop-loader'));
      }, 450);
      return;
    }

    try {
      const session = await signUp(email, password);
      if (session) {
        dispatch({ type: 'SET_SESSION', session });
        dispatch({ type: 'CLOSE_MODAL' });
      } else {
        dispatch({ type: 'SHOW_CONFIRM_EMAIL', email });
      }
    } catch (error) {
      console.error('Sign up error:', error);
      throw error;
    } finally {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('citicontrol:stop-loader'));
      }, 450);
    }
  }

  async function handleVerifySignupOtp(email, token) {
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));
    try {
      const session = await verifySignupOtp(email, token);
      dispatch({ type: 'SET_SESSION', session });
      return session;
    } catch (error) {
      console.error('Email OTP verification error:', error);
      throw error;
    } finally {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('citicontrol:stop-loader'));
      }, 450);
    }
  }

  async function handleGoogleSignIn() {
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));
    try {
      await signInWithGoogle();
      dispatch({ type: 'CLOSE_MODAL' });
    } catch (error) {
      console.error('Google sign in error:', error);
      window.dispatchEvent(new CustomEvent('citicontrol:stop-loader'));
      throw error;
    }
  }

  async function handleCompleteSetup(profileData) {
    await updateProfile(profileData);
    const session = await getSession();
    dispatch({ type: 'SET_SESSION', session });
    dispatch({ type: 'COMPLETE_SETUP' });
  }

  async function handleAdminSignIn(email, password) {
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));

    const demoSession = getDemoSession(email, password, 'admin');
    if (demoSession) {
      dispatch({ type: 'SET_SESSION', session: demoSession });
      dispatch({ type: 'CLOSE_ADMIN_MODAL' });
      return;
    }

    try {
      const session = await signIn(email, password);
      if (!isAdminRole(session)) {
        await signOut();
        throw new Error('There is no existing admin account that matches.');
      }

      dispatch({ type: 'SET_SESSION', session });
      dispatch({ type: 'CLOSE_ADMIN_MODAL' });
    } catch (error) {
      console.error('Admin sign in error:', error);
      throw error;
    } finally {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('citicontrol:stop-loader'));
      }, 450);
    }
  }

  async function handleSignOut() {
    window.dispatchEvent(new CustomEvent('citicontrol:trigger-loader'));
    try {
      await signOut();
      dispatch({ type: 'SET_SESSION', session: null });
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setTimeout(() => {
        window.dispatchEvent(new CustomEvent('citicontrol:stop-loader'));
      }, 450);
    }
  }

  function continueAsGuest() {
    pendingAction.current = null;
    dispatch({ type: 'CLOSE_MODAL' });
  }

  function closeConfirmEmail() {
    dispatch({ type: 'HIDE_CONFIRM_EMAIL' });
  }

  const openModal = useCallback((tab, message) => {
    dispatch({ type: 'OPEN_MODAL', tab, message });
  }, []);

  const openAdminModal = useCallback(() => {
    dispatch({ type: 'OPEN_ADMIN_MODAL' });
  }, []);

  const closeAdminModal = useCallback(() => {
    dispatch({ type: 'CLOSE_ADMIN_MODAL' });
  }, []);

  const value = {
    session:          state.session,
    isAuthenticated:  !!state.session,
    loading:          state.loading,
    modalOpen:        state.modalOpen,
    modalMessage:     state.modalMessage,
    modalTab:         state.modalTab,
    adminModalOpen:   state.adminModalOpen,
    confirmEmailOpen: state.confirmEmailOpen,
    confirmEmail:     state.confirmEmail,
    needsSetup:       state.needsSetup,
    requireAuth,
    openModal,
    closeModal:       continueAsGuest,
    openAdminModal,
    closeAdminModal,
    closeConfirmEmail,
    handleSignIn,
    handleSignUp,
    handleVerifySignupOtp,
    handleGoogleSignIn,
    handleCompleteSetup,
    handleAdminSignIn,
    handleSignOut,
    continueAsGuest,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

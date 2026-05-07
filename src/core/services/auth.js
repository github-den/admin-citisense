import { supabase } from '@core/lib/supabase.js';

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID;
const AUTH_METHOD_EMAIL = 'email';
const AUTH_METHOD_GOOGLE = 'google';
const PENDING_AUTH_METHOD_KEY = 'citisense:pending_auth_method';
const PENDING_AUTH_STARTED_AT_KEY = 'citisense:pending_auth_started_at';
const PENDING_AUTH_MAX_AGE_MS = 10 * 60 * 1000;

const AVATAR_ASSETS = {
  avatar_1: '/avatars/avatar_1.png',
  avatar_2: '/avatars/avatar_2.png',
  avatar_3: '/avatars/avatar_3.png',
  avatar_4: '/avatars/avatar_4.png',
  avatar_5: '/avatars/avatar_5.png',
  avatar_6: '/avatars/avatar_6.png',
  avatar_7: '/avatars/avatar_7.png',
  avatar_8: '/avatars/avatar_8.png',
  avatar_9: '/avatars/avatar_9.png',
};

function noClient() {
  throw new Error('Supabase is not configured. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to your .env file.');
}

function getLinkedProviders(user) {
  const providers = user?.app_metadata?.providers;
  if (Array.isArray(providers) && providers.length > 0) return providers;

  const provider = user?.app_metadata?.provider;
  return provider ? [provider] : [];
}

function getPendingAuthMethod() {
  if (typeof window === 'undefined') return null;

  const method = window.sessionStorage.getItem(PENDING_AUTH_METHOD_KEY);
  const startedAt = Number(window.sessionStorage.getItem(PENDING_AUTH_STARTED_AT_KEY) ?? 0);
  if (!method || !startedAt || Date.now() - startedAt > PENDING_AUTH_MAX_AGE_MS) {
    window.sessionStorage.removeItem(PENDING_AUTH_METHOD_KEY);
    window.sessionStorage.removeItem(PENDING_AUTH_STARTED_AT_KEY);
    return null;
  }

  return method;
}

function clearPendingAuthMethod() {
  if (typeof window === 'undefined') return;
  window.sessionStorage.removeItem(PENDING_AUTH_METHOD_KEY);
  window.sessionStorage.removeItem(PENDING_AUTH_STARTED_AT_KEY);
}

function rememberPendingAuthMethod(method) {
  if (typeof window === 'undefined') return;
  window.sessionStorage.setItem(PENDING_AUTH_METHOD_KEY, method);
  window.sessionStorage.setItem(PENDING_AUTH_STARTED_AT_KEY, String(Date.now()));
}

async function syncAuthMethodMetadata(session) {
  if (!supabase || !session?.user?.id) return session;

  const pendingMethod = getPendingAuthMethod();
  const linkedProviders = getLinkedProviders(session.user);
  const currentMetadata = session.user.user_metadata ?? {};
  const nextSignupMethod = currentMetadata.signup_method ?? currentMetadata.signup_started_with ?? pendingMethod ?? linkedProviders[0] ?? null;

  const nextMetadata = {
    signup_method: nextSignupMethod,
    signup_started_with: currentMetadata.signup_started_with ?? nextSignupMethod,
    linked_providers: linkedProviders,
  };

  const hasMetadataChanges = Object.entries(nextMetadata).some(([key, value]) => {
    const currentValue = currentMetadata[key];
    return Array.isArray(value)
      ? JSON.stringify(currentValue ?? []) !== JSON.stringify(value)
      : currentValue !== value;
  });

  if (!hasMetadataChanges) {
    if (pendingMethod) clearPendingAuthMethod();
    return session;
  }

  const { data, error } = await supabase.auth.updateUser({ data: nextMetadata });
  if (pendingMethod) clearPendingAuthMethod();
  if (error || !data?.user) return session;

  return {
    ...session,
    user: {
      ...session.user,
      user_metadata: {
        ...session.user.user_metadata,
        ...data.user.user_metadata,
      },
    },
  };
}

export async function enrichSession(session) {
  if (!supabase || !session?.user?.id) return session;

  const syncedSession = await syncAuthMethodMetadata(session);

  const { data, error } = await supabase
    .from('profiles')
    .select('username, avatar, location')
    .eq('id', syncedSession.user.id)
    .maybeSingle();

  if (error || !data) return syncedSession;

  return {
    ...syncedSession,
    user: {
      ...syncedSession.user,
      user_metadata: {
        ...syncedSession.user.user_metadata,
        role: syncedSession.user.user_metadata?.role,
        username: data.username ?? syncedSession.user.user_metadata?.username,
        avatar: data.avatar ?? syncedSession.user.user_metadata?.avatar,
        barangay: data.location ?? syncedSession.user.user_metadata?.barangay,
      },
    },
  };
}

export async function getSession() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  return enrichSession(data.session ?? null);
}

export async function signIn(email, password) {
  if (!supabase) noClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return enrichSession(data.session);
}

export async function signUp(email, password) {
  if (!supabase) noClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        signup_method: AUTH_METHOD_EMAIL,
        signup_started_with: AUTH_METHOD_EMAIL,
        linked_providers: [AUTH_METHOD_EMAIL],
      },
    },
  });
  if (error) throw error;

  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    throw new Error('This email is already linked to an existing CitiSense account. If you used Google first, please continue with Google or set a password from Settings.');
  }

  return enrichSession(data.session);
}

export async function sendSignupOtp(email) {
  if (!supabase) noClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      shouldCreateUser: true,
      data: {
        signup_method: AUTH_METHOD_EMAIL,
        signup_started_with: AUTH_METHOD_EMAIL,
        linked_providers: [AUTH_METHOD_EMAIL],
      },
    },
  });
  if (error) throw error;
}

export async function verifySignupOtp(email, token) {
  if (!supabase) noClient();
  const { data, error } = await supabase.auth.verifyOtp({
    email,
    token,
    type: 'email',
  });
  if (error) throw error;
  return enrichSession(data.session);
}

export async function setCurrentUserPassword(password) {
  if (!supabase) noClient();
  const { data, error } = await supabase.auth.updateUser({
    password,
    data: {
      signup_method: AUTH_METHOD_EMAIL,
      signup_started_with: AUTH_METHOD_EMAIL,
      linked_providers: [AUTH_METHOD_EMAIL],
    },
  });
  if (error) throw error;
  return data.user;
}

export async function markSignupAgreementAccepted() {
  if (!supabase) noClient();
  const acceptedAt = new Date().toISOString();
  const { data, error } = await supabase.auth.updateUser({
    data: {
      terms_accepted: true,
      terms_accepted_at: acceptedAt,
      privacy_accepted: true,
      privacy_accepted_at: acceptedAt,
    },
  });
  if (error) throw error;
  return data.user;
}

export async function updateProfile({ username, avatarId, barangay }) {
  if (!supabase) noClient();
  const avatar = AVATAR_ASSETS[avatarId] ?? AVATAR_ASSETS.avatar_1;

  const { data, error } = await supabase.auth.updateUser({
    data: {
      username,
      avatar,
      barangay,
      setup_complete: true,
    },
  });
  if (error) throw error;

  const { error: profileError } = await supabase
    .from('profiles')
    .update({
      username,
      avatar,
      location: barangay,
    })
    .eq('id', data.user.id);
  if (profileError) throw profileError;

  return data.user;
}

export async function updateEmail(email) {
  if (!supabase) noClient();
  const { data, error } = await supabase.auth.updateUser({ email });
  if (error) throw error;
  return data.user;
}

export async function resetPassword(email) {
  if (!supabase) noClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}`,
  });
  if (error) throw error;
}

export async function signInWithGoogle() {
  if (!supabase) noClient();
  if (!GOOGLE_CLIENT_ID) {
    throw new Error('Google login is not configured. Add NEXT_PUBLIC_GOOGLE_CLIENT_ID to your .env file and configure the same client in Supabase Auth.');
  }

  rememberPendingAuthMethod(AUTH_METHOD_GOOGLE);
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/setup` },
  });
  if (error) {
    clearPendingAuthMethod();
    throw error;
  }
}

export async function signOut() {
  if (!supabase) return;
  await supabase.auth.signOut();
}

export function onAuthStateChange(callback) {
  if (!supabase) return () => {};
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    enrichSession(session)
      .then(callback)
      .catch(() => callback(session ?? null));
  });
  return () => data.subscription.unsubscribe();
}

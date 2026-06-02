import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseAdmin } from '@/server/supabaseAdmin.js';

const ADMIN_ROLES = new Set(['super_admin', 'lgu_admin', 'barangay_admin', 'admin']);

const ALLOWED_STATUSES = new Set([
  'Under Review',
  'Verified',
  'In Progress',
  'On Hold',
  'On hold',
  'Resolved',
  'Dismissed',
]);

const STATUS_TO_PATCH = {
  'Under Review': {
    status: null,
    is_verified_post: false,
    dismissed: false,
    dismissed_by: null,
    dismissed_at: null,
    dismissed_reason: null,
  },
  Verified: {
    status: null,
    is_verified_post: true,
    dismissed: false,
    dismissed_by: null,
    dismissed_at: null,
    dismissed_reason: null,
  },
  'In Progress': {
    status: 'in-progress',
    is_verified_post: true,
    dismissed: false,
    dismissed_by: null,
    dismissed_at: null,
    dismissed_reason: null,
  },
  'On Hold': {
    status: 'on-hold',
    is_verified_post: true,
    dismissed: false,
    dismissed_by: null,
    dismissed_at: null,
    dismissed_reason: null,
  },
  'On hold': {
    status: 'on-hold',
    is_verified_post: true,
    dismissed: false,
    dismissed_by: null,
    dismissed_at: null,
    dismissed_reason: null,
  },
  Resolved: {
    status: 'resolved',
    is_verified_post: true,
    dismissed: false,
    dismissed_by: null,
    dismissed_at: null,
    dismissed_reason: null,
  },
};

function getUserRole(user) {
  return String(
    user?.user_metadata?.role || user?.app_metadata?.role || '',
  ).trim().toLowerCase();
}

async function getCallerUser(request) {
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url || !anonKey) return null;

  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data?.user) return null;
  return data.user;
}

export async function POST(request) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Server not configured.' }, { status: 500 });
  }

  // Verify the caller is an authenticated admin
  const caller = await getCallerUser(request);
  if (!caller) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const role = getUserRole(caller);
  if (!ADMIN_ROLES.has(role)) {
    return NextResponse.json({ error: 'Forbidden. Admin access required.' }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const { postId, status, adminNotes } = body ?? {};

  if (!postId || typeof postId !== 'string') {
    return NextResponse.json({ error: 'postId is required.' }, { status: 400 });
  }

  if (!status || !ALLOWED_STATUSES.has(status)) {
    return NextResponse.json({ error: `Invalid status: ${status}` }, { status: 400 });
  }

  // Build the patch object
  let patch;
  if (status === 'Dismissed') {
    patch = {
      status: null,
      is_verified_post: false,
      dismissed: true,
      dismissed_at: new Date().toISOString(),
      dismissed_reason: adminNotes || 'No reason provided',
    };
  } else {
    patch = { ...(STATUS_TO_PATCH[status] ?? {}) };
  }

  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: `No patch defined for status: ${status}` }, { status: 400 });
  }

  try {
    const { error } = await admin
      .from('feedbacks')
      .update(patch)
      .eq('id', postId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err?.message ?? 'Unexpected server error.' },
      { status: 500 },
    );
  }
}

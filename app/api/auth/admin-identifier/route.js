import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/server/supabaseAdmin.js';

const ADMIN_ROLES = new Set(['super_admin', 'lgu_admin', 'barangay_admin', 'admin']);

function normalizeIdentifier(value) {
  return String(value ?? '').trim().toLowerCase();
}

function isAdminRole(role) {
  return ADMIN_ROLES.has(normalizeIdentifier(role));
}

function getUserRole(user) {
  return normalizeIdentifier(
    user?.user_metadata?.role
    || user?.app_metadata?.role,
  );
}

function getUsername(user) {
  return normalizeIdentifier(user?.user_metadata?.username);
}

async function listUsers(admin) {
  const users = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
    if (error) throw error;

    const batch = data?.users ?? [];
    users.push(...batch);

    if (!data?.nextPage || batch.length < perPage) break;
    page = data.nextPage;
  }

  return users;
}

export async function POST(request) {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json({ error: 'Supabase admin is not configured.' }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const username = normalizeIdentifier(body?.username);

  if (!username) {
    return NextResponse.json({ error: 'Username is required.' }, { status: 400 });
  }

  try {
    const users = await listUsers(admin);
    const match = users.find((user) => (
      getUsername(user) === username && isAdminRole(getUserRole(user))
    ));

    const email = normalizeIdentifier(match?.email);
    if (!email) {
      return NextResponse.json({ error: 'No admin account matches that email or username.' }, { status: 404 });
    }

    return NextResponse.json({ email });
  } catch (error) {
    return NextResponse.json(
      { error: error?.message ?? 'Unable to resolve admin account.' },
      { status: 500 },
    );
  }
}

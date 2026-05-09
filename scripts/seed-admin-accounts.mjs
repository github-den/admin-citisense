import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import {
  SERVICE_CATEGORY_OPTIONS,
  URDANETA_BARANGAYS,
} from '../src/constants/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env');

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, '');

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvFile(envPath);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in admin-web/.env');
  process.exit(1);
}

const supabase = createClient(url, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

const DEFAULT_AVATAR = '/avatars/avatar_8.png';
const LGU_PASSWORD = 'ChangeMe!LGUAdmin2026';
const BARANGAY_PASSWORD = 'ChangeMe!BrgyAdmin2026';
const SUPER_ADMIN_PASSWORD = 'ChangeMe!SuperAdmin2026';
const EXCLUDED_LOCATIONS = new Set([
  'Old City Hall (Poblacion)',
  'New City Hall (Anonas)',
]);

function toEmailSlug(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
}

function toUsernameSlug(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function buildDesiredAccounts() {
  const accounts = [
    {
      email: 'superadmin@citisense.local',
      password: SUPER_ADMIN_PASSWORD,
      username: 'super_admin_urdaneta',
      role: 'super_admin',
      location: 'Urdaneta City',
      office: 'CitiSense Central Admin',
      serviceCategory: null,
      barangay: null,
    },
  ];

  for (const { value: category, office } of SERVICE_CATEGORY_OPTIONS) {
    accounts.push({
      email: `lgu.${toEmailSlug(category)}.admin@citisense.local`,
      password: LGU_PASSWORD,
      username: `lgu_${toUsernameSlug(category)}_admin`,
      role: 'lgu_admin',
      location: office,
      office,
      serviceCategory: category,
      barangay: null,
    });
  }

  for (const barangay of URDANETA_BARANGAYS) {
    if (EXCLUDED_LOCATIONS.has(barangay)) continue;

    accounts.push({
      email: `barangay.${toEmailSlug(barangay)}.admin@citisense.local`,
      password: BARANGAY_PASSWORD,
      username: `brgy_${toUsernameSlug(barangay)}_admin`,
      role: 'barangay_admin',
      location: barangay,
      office: null,
      serviceCategory: null,
      barangay,
    });
  }

  return accounts;
}

async function fetchExistingProfiles(usernames) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, username')
    .in('username', usernames);

  if (error) throw error;
  return data ?? [];
}

async function deleteExistingUsersById(userIds) {
  for (const userId of userIds) {
    const { error } = await supabase.auth.admin.deleteUser(userId);
    if (error) {
      console.warn(`Could not delete existing auth user ${userId}: ${error.message}`);
    }
  }
}

async function cleanupProfilesByUsername(usernames) {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .in('username', usernames);

  if (error) {
    console.warn(`Could not clean up some existing profiles: ${error.message}`);
  }
}

async function createOrRepairAccount(account) {
  const userMetadata = {
    role: account.role,
    username: account.username,
    avatar: DEFAULT_AVATAR,
    office: account.office,
    service_category: account.serviceCategory,
    barangay: account.barangay,
    setup_complete: true,
  };

  const appMetadata = {
    role: account.role,
    office: account.office,
    service_category: account.serviceCategory,
    barangay: account.barangay,
  };

  const { data, error } = await supabase.auth.admin.createUser({
    email: account.email,
    password: account.password,
    email_confirm: true,
    user_metadata: userMetadata,
    app_metadata: appMetadata,
  });

  if (error) throw error;
  if (!data?.user?.id) throw new Error(`No user id returned for ${account.email}`);

  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id: data.user.id,
      username: account.username,
      avatar: DEFAULT_AVATAR,
      location: account.location,
      role: account.role,
    }, { onConflict: 'id' });

  if (profileError) throw profileError;

  return data.user.id;
}

async function main() {
  const accounts = buildDesiredAccounts();
  const usernames = accounts.map((account) => account.username);

  console.log(`Preparing to repair and seed ${accounts.length} admin accounts...`);

  const existingProfiles = await fetchExistingProfiles(usernames);
  const existingUserIds = existingProfiles
    .map((profile) => profile.id)
    .filter(Boolean);

  if (existingUserIds.length > 0) {
    console.log(`Deleting ${existingUserIds.length} existing seeded admin auth users...`);
    await deleteExistingUsersById(existingUserIds);
  }

  if (existingProfiles.length > 0) {
    console.log(`Cleaning up ${existingProfiles.length} existing seeded admin profiles...`);
    await cleanupProfilesByUsername(existingProfiles.map((profile) => profile.username));
  }

  let created = 0;
  for (const account of accounts) {
    try {
      const userId = await createOrRepairAccount(account);
      created += 1;
      console.log(`[${created}/${accounts.length}] ${account.role} ${account.username} -> ${account.email} (${userId})`);
    } catch (error) {
      throw new Error(`Failed on ${account.username} (${account.email}): ${error?.message ?? error}`);
    }
  }

  console.log(`Done. Repaired/seeded ${created} admin accounts.`);
}

main().catch((error) => {
  console.error('Admin seed failed:', error?.message ?? error);
  process.exit(1);
});

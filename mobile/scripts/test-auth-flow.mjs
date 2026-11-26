// Run locally with disposable test credentials. Never commit a real password.
// Requires Node 22+; see README for environment variable setup.
import { createClient } from '@supabase/supabase-js';
import { randomUUID } from 'node:crypto';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const api = process.env.EXPO_PUBLIC_API_URL;
const email = process.env.LIFE_DEBUG_TEST_EMAIL;
const password = process.env.LIFE_DEBUG_TEST_PASSWORD;

function required(name, value) {
  if (!value || value.includes('YOUR_')) throw new Error(`Missing ${name}`);
}
for (const [name, value] of [
  ['EXPO_PUBLIC_SUPABASE_URL', url],
  ['EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY', key],
  ['EXPO_PUBLIC_API_URL', api],
  ['LIFE_DEBUG_TEST_EMAIL', email],
  ['LIFE_DEBUG_TEST_PASSWORD', password],
]) required(name, value);
if (!/^https:\/\/.+\.supabase\.co\/?$/.test(url)) throw new Error('Invalid Supabase project URL');
if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) throw new Error('Use only a publishable Supabase key');
if (!/^https?:\/\//.test(api)) throw new Error('Invalid backend API URL');

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
let signedIn = false;

async function request(path, accessToken, init = {}) {
  const result = await fetch(new URL(path, api).toString(), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
    signal: AbortSignal.timeout(15000),
  });
  const body = await result.text();
  let json;
  try { json = JSON.parse(body); } catch { json = body; }
  if (!result.ok) throw new Error(`API ${path}: HTTP ${result.status}; ${JSON.stringify(json).slice(0, 250)}`);
  return json;
}

try {
  if (process.env.LIFE_DEBUG_TEST_REGISTER === '1') {
    console.log('Registering disposable test user...');
    const created = await supabase.auth.signUp({ email, password });
    if (created.error) throw created.error;
    if (!created.data.session) {
      throw new Error('Registration submitted but email confirmation is required. Confirm the email and rerun without LIFE_DEBUG_TEST_REGISTER=1.');
    }
  }
  const result = await supabase.auth.signInWithPassword({ email, password });
  if (result.error) throw result.error;
  if (!result.data.session?.access_token) throw new Error('No access token after sign-in');
  signedIn = true;
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError || !userData.user?.id) throw userError ?? new Error('getUser returned no user');
  console.log('PASS: Supabase live password login and user identity');

  const token = result.data.session.access_token;
  const before = await request('/commitments', token);
  if (!Array.isArray(before)) throw new Error('Commitments endpoint did not return a list');

  const title = `E2E smoke test ${randomUUID().slice(0, 8)}`;
  const saved = await request('/commitments', token, {
    method: 'POST',
    body: JSON.stringify({ title, scheduled_time: '07:00' }),
  });
  if (!Number.isInteger(saved.id) || saved.title !== title)
    throw new Error('Commitment creation did not return the expected record');
  const after = await request('/commitments', token);
  if (!after.some((x) => x.id === saved.id && x.title === title))
    throw new Error('Saved commitment not visible to owner');
  console.log('PASS: FastAPI signed token and commitment creation/read');

  const checked = await request(`/commitments/${saved.id}/checkins`, token, {
    method: 'POST', body: JSON.stringify({ status: 'completed' }),
  });
  if (checked.status !== 'completed') throw new Error('Check-in did not persist');
  const insight = await request('/insights', token);
  if (typeof insight.checkins !== 'number' || insight.checkins < 1)
    throw new Error('Insights did not include the check-in');
  console.log('PASS: Check-in and insights');

  const { error: signOutError } = await supabase.auth.signOut();
  if (signOutError) throw signOutError;
  signedIn = false;
  const { data: afterSignOut } = await supabase.auth.getSession();
  if (afterSignOut.session !== null) throw new Error('A local session remains after sign-out');
  console.log('PASS: Client sign-out clears local session');
  console.log('NOTE: The smoke-test commitment remains in the disposable account. Revocation of already-issued JWTs is not tested.');
  console.log('PASS: Cloud-side integration checks completed. Expo on-device UI still requires manual testing.');
} catch (error) {
  console.error('FAIL:', error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
} finally {
  if (signedIn) await supabase.auth.signOut().catch(() => {});
}

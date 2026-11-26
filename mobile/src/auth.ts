import 'react-native-url-polyfill/auto';
import { AppState } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import { createClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const key = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';
export const authConfigured = /^https:\/\/[a-z0-9-]+\.supabase\.co\/?$/.test(url) && /^sb_publishable_[A-Za-z0-9_-]+$/.test(key);

const chunkSize = 1500;
const storage = {
  async getItem(name: string): Promise<string | null> {
    const countStr = await SecureStore.getItemAsync(name + '.count');
    if (countStr === null) return null;
    const count = Number(countStr);
    if (!Number.isSafeInteger(count) || count < 1 || count > 32) return null;
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(name + '.' + i);
      if (part === null) return null;
      parts.push(part);
    }
    return parts.join('');
  },
  async setItem(name: string, value: string): Promise<void> {
    const previous = Number(await SecureStore.getItemAsync(name + '.count')) || 0;
    const parts = value.match(/.{1,1500}/gs) ?? [''];
    if (parts.length > 32) throw new Error('Auth session exceeds storage limits');
    for (let i = 0; i < parts.length; i++) await SecureStore.setItemAsync(name + '.' + i, parts[i]);
    for (let i = parts.length; i < previous; i++) await SecureStore.deleteItemAsync(name + '.' + i);
    await SecureStore.setItemAsync(name + '.count', String(parts.length));
  },
  async removeItem(name: string): Promise<void> {
    const count = Number(await SecureStore.getItemAsync(name + '.count')) || 0;
    await SecureStore.deleteItemAsync(name + '.count');
    for (let i = 0; i < Math.min(count, 32); i++) await SecureStore.deleteItemAsync(name + '.' + i);
  },
};

// These placeholders never make network calls: the app shows a setup screen until configured.
export const supabase = createClient(
  authConfigured ? url : 'https://placeholder.supabase.co',
  authConfigured ? key : 'placeholder',
  { auth: { storage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false } }
);

AppState.addEventListener('change', state => {
  if (!authConfigured) return;
  if (state === 'active') supabase.auth.startAutoRefresh();
  else supabase.auth.stopAutoRefresh();
});

const googleRedirect = 'lifedebug://google-auth';

// Requires Google provider enabled in Supabase and lifedebug://google-auth
// allow-listed under Authentication > URL Configuration.
export async function signInWithGoogle(): Promise<void> {
  if (!authConfigured) throw new Error('Supabase is not configured.');
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: googleRedirect, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error('Supabase did not return a Google sign-in URL.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, googleRedirect);
  if (result.type === 'cancel' || result.type === 'dismiss') return;
  if (result.type !== 'success') throw new Error('Google sign-in did not complete.');

  const callback = new URL(result.url);
  const params = new URLSearchParams(callback.hash.slice(1) || callback.search.slice(1));
  const oauthError = params.get('error_description') || params.get('error');
  if (oauthError) throw new Error(oauthError);

  const access_token = params.get('access_token');
  const refresh_token = params.get('refresh_token');
  if (access_token && refresh_token) {
    const { error: sessionError } = await supabase.auth.setSession({ access_token, refresh_token });
    if (sessionError) throw sessionError;
    return;
  }
  const code = params.get('code');
  if (code) {
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) throw exchangeError;
    return;
  }
  throw new Error('Google returned without a usable login session. Check the allowed redirect URL.');
}

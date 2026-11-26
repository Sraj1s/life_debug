export type Commitment = { id: number; title: string; scheduled_time: string; frequency: string; active: boolean };
export type Insight = { checkins: number; completed: number; completion_rate: number | null; top_obstacle: string | null; reflection: string };
export type Status = 'completed' | 'missed' | 'rescheduled' | 'skipped';
export type Reason = 'outside' | 'tired' | 'distracted' | 'too_difficult' | 'other';
import { supabase } from './auth';
const base = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:8000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session?.access_token) throw new Error('Not signed in');
  const response = await fetch(base + path, { ...init, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token, ...init?.headers } });
  if (!response.ok) {
    if (response.status === 401 || response.status === 403)
      throw new Error('Sign-in token rejected by the backend. Check Supabase JWT signing, issuer, audience, and backend auth configuration.');
    if (response.status === 503)
      throw new Error('Backend authentication is not configured. Check AUTH_JWKS_URL, AUTH_ISSUER, and AUTH_AUDIENCE.');
    if (response.status >= 500)
      throw new Error('Backend error (' + response.status + '). Check FastAPI logs and database migrations.');
    throw new Error('API request failed (' + response.status + ').');
  }
  return response.json() as Promise<T>;
}
export const getCommitments = () => request<Commitment[]>('/commitments');
export const getInsights = () => request<Insight>('/insights');
export const addCommitment = (title: string, scheduled_time: string) =>
  request<Commitment>('/commitments', { method: 'POST', body: JSON.stringify({ title, scheduled_time }) });
export const addCheckin = (id: number, status: Status, reason?: Reason) =>
  request('/commitments/' + id + '/checkins', { method: 'POST', body: JSON.stringify({ status, reason: reason ?? null }) });

export type AIReflection = { reflection: string; source: 'ai' | 'rules' };
export const getAIReflection = () => request<AIReflection>('/insights/ai', { method: 'POST' });

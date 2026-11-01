import { supabase } from './supabase';

const baseUrl = 'https://gutech-lms-apiog.vercel.app/api';
async function request(path: string, init: RequestInit = {}) {
  const { data: { session } } = await supabase?.auth.getSession() ?? { data: { session: null } };
  const response = await fetch(`${baseUrl}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}), ...init.headers } });
  if (response.status === 204) return undefined;
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message ?? 'Unable to complete the request.');
  return body;
}
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const body = await request(path, init);
  return body?.data as T;
}
export async function apiPage<T>(path: string, init: RequestInit = {}): Promise<{ data: T[]; meta: { page: number; pageSize: number; total: number } }> {
  return request(path, init) as Promise<{ data: T[]; meta: { page: number; pageSize: number; total: number } }>;
}
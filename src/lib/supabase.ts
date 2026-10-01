import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { LOCAL_DEMO } from '@/config/appMode';

const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

export function getSupabaseConfigStatus(): { ok: boolean; missing: string[] } {
  if (LOCAL_DEMO) {
    return { ok: true, missing: [] };
  }
  const missing: string[] = [];
  if (!supabaseUrl) {
    missing.push('VITE_SUPABASE_URL');
  }
  if (!supabaseAnonKey) {
    missing.push('VITE_SUPABASE_ANON_KEY');
  }
  return { ok: missing.length === 0, missing };
}

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (LOCAL_DEMO) {
    throw new Error(
      'Supabase is disabled in local demo mode. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY and leave VITE_LOCAL_DEMO empty to use the database.',
    );
  }
  if (!client) {
    const { ok, missing } = getSupabaseConfigStatus();
    if (!ok) {
      throw new Error('Supabase is not configured. Missing: ' + missing.join(', '));
    }
    client = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

export function newId(): string {
  return crypto.randomUUID();
}

export function throwIfError(error: { message: string } | null, action: string): void {
  if (error) {
    throw new Error(`${action}: ${error.message}`);
  }
}

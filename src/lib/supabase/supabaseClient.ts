import { createClient, SupabaseClient } from '@supabase/supabase-js';

const STORAGE_URL_KEY = 'rallyup_supabase_url';
const STORAGE_ANON_KEY = 'rallyup_supabase_anon_key';

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

export interface SupabaseConfig {
  url: string;
  anonKey: string;
  source: 'env' | 'local' | 'none';
}

export function getSupabaseConfig(): SupabaseConfig {
  const envUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
  const envKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || '';

  if (envUrl && envKey) {
    return { url: envUrl, anonKey: envKey, source: 'env' };
  }

  if (typeof window !== 'undefined') {
    const localUrl = localStorage.getItem(STORAGE_URL_KEY)?.trim() || '';
    const localKey = localStorage.getItem(STORAGE_ANON_KEY)?.trim() || '';
    if (localUrl && localKey) {
      return { url: localUrl, anonKey: localKey, source: 'local' };
    }
  }

  return { url: '', anonKey: '', source: 'none' };
}

export function saveSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window === 'undefined') return;
  const cleanUrl = url.trim();
  const cleanKey = anonKey.trim();

  if (cleanUrl && cleanKey) {
    localStorage.setItem(STORAGE_URL_KEY, cleanUrl);
    localStorage.setItem(STORAGE_ANON_KEY, cleanKey);
  } else {
    localStorage.removeItem(STORAGE_URL_KEY);
    localStorage.removeItem(STORAGE_ANON_KEY);
  }
  cachedClient = null;
  cachedConfigKey = '';
}

export function getSupabaseClient(): SupabaseClient | null {
  const { url, anonKey } = getSupabaseConfig();
  if (!url || !anonKey) return null;

  const key = `${url}::${anonKey}`;
  if (cachedClient && cachedConfigKey === key) {
    return cachedClient;
  }

  try {
    cachedClient = createClient(url, anonKey, {
      realtime: {
        params: {
          eventsPerSecond: 20,
        },
      },
    });
    cachedConfigKey = key;
    return cachedClient;
  } catch (err) {
    console.error('Invalid Supabase client configuration:', err);
    return null;
  }
}

export function isSupabaseConfigured(): boolean {
  const { url, anonKey } = getSupabaseConfig();
  return Boolean(url && anonKey);
}

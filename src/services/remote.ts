/**
 * Supabase é OPCIONAL. Sem EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY o app funciona
 * 100% local e todos os módulos clínicos ficam desligados (o servidor é quem pode ligá-los).
 * Nunca colocar a service_role key no app.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppEnv, ModuleFlag } from '../domain/flags';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
export const APP_ENV = (process.env.EXPO_PUBLIC_APP_ENV as AppEnv) || 'development';

let client: SupabaseClient | null = null;

const secureStorage = {
  getItem: (k: string) => SecureStore.getItemAsync(k),
  setItem: (k: string, v: string) => SecureStore.setItemAsync(k, v),
  removeItem: (k: string) => SecureStore.deleteItemAsync(k),
};

export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (!client) {
    client = createClient(url, anonKey, {
      auth: { storage: secureStorage, autoRefreshToken: true, persistSession: true, detectSessionInUrl: false },
    });
  }
  return client;
}

/** Flags do servidor (tabela public.module_flags, somente leitura para clientes). */
export async function fetchServerFlags(): Promise<Partial<Record<ModuleFlag, boolean>> | null> {
  const sb = getSupabase();
  if (!sb) return null;
  try {
    const { data, error } = await sb.from('module_flags').select('flag, enabled').eq('environment', APP_ENV);
    if (error || !data) return null;
    return Object.fromEntries(data.map((r: { flag: ModuleFlag; enabled: boolean }) => [r.flag, r.enabled]));
  } catch {
    return null;
  }
}

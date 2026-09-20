/**
 * Načte nastavení Supabase z Vite env — v produkci musí být nastavené
 * ve Vercelu. Názvy proměnných jsou z `.env.example` tohoto repozitáře
 * (`VITE_SUPABASE_ANON_KEY`, ne `VITE_SUPABASE_PUBLISHABLE_KEY` z CRM).
 *
 * Převzato z `crm/src/integrations/supabase/env.ts` (vividbooks CRM,
 * commit `831f9ae6`).
 */
export function getSupabaseEnv(): {
  url: string;
  anonKey: string;
  isConfigured: boolean;
} {
  const url = import.meta.env.VITE_SUPABASE_URL ?? "";
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";
  return {
    url,
    anonKey,
    isConfigured: Boolean(url?.trim() && anonKey?.trim()),
  };
}

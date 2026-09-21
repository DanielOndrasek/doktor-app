import { createClient } from "@supabase/supabase-js";

import { getSupabaseEnv } from "./env";
import { cs } from "@/lib/i18n/cs";
import type { Database } from "@/types/database";

const { url: SUPABASE_URL, anonKey: SUPABASE_ANON_KEY, isConfigured } = getSupabaseEnv();

if (!isConfigured && typeof window !== "undefined") {
  console.error(`[Supabase] ${cs.prihlaseni.chybiKonfigurace}`);
}

// createClient() vyžaduje syntakticky platnou http(s) URL a s prázdným
// vstupem vyhodí výjimku PŘI IMPORTU modulu — dřív, než se stihne cokoli
// vykreslit. Bez konfigurace proto použijeme neškodný placeholder; reálná
// volání API stejně selžou a přihlašovací stránka to řekne srozumitelně.
const EFFECTIVE_SUPABASE_URL = isConfigured ? SUPABASE_URL : "https://supabase-not-configured.invalid";
const EFFECTIVE_SUPABASE_ANON_KEY = isConfigured ? SUPABASE_ANON_KEY : "not-configured";

/**
 * Jediný klient Supabase v aplikaci. Tabulky Doktora žijí ve schématu
 * `doktor` (oddíl 3 plánu), proto `db.schema`.
 *
 * `Database` je generovaný ze schématu (`src/types/database.ts`, viz
 * CLAUDE.md — typy se generují, nepíší ručně). Po každé migraci se
 * přegeneruje a commitne spolu s ní. Schéma je v generiku napsané
 * výslovně, aby `from("ukoly")` zůstalo typované, i kdyby generátor někdy
 * přidal `public`.
 *
 * Převzato z `crm/src/integrations/supabase/client.ts` (vividbooks CRM,
 * commit `831f9ae6`); tam bylo `schema: "crm"`.
 */
export const supabase = createClient<Database, "doktor">(EFFECTIVE_SUPABASE_URL, EFFECTIVE_SUPABASE_ANON_KEY, {
  db: { schema: "doktor" },
  auth: {
    storage: localStorage,
    persistSession: true,
    autoRefreshToken: true,
  },
});

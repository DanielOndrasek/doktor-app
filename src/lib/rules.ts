import { cs } from "@/lib/i18n/cs";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

/**
 * Pravidla pro Clauda (`pouceni`, oddíl 3 plánu): jak psát odpovědi a třídit
 * poštu. Návrhy (`stav = navrh`) přicházejí z běhů — ÚKOL 39 `opravy_sber`
 * porovná návrh z běhu s tím, co lékař skutečně odeslal, a z rozdílů Claude
 * navrhne poučení (K4.7 „týdenní poučení do wiki ke schválení"). Lékař je tu
 * schvaluje nebo zamítá a přidává vlastní pravidla (ta jsou schválená rovnou).
 * Nic se nemaže (pravidlo 3) — nepotřebné pravidlo je `zamitnuto`.
 * Claude před psaním čte jen schválená (`docs/most-claude.md`).
 */

export type RuleState = "navrh" | "schvaleno" | "zamitnuto";

export interface Rule {
  id: string;
  text: string;
  state: RuleState;
  /** `zdroj_opravy` — id řádků `opravy`, ze kterých návrh vznikl. */
  sourceCorrections: string[];
  createdAt: string;
  updatedAt: string;
}

export interface RuleSource {
  list: () => Promise<Rule[]>;
  /** Vlastní pravidlo lékaře — rovnou schválené. */
  create: (text: string) => Promise<Rule>;
  setState: (id: string, state: RuleState) => Promise<void>;
  updateText: (id: string, text: string) => Promise<void>;
}

const COLUMNS = "id, text, stav, zdroj_opravy, vytvoreno, upraveno" as const;
type Row = Pick<Database["doktor"]["Tables"]["pouceni"]["Row"], "id" | "text" | "stav" | "zdroj_opravy" | "vytvoreno" | "upraveno">;
const STATES = new Set<string>(["navrh", "schvaleno", "zamitnuto"]);

function toRule(r: Row): Rule {
  return {
    id: r.id,
    text: r.text,
    state: STATES.has(r.stav) ? (r.stav as RuleState) : "navrh",
    sourceCorrections: r.zdroj_opravy ?? [],
    createdAt: r.vytvoreno,
    updatedAt: r.upraveno,
  };
}

export function createSupabaseRuleSource(client: typeof supabase = supabase): RuleSource {
  return {
    async list() {
      const { data, error } = await client.from("pouceni").select(COLUMNS).order("vytvoreno", { ascending: false }).limit(200);
      if (error) throw new Error(error.message);
      return data.map(toRule);
    },

    async create(text) {
      const trimmed = text.trim();
      if (!trimmed) throw new Error(cs.nastaveni.pravidla.chybiText);
      // RLS chce `user_id = auth.uid()` — bere se ze session, ne z formuláře.
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session) throw new Error(cs.engine.neprihlasen);
      const { data, error } = await client
        .from("pouceni")
        .insert({ user_id: session.user.id, text: trimmed, stav: "schvaleno" })
        .select(COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return toRule(data);
    },

    async setState(id, state) {
      const { error } = await client.from("pouceni").update({ stav: state }).eq("id", id);
      if (error) throw new Error(error.message);
    },

    async updateText(id, text) {
      const trimmed = text.trim();
      if (!trimmed) throw new Error(cs.nastaveni.pravidla.chybiText);
      const { error } = await client.from("pouceni").update({ text: trimmed }).eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}

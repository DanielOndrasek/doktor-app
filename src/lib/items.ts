import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

/**
 * Položky pošty (`polozky`, oddíl 3 plánu) — výsledek běhu třídění: priorita,
 * kategorie, co řešit, návrh odpovědi a stav. Aplikace je jen ukazuje a mění
 * stav (`stav_zdroj = klik`) a rozepsaný text; zakládá je běh (`docs/most-claude.md`).
 *
 * Klíče: seznam zpráv z enginu nemá Message-ID, jen `ref`, proto se seznam
 * páruje přes `ref_cache` (běh ho plní a po přesunu obnovuje `novy_ref`);
 * detail (`mail_get`) Message-ID má, tam se páruje přes `message_id`.
 */

/** `polozky.stav`. „Vyřízeno" v UI je `hotovo` — tak ho čte i `dnes()`. */
export type ItemState = "nove" | "ceka" | "odeslano" | "hotovo" | "zamitnuto";
export type ItemStateSource = "klik" | "schranka" | "beh";

export interface TriageItem {
  id: string;
  messageId: string;
  /** `ref_cache` — poslední známý ref enginu. */
  ref: string | null;
  category: string | null;
  priority: 1 | 2 | 3 | null;
  state: ItemState;
  stateSource: ItemStateSource;
  /** `co_resit` */
  toDo: string | null;
  /** `navrh_predmet`, `navrh_telo` — návrh z běhu (prostý text). */
  draftSubject: string | null;
  draftBody: string | null;
  /** `rozepsano_telo` — co uživatel rozepsal v aplikaci (HTML); běh ho nepřepisuje (E3). */
  userDraft: string | null;
  contactId: string | null;
}

export interface ItemSource {
  /** Položky k refům ze seznamu; klíč mapy je ref. */
  byRefs: (refs: string[]) => Promise<Map<string, TriageItem>>;
  byMessageId: (messageId: string) => Promise<TriageItem | null>;
  /** Změna stavu z kliknutí; `newRef` obnoví `ref_cache` po přesunu (`novy_ref`). */
  setStateByRef: (ref: string, state: ItemState, newRef?: string | null) => Promise<void>;
  /** Rozepsaný text uživatele (E3) — ukládá se průběžně z okna psaní. */
  saveUserDraft: (id: string, html: string) => Promise<void>;
}

const COLUMNS =
  "id, message_id, ref_cache, kategorie, priorita, stav, stav_zdroj, co_resit, navrh_predmet, navrh_telo, rozepsano_telo, kontakt_id" as const;

type ItemRow = Pick<
  Database["doktor"]["Tables"]["polozky"]["Row"],
  "id" | "message_id" | "ref_cache" | "kategorie" | "priorita" | "stav" | "stav_zdroj" | "co_resit" | "navrh_predmet" | "navrh_telo" | "rozepsano_telo" | "kontakt_id"
>;

const STATES: ItemState[] = ["nove", "ceka", "odeslano", "hotovo", "zamitnuto"];

function toItem(r: ItemRow): TriageItem {
  return {
    id: r.id,
    messageId: r.message_id,
    ref: r.ref_cache,
    category: r.kategorie,
    priority: r.priorita === 1 || r.priorita === 2 || r.priorita === 3 ? r.priorita : null,
    state: STATES.includes(r.stav as ItemState) ? (r.stav as ItemState) : "nove",
    stateSource: (r.stav_zdroj as ItemStateSource) ?? "beh",
    toDo: r.co_resit,
    draftSubject: r.navrh_predmet,
    draftBody: r.navrh_telo,
    userDraft: r.rozepsano_telo,
    contactId: r.kontakt_id,
  };
}

export function createSupabaseItemSource(client: typeof supabase = supabase): ItemSource {
  return {
    async byRefs(refs) {
      const map = new Map<string, TriageItem>();
      const unique = [...new Set(refs.filter(Boolean))];
      if (!unique.length) return map;
      const { data, error } = await client.from("polozky").select(COLUMNS).in("ref_cache", unique);
      if (error) throw new Error(error.message);
      for (const row of data) {
        const item = toItem(row);
        if (item.ref) map.set(item.ref, item);
      }
      return map;
    },

    async byMessageId(messageId) {
      if (!messageId) return null;
      const { data, error } = await client.from("polozky").select(COLUMNS).eq("message_id", messageId).limit(1).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toItem(data) : null;
    },

    async setStateByRef(ref, state, newRef) {
      const { error } = await client
        .from("polozky")
        .update({ stav: state, stav_zdroj: "klik", ...(newRef ? { ref_cache: newRef } : {}) })
        .eq("ref_cache", ref);
      if (error) throw new Error(error.message);
    },

    async saveUserDraft(id, html) {
      const { error } = await client.from("polozky").update({ rozepsano_telo: html || null }).eq("id", id);
      if (error) throw new Error(error.message);
    },
  };
}

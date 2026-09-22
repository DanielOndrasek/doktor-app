import { cs } from "@/lib/i18n/cs";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

/**
 * Karty pacientů (`pripady`; O2 změněno 22. 9. 2026): případ = karta pacienta
 * pod odesílajícím lékařem (`kontakty`). Navrhuje ji běh třídění (`stav = navrh`,
 * `stav_zdroj = beh`), lékař ji tady schválí nebo zamítne (`klik`, má přednost —
 * pravidlo 4). Zprávy k případu jsou `polozky.pripad_id`. Nic se nemaže.
 * Rodné číslo se nezapisuje nikam (pravidlo 7); jméno pacienta normálně.
 */

export type CaseState = "navrh" | "schvaleno" | "zamitnuto";

export interface CaseMessageRef {
  id: string;
  subject: string | null;
  from: string | null;
  date: string | null;
}

export interface PatientCase {
  id: string;
  /** Jméno pacienta. */
  name: string;
  summary: string | null;
  state: CaseState;
  stateSource: "klik" | "beh";
  /** Odesílající lékař (kontakt). */
  doctorId: string | null;
  doctorName: string | null;
  lastMessageAt: string | null;
  createdAt: string;
  updatedAt: string;
  /** Zprávy k případu (`polozky.pripad_id`), nejnovější první; nejvýš pár posledních. */
  messages: CaseMessageRef[];
}

export interface CaseDraft {
  name: string;
  summary: string;
}

export interface CaseSource {
  list: () => Promise<PatientCase[]>;
  setState: (id: string, state: CaseState) => Promise<void>;
  update: (id: string, draft: CaseDraft) => Promise<void>;
  /** Ruční karta lékaře — rovnou schválená. */
  create: (draft: CaseDraft) => Promise<PatientCase>;
}

const COLUMNS = "id, nazev, shrnuti, stav, stav_zdroj, kontakt_id, posledni_zprava, vytvoreno, upraveno, kontakty:kontakt_id (jmeno, prijmeni, tituly)" as const;
const STATES = new Set<string>(["navrh", "schvaleno", "zamitnuto"]);
const MESSAGES_PER_CASE = 5;

type Row = Pick<Database["doktor"]["Tables"]["pripady"]["Row"], "id" | "nazev" | "shrnuti" | "stav" | "stav_zdroj" | "kontakt_id" | "posledni_zprava" | "vytvoreno" | "upraveno"> & {
  kontakty: { jmeno: string | null; prijmeni: string | null; tituly: string | null } | null;
};

function toCase(r: Row, messages: CaseMessageRef[]): PatientCase {
  const doctor = r.kontakty ? [r.kontakty.tituly, r.kontakty.jmeno, r.kontakty.prijmeni].filter(Boolean).join(" ").trim() : "";
  return {
    id: r.id,
    name: r.nazev,
    summary: r.shrnuti,
    state: STATES.has(r.stav) ? (r.stav as CaseState) : "navrh",
    stateSource: r.stav_zdroj === "klik" ? "klik" : "beh",
    doctorId: r.kontakt_id,
    doctorName: doctor || null,
    lastMessageAt: r.posledni_zprava,
    createdAt: r.vytvoreno,
    updatedAt: r.upraveno,
    messages,
  };
}

export function createSupabaseCaseSource(client: typeof supabase = supabase): CaseSource {
  return {
    async list() {
      const { data, error } = await client
        .from("pripady")
        .select(COLUMNS)
        .order("posledni_zprava", { ascending: false, nullsFirst: false })
        .order("vytvoreno", { ascending: false })
        .limit(300);
      if (error) throw new Error(error.message);
      const rows = (data ?? []) as unknown as Row[];
      if (!rows.length) return [];

      const { data: items, error: iErr } = await client
        .from("polozky")
        .select("id, pripad_id, predmet, od, datum")
        .in(
          "pripad_id",
          rows.map((r) => r.id),
        )
        .order("datum", { ascending: false, nullsFirst: false })
        .limit(2000);
      if (iErr) throw new Error(iErr.message);
      const byCase = new Map<string, CaseMessageRef[]>();
      for (const it of items ?? []) {
        if (!it.pripad_id) continue;
        const list = byCase.get(it.pripad_id) ?? [];
        if (list.length < MESSAGES_PER_CASE) list.push({ id: it.id, subject: it.predmet, from: it.od, date: it.datum });
        byCase.set(it.pripad_id, list);
      }
      return rows.map((r) => toCase(r, byCase.get(r.id) ?? []));
    },

    async setState(id, state) {
      const { error } = await client.from("pripady").update({ stav: state, stav_zdroj: "klik" }).eq("id", id);
      if (error) throw new Error(error.message);
    },

    async update(id, draft) {
      if (!draft.name.trim()) throw new Error(cs.pacienti.chybiJmeno);
      const { error } = await client.from("pripady").update({ nazev: draft.name.trim(), shrnuti: draft.summary.trim() || null }).eq("id", id);
      if (error) throw new Error(error.message);
    },

    async create(draft) {
      if (!draft.name.trim()) throw new Error(cs.pacienti.chybiJmeno);
      // RLS chce `user_id = auth.uid()` — bere se ze session, ne z formuláře.
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session) throw new Error(cs.engine.neprihlasen);
      const { data, error } = await client
        .from("pripady")
        .insert({ user_id: session.user.id, nazev: draft.name.trim(), shrnuti: draft.summary.trim() || null, stav: "schvaleno", stav_zdroj: "klik" })
        .select(COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return toCase(data as unknown as Row, []);
    },
  };
}

import { EngineError, type EngineClient, type WireEnvelope } from "@/lib/engine/client";
import { cs } from "@/lib/i18n/cs";
import { supabase } from "@/lib/supabase/client";
import type { Database, Json } from "@/types/database";

/**
 * Události (K3.7): návrhy z mailů, kolize ve třech vrstvách kalendářů, zápis
 * do kalendáře jen na kliknutí (`CLAUDE.md`, „Čeho se vyvarovat").
 *
 * `EventProposal` je projekce řádku `udalosti` (oddíl 3 plánu: polozka_id,
 * nazev, zacatek, konec, celodenni, misto, kalendar, stav, kal_uid, kolize).
 * Řádky čte supabase-js pod RLS (`createSupabaseEventSource` níže), s kalendáři
 * mluví jen engine (`cal_*`). Nic tu není převzaté z CRM: to mělo jen Google
 * kalendář a `task_gcal_sync`, který se podle plánu nepřebírá.
 */

export type EventState = "novy" | "pridano" | "zamitnuto";

/** Jedna z vrstev kalendářů. Jména dodá zdroj — tady se nevymýšlejí. */
export interface CalendarRef {
  id: string;
  name: string;
}

/** Co v kalendářích koliduje s navrženým časem. */
export interface EventConflict {
  title: string;
  start: string;
  end: string | null;
  calendar: string;
}

export interface EventProposal {
  id: string;
  /** `polozka_id` — zpráva, ze které návrh vznikl. */
  itemId: string | null;
  /** Předmět nebo odesílatel zprávy — čitelný původ návrhu. */
  itemLabel: string | null;
  /** Odkaz na zprávu v Poště. */
  itemHref?: string;
  title: string;
  /** ISO čas; u celodenní události datum. */
  start: string;
  end: string | null;
  allDay: boolean;
  place: string | null;
  /** Navržený kalendář (`kalendar`); uživatel ho může před zápisem změnit. */
  calendarId: string | null;
  state: EventState;
  /** `kal_uid` po zápisu. */
  calUid: string | null;
  conflicts: EventConflict[];
}

export interface EventSource {
  load: () => Promise<EventProposal[]>;
  calendars: () => Promise<CalendarRef[]>;
  /** Zápis do kalendáře — volá se **jen** z kliknutí na „Přidat do kalendáře". */
  add: (event: EventProposal, calendarId: string) => Promise<{ calUid: string }>;
  reject: (event: EventProposal) => Promise<void>;
}

/** Prázdný zdroj — pro náhledy a testy obrazovky bez databáze. */
export const EMPTY_EVENT_SOURCE: EventSource = {
  load: async () => [],
  calendars: async () => [],
  add: async () => ({ calUid: "" }),
  reject: async () => {},
};

// ---------------------------------------------------------------------------
// Zdroj nad `udalosti` (Supabase, RLS) a kalendáři enginu (`cal_*`).
// ---------------------------------------------------------------------------

const EVENT_COLUMNS =
  "id, polozka_id, nazev, zacatek, konec, celodenni, misto, kalendar, stav, kal_uid, kolize, polozky (predmet, od, od_email)" as const;

type UdalostRow = Pick<
  Database["doktor"]["Tables"]["udalosti"]["Row"],
  "id" | "polozka_id" | "nazev" | "zacatek" | "konec" | "celodenni" | "misto" | "kalendar" | "stav" | "kal_uid" | "kolize"
> & {
  polozky: Pick<Database["doktor"]["Tables"]["polozky"]["Row"], "predmet" | "od" | "od_email"> | null;
};

/**
 * Tvary nástrojů enginu (MCP, 21. 9. 2026): `cal_calendars` → `{pocet, kalendare: string[]}`
 * (názvy kalendářů iCloud; název je i id), `cal_pridat(kalendar, nazev, datum, cas, minut,
 * celodenni, misto, popis, potvrzeni = "PRIDAT", zdroj_id)` → `{ok, uid?}` (K2.3 ať vrací `kal_uid`).
 */
interface WireCalendars extends WireEnvelope {
  pocet?: number;
  kalendare?: string[];
}
interface WireCalAdd extends WireEnvelope {
  kal_uid?: string;
  uid?: string;
}

/** `zacatek`/`konec` (ISO) → `datum`, `cas`, `minut` nástroje `cal_pridat`. */
function calArgs(event: EventProposal): { datum: string; cas: string; minut: number | undefined } {
  const start = new Date(event.start);
  const valid = !Number.isNaN(start.getTime());
  const datum = valid ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}` : event.start.slice(0, 10);
  if (event.allDay || !valid) return { datum, cas: "", minut: undefined };
  const cas = `${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`;
  const end = event.end ? new Date(event.end) : null;
  const minut = end && !Number.isNaN(end.getTime()) ? Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000)) : undefined;
  return { datum, cas, minut };
}
/** Prvek `udalosti.kolize` — `[{nazev, zacatek, konec, kalendar}]` z `cal_free`. */
interface WireConflict {
  nazev?: string;
  zacatek?: string;
  konec?: string | null;
  kalendar?: string;
}

const EVENT_STATES = new Set<string>(["novy", "pridano", "zamitnuto"]);

function isEventState(value: string): value is EventState {
  return EVENT_STATES.has(value);
}

/** `kolize` je jsonb — čte se obranně, cizí tvar dá prázdný seznam, ne pád obrazovky. */
function toConflicts(value: Json): EventConflict[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const c = item as WireConflict;
    if (typeof c.zacatek !== "string") return [];
    return [{ title: c.nazev ?? "", start: c.zacatek, end: c.konec ?? null, calendar: c.kalendar ?? "" }];
  });
}

/** Původ návrhu: předmět zprávy, jinak odesílatel. */
function itemLabel(polozka: UdalostRow["polozky"]): string | null {
  if (!polozka) return null;
  return polozka.predmet?.trim() || polozka.od || polozka.od_email || null;
}

export function toProposal(row: UdalostRow): EventProposal | null {
  if (!isEventState(row.stav)) return null;
  return {
    id: row.id,
    itemId: row.polozka_id,
    itemLabel: itemLabel(row.polozky),
    itemHref: row.polozka_id ? `/posta?polozka=${row.polozka_id}` : undefined,
    title: row.nazev,
    start: row.zacatek,
    end: row.konec,
    allDay: row.celodenni,
    place: row.misto,
    calendarId: row.kalendar,
    state: row.stav,
    calUid: row.kal_uid,
    conflicts: toConflicts(row.kolize),
  };
}

export interface SupabaseEventSourceOptions {
  /** Engine pro `cal_calendars` a `cal_pridat`; `null` = není propojený (bez kalendářů, jen zamítání). */
  engine: EngineClient | null;
  client?: typeof supabase;
}

/**
 * Návrhy událostí z `udalosti` přes supabase-js pod RLS; kalendáře a zápis
 * do nich přes engine (`cal_calendars`, `cal_pridat` — plán 4.1, zadání K2
 * B.2). `add` běží **jen** z kliknutí (`CLAUDE.md`, „Čeho se vyvarovat"):
 * nejdřív engine založí událost, pak se do řádku zapíše `stav = pridano`,
 * `kal_uid` a zvolený `kalendar`. `zdroj_id` pro engine je id návrhu, takže
 * opakované kliknutí nezaloží duplikát. Kolize se nepočítají tady — plní je
 * běh z `cal_free` do `udalosti.kolize`.
 */
export function createSupabaseEventSource(options: SupabaseEventSourceOptions): EventSource {
  const client = options.client ?? supabase;
  const engine = options.engine;

  return {
    async load() {
      const { data, error } = await client
        .from("udalosti")
        .select(EVENT_COLUMNS)
        .order("zacatek", { ascending: true });
      if (error) throw new Error(error.message);
      return data.map(toProposal).filter((p): p is EventProposal => p !== null);
    },

    async calendars() {
      if (!engine) return [];
      const data = await engine.call<WireCalendars>("cal_calendars");
      return (data.kalendare ?? []).map((name) => ({ id: name, name }));
    },

    async add(event, calendarId) {
      if (!engine) throw new EngineError("not_configured", cs.udalosti.engineNepropojen);
      if (event.state !== "novy") throw new Error(cs.udalosti.uzNeniNovy);
      const { datum, cas, minut } = calArgs(event);
      const data = await engine.call<WireCalAdd>("cal_pridat", {
        kalendar: calendarId,
        nazev: event.title,
        datum,
        cas,
        ...(minut !== undefined ? { minut } : {}),
        celodenni: event.allDay,
        misto: event.place ?? "",
        zdroj_id: event.id,
        // Zápis do kalendáře je vždy z tlačítka (nikdy z běhu); engine chce
        // potvrzení výslovně, a to řetězcem.
        potvrzeni: "PRIDAT",
      });
      const calUid = data.kal_uid ?? data.uid;
      if (!calUid) throw new EngineError("bad_response", cs.engine.neplatnaOdpoved);

      const { error } = await client
        .from("udalosti")
        .update({ stav: "pridano", kal_uid: calUid, kalendar: calendarId })
        .eq("id", event.id);
      if (error) throw new Error(error.message);
      return { calUid };
    },

    async reject(event) {
      const { error } = await client.from("udalosti").update({ stav: "zamitnuto" }).eq("id", event.id);
      if (error) throw new Error(error.message);
    },
  };
}

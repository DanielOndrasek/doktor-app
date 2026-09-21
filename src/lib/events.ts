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

/** Tvary odpovědí enginu (zadání K2, část B.2). Když K2.3 řekne jinak, mění se jen tady. */
interface WireCalendars extends WireEnvelope {
  kalendare?: { id: string; nazev: string }[];
}
interface WireCalAdd extends WireEnvelope {
  kal_uid?: string;
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
      return (data.kalendare ?? []).map((k) => ({ id: k.id, name: k.nazev }));
    },

    async add(event, calendarId) {
      if (!engine) throw new EngineError("not_configured", cs.udalosti.engineNepropojen);
      if (event.state !== "novy") throw new Error(cs.udalosti.uzNeniNovy);
      const data = await engine.call<WireCalAdd>("cal_pridat", {
        kalendar_id: calendarId,
        nazev: event.title,
        zacatek: event.start,
        konec: event.end ?? undefined,
        celodenni: event.allDay,
        misto: event.place ?? undefined,
        polozka_id: event.itemId ?? undefined,
        zdroj_id: event.id,
        // Zápis do kalendáře je vždy z tlačítka (nikdy z běhu); engine chce
        // potvrzení výslovně.
        potvrzeni: true,
      });
      if (!data.kal_uid) throw new EngineError("bad_response", cs.engine.neplatnaOdpoved);

      const { error } = await client
        .from("udalosti")
        .update({ stav: "pridano", kal_uid: data.kal_uid, kalendar: calendarId })
        .eq("id", event.id);
      if (error) throw new Error(error.message);
      return { calUid: data.kal_uid };
    },

    async reject(event) {
      const { error } = await client.from("udalosti").update({ stav: "zamitnuto" }).eq("id", event.id);
      if (error) throw new Error(error.message);
    },
  };
}

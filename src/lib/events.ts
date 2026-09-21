/**
 * Události (K3.7): návrhy z mailů, kolize ve třech vrstvách kalendářů, zápis
 * do kalendáře jen na kliknutí (`CLAUDE.md`, „Čeho se vyvarovat").
 *
 * `EventProposal` je projekce řádku `udalosti` (oddíl 3 plánu: polozka_id,
 * nazev, zacatek, konec, celodenni, misto, kalendar, stav, kal_uid, kolize).
 * Kdo řádky čte a kdo mluví s kalendáři (engine, `cal_*`), rozhodne K2 —
 * sem chodí hotové. Nic tu není převzaté z CRM: to mělo jen Google
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

/** Dokud není K2, obrazovka ukazuje prázdný stav. */
export const EMPTY_EVENT_SOURCE: EventSource = {
  load: async () => [],
  calendars: async () => [],
  add: async () => ({ calUid: "" }),
  reject: async () => {},
};

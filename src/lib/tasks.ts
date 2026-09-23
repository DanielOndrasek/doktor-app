import type { KanbanCardData, KanbanState, TaskState } from "@/components/kanban";
import { KANBAN_COLUMNS, TASK_STATES } from "@/components/kanban";
import { cs } from "@/lib/i18n/cs";
import { EngineError, type EngineClient } from "@/lib/engine/client";
import { supabase } from "@/lib/supabase/client";
import type { Database } from "@/types/database";

/**
 * Zdroj úkolů pro obrazovku Úkoly (K3.6). Karta je projekce řádku `ukoly`
 * (oddíl 3 plánu); řádky čte supabase-js pod RLS a na kartu je mapuje
 * `toCard` níže.
 *
 * `move` zapisuje nový `stav` **a `stav_zdroj = klik`** (pravidlo 4
 * v `CLAUDE.md`): stav se odvozuje ze schránky, ne jen z kliknutí, a proto
 * musí být vidět, odkud změna přišla. `stav_zmenen` nastavuje trigger
 * `ukoly_stav_zmenen` v databázi, aplikace ho neposílá.
 */
/** Odkud úkol přišel (`ukoly.zdroj`). */
export type TaskOrigin = "email" | "claude" | "rucne" | "plaud";

/** Celý úkol pro detail — projekce řádku `ukoly` (vše, co dialog ukazuje nebo mění). */
export interface TaskDetail {
  id: string;
  title: string;
  description: string | null;
  state: TaskState;
  /** `priorita` — text, v UI P1–P3. */
  priority: string | null;
  area: string | null;
  kind: string | null;
  /** `termin` jako „YYYY-MM-DD". */
  dueDate: string | null;
  /** `cas` jako „HH:MM"; bez data nedává smysl. */
  dueTime: string | null;
  contactId: string | null;
  contactLabel: string | null;
  /** `polozka_id` — zpráva, ze které úkol vznikl. */
  itemId: string | null;
  itemHref?: string;
  source: TaskOrigin;
  stateEnteredAt: string;
  createdAt: string;
  calUid: string | null;
}

/** Co uživatel v dialogu edituje. Prázdný řetězec = null. */
export interface TaskDraft {
  title: string;
  description: string;
  state: TaskState;
  priority: string;
  area: string;
  kind: string;
  dueDate: string;
  dueTime: string;
}

/** Zakládání navíc nese vazby, které dialog nezadává (úkol z mailu, ze zápisu). */
export interface TaskCreateInput extends TaskDraft {
  contactId?: string | null;
  itemId?: string | null;
  /** Výchozí `rucne`; `email` / `plaud` / `claude` podle toho, kdo zakládá. */
  source?: TaskOrigin;
}

export interface TaskSource {
  load: () => Promise<KanbanCardData[]>;
  move: (card: KanbanCardData, to: KanbanState) => Promise<void>;
  /** Detail; `null` = neexistuje nebo není můj (RLS). */
  get: (id: string) => Promise<TaskDetail | null>;
  create: (input: TaskCreateInput) => Promise<TaskDetail>;
  /** Změna stavu z dialogu je taky klik: zapíše `stav_zdroj = klik`. */
  update: (task: TaskDetail, draft: TaskDraft) => Promise<TaskDetail>;
  /** Přeplánování ze seznamu nebo přetažením v kalendáři: jen `termin`, čas zůstává. */
  reschedule: (card: KanbanCardData, dueDate: string) => Promise<void>;
  /**
   * „Smazat" ze seznamu: úkol se nemaže (pravidlo 3), dostane `stav = zruseno`
   * (`stav_zdroj = klik`) a zmizí z tabule i seznamu. `uncancel` ho vrátí do
   * stavu, ve kterém byl — lišta „Vrátit zpět" v toastu.
   */
  cancel: (card: { id: string; state: TaskState }) => Promise<void>;
  uncancel: (card: { id: string; state: TaskState }) => Promise<void>;
  /**
   * Úkol → iCloud „Pracovní se Simčou" (K3.6). Volá se **jen** z kliknutí; engine
   * `cal_pridat` založí událost a `ukoly.kal_uid` si ji zapamatuje. `undefined`
   * = engine není propojený, tlačítko se neukáže.
   */
  addToCalendar?: (task: TaskDetail) => Promise<{ calUid: string }>;
}

/** Kalendář iCloud pro úkoly (plán K3.6, kontrolní seznam §6). Název je i id kalendáře u enginu. */
export const TASK_CALENDAR = "Pracovní se Simčou";

export function emptyTaskDraft(state: TaskState = "todo"): TaskDraft {
  return { title: "", description: "", state, priority: "", area: "", kind: "", dueDate: "", dueTime: "" };
}

export function draftOf(task: TaskDetail): TaskDraft {
  return {
    title: task.title,
    description: task.description ?? "",
    state: task.state,
    priority: task.priority ?? "",
    area: task.area ?? "",
    kind: task.kind ?? "",
    dueDate: task.dueDate ?? "",
    dueTime: task.dueTime ?? "",
  };
}

/** Prázdný zdroj — pro náhledy a testy obrazovky bez databáze. */
export const EMPTY_TASK_SOURCE: TaskSource = {
  load: async () => [],
  move: async () => {},
  cancel: async () => {},
  uncancel: async () => {},
  get: async () => null,
  create: async () => {
    throw new Error(cs.ukoly.detail.bezZdroje);
  },
  update: async () => {
    throw new Error(cs.ukoly.detail.bezZdroje);
  },
  reschedule: async () => {},
};

/** Sloupce, které tabule čte. `zruseno` na tabuli nepatří, proto se nenačítá. */
const TASK_COLUMNS = "id, nazev, popis, stav, termin, cas, priorita, oblast, stav_zmenen, kontakty (jmeno, prijmeni)" as const;

type UkolRow = Pick<
  Database["doktor"]["Tables"]["ukoly"]["Row"],
  "id" | "nazev" | "popis" | "stav" | "termin" | "cas" | "priorita" | "oblast" | "stav_zmenen"
> & {
  kontakty: Pick<Database["doktor"]["Tables"]["kontakty"]["Row"], "jmeno" | "prijmeni"> | null;
};

const KANBAN_STATES = new Set<string>(KANBAN_COLUMNS.map((c) => c.value));
const ALL_STATES = new Set<string>(TASK_STATES);
const ORIGINS = new Set<string>(["email", "claude", "rucne", "plaud"]);

function isKanbanState(value: string): value is KanbanState {
  return KANBAN_STATES.has(value);
}

function isTaskState(value: string): value is TaskState {
  return ALL_STATES.has(value);
}

/** Detail čte navíc popis, druh, vazby a časy; `cas` z DB je „HH:MM:SS". */
const DETAIL_COLUMNS =
  "id, nazev, popis, stav, priorita, oblast, druh, termin, cas, kontakt_id, polozka_id, zdroj, stav_zmenen, vytvoreno, kal_uid, kontakty (jmeno, prijmeni)" as const;

type UkolDetailRow = Pick<
  Database["doktor"]["Tables"]["ukoly"]["Row"],
  "id" | "nazev" | "popis" | "stav" | "priorita" | "oblast" | "druh" | "termin" | "cas" | "kontakt_id" | "polozka_id" | "zdroj" | "stav_zmenen" | "vytvoreno" | "kal_uid"
> & {
  kontakty: Pick<Database["doktor"]["Tables"]["kontakty"]["Row"], "jmeno" | "prijmeni"> | null;
};

export function toDetail(row: UkolDetailRow): TaskDetail | null {
  if (!isTaskState(row.stav)) return null;
  return {
    id: row.id,
    title: row.nazev,
    description: row.popis,
    state: row.stav,
    priority: row.priorita,
    area: row.oblast,
    kind: row.druh,
    dueDate: row.termin,
    dueTime: row.termin && row.cas ? row.cas.slice(0, 5) : null,
    contactId: row.kontakt_id,
    contactLabel: contactLabel(row.kontakty),
    itemId: row.polozka_id,
    itemHref: row.polozka_id ? `/posta?polozka=${row.polozka_id}` : undefined,
    source: ORIGINS.has(row.zdroj) ? (row.zdroj as TaskOrigin) : "rucne",
    stateEnteredAt: row.stav_zmenen,
    createdAt: row.vytvoreno,
    calUid: row.kal_uid,
  };
}

const orNull = (value: string): string | null => value.trim() || null;

/** Sloupce z draftu; `stav` zvlášť — nese s sebou `stav_zdroj`. */
function draftColumns(draft: TaskDraft): Database["doktor"]["Tables"]["ukoly"]["Update"] {
  const termin = orNull(draft.dueDate);
  return {
    nazev: draft.title.trim(),
    popis: orNull(draft.description),
    priorita: orNull(draft.priority),
    oblast: orNull(draft.area),
    druh: orNull(draft.kind),
    termin,
    cas: termin ? orNull(draft.dueTime) : null,
  };
}

/** Jméno kontaktu na kartě: „Jméno Příjmení", nebo nic. */
function contactLabel(kontakt: UkolRow["kontakty"]): string | null {
  if (!kontakt) return null;
  const label = [kontakt.jmeno, kontakt.prijmeni].filter(Boolean).join(" ").trim();
  return label || null;
}

/**
 * `termin` je `date`, `cas` je `time`; dohromady dají ISO čas bez zóny,
 * který `parseISO` vezme jako místní — přesně to, co lékař u termínu
 * myslí. Bez `termin` karta termín nemá, i kdyby `cas` byl.
 */
function dueOf(row: Pick<UkolRow, "termin" | "cas">): string | null {
  if (!row.termin) return null;
  return row.cas ? `${row.termin}T${row.cas}` : row.termin;
}

export function toCard(row: UkolRow): KanbanCardData | null {
  if (!isKanbanState(row.stav)) return null;
  return {
    id: row.id,
    title: row.nazev,
    description: row.popis,
    state: row.stav,
    due: dueOf(row),
    priority: row.priorita,
    area: row.oblast,
    contactLabel: contactLabel(row.kontakty),
    stateEnteredAt: row.stav_zmenen,
    href: `/ukoly?ukol=${row.id}`,
  };
}

/**
 * Úkoly z tabulky `ukoly` přes supabase-js. RLS vrátí jen řádky
 * přihlášeného uživatele; `user_id` se tu neposílá ani nefiltruje
 * (ochrana je v databázi, ne v klientu — `CLAUDE.md`, Čeho se vyvarovat).
 */
export interface SupabaseTaskSourceOptions {
  /** Engine pro `cal_pridat`; bez něj `addToCalendar` není. */
  engine?: EngineClient | null;
}

export function createSupabaseTaskSource(client: typeof supabase = supabase, options: SupabaseTaskSourceOptions = {}): TaskSource {
  const engine = options.engine ?? null;

  const addToCalendar = async (task: TaskDetail): Promise<{ calUid: string }> => {
    if (!engine) throw new EngineError("not_configured", cs.udalosti.engineNepropojen);
    if (!task.dueDate) throw new Error(cs.ukoly.detail.kalendarBezTerminu);
    if (task.calUid) return { calUid: task.calUid };
    const data = await engine.call<{ ok: boolean; kal_uid?: string; uid?: string }>("cal_pridat", {
      kalendar: TASK_CALENDAR,
      nazev: task.title,
      datum: task.dueDate,
      cas: task.dueTime ?? "",
      ...(task.dueTime ? { minut: 30 } : {}),
      celodenni: !task.dueTime,
      popis: task.description ?? "",
      // Idempotence: opakované kliknutí engine odmítne přes zdroj_id, duplikát nevznikne.
      zdroj_id: `ukol:${task.id}`,
      // Zápis do kalendáře je vždy z tlačítka; engine chce potvrzení výslovně, a to řetězcem.
      potvrzeni: "PRIDAT",
    });
    const calUid = data.kal_uid ?? data.uid;
    if (!calUid) throw new EngineError("bad_response", cs.engine.neplatnaOdpoved);
    const { error } = await client.from("ukoly").update({ kal_uid: calUid }).eq("id", task.id);
    if (error) throw new Error(error.message);
    return { calUid };
  };

  return {
    ...(engine ? { addToCalendar } : {}),
    async load() {
      const { data, error } = await client
        .from("ukoly")
        .select(TASK_COLUMNS)
        .neq("stav", "zruseno")
        .order("poradi", { ascending: true })
        .order("termin", { ascending: true, nullsFirst: false })
        .order("vytvoreno", { ascending: true });
      if (error) throw new Error(error.message);
      return data.map(toCard).filter((card): card is KanbanCardData => card !== null);
    },

    async move(card, to) {
      if (card.state === to) return;
      const { error } = await client
        .from("ukoly")
        .update({ stav: to, stav_zdroj: "klik" })
        .eq("id", card.id);
      if (error) throw new Error(error.message);
    },

    async cancel(card) {
      const { error } = await client.from("ukoly").update({ stav: "zruseno", stav_zdroj: "klik" }).eq("id", card.id);
      if (error) throw new Error(error.message);
    },

    async uncancel(card) {
      const { error } = await client.from("ukoly").update({ stav: card.state, stav_zdroj: "klik" }).eq("id", card.id);
      if (error) throw new Error(error.message);
    },

    async reschedule(card, dueDate) {
      const { error } = await client.from("ukoly").update({ termin: dueDate }).eq("id", card.id);
      if (error) throw new Error(error.message);
    },

    async get(id) {
      const { data, error } = await client.from("ukoly").select(DETAIL_COLUMNS).eq("id", id).maybeSingle();
      if (error) throw new Error(error.message);
      return data ? toDetail(data) : null;
    },

    async create(input) {
      if (!input.title.trim()) throw new Error(cs.ukoly.detail.chybiNazev);
      // RLS chce `user_id = auth.uid()` — bere se ze session, ne z formuláře.
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session) throw new Error(cs.engine.neprihlasen);
      const { data, error } = await client
        .from("ukoly")
        .insert({
          ...draftColumns(input),
          nazev: input.title.trim(),
          user_id: session.user.id,
          stav: input.state,
          stav_zdroj: "klik",
          zdroj: input.source ?? "rucne",
          kontakt_id: input.contactId ?? null,
          polozka_id: input.itemId ?? null,
        })
        .select(DETAIL_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      const detail = toDetail(data);
      if (!detail) throw new Error(cs.ukoly.detail.ulozeniSelhalo);
      return detail;
    },

    async update(task, draft) {
      if (!draft.title.trim()) throw new Error(cs.ukoly.detail.chybiNazev);
      const stateChanged = draft.state !== task.state;
      const { data, error } = await client
        .from("ukoly")
        .update({
          ...draftColumns(draft),
          ...(stateChanged ? { stav: draft.state, stav_zdroj: "klik" } : {}),
        })
        .eq("id", task.id)
        .select(DETAIL_COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      const detail = toDetail(data);
      if (!detail) throw new Error(cs.ukoly.detail.ulozeniSelhalo);
      return detail;
    },
  };
}

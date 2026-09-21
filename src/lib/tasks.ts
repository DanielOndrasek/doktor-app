import type { KanbanCardData, KanbanState } from "@/components/kanban";
import { KANBAN_COLUMNS } from "@/components/kanban";
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
export interface TaskSource {
  load: () => Promise<KanbanCardData[]>;
  move: (card: KanbanCardData, to: KanbanState) => Promise<void>;
}

/** Prázdný zdroj — pro náhledy a testy obrazovky bez databáze. */
export const EMPTY_TASK_SOURCE: TaskSource = {
  load: async () => [],
  move: async () => {},
};

/** Sloupce, které tabule čte. `zruseno` na tabuli nepatří, proto se nenačítá. */
const TASK_COLUMNS = "id, nazev, stav, termin, cas, priorita, oblast, stav_zmenen, kontakty (jmeno, prijmeni)" as const;

type UkolRow = Pick<
  Database["doktor"]["Tables"]["ukoly"]["Row"],
  "id" | "nazev" | "stav" | "termin" | "cas" | "priorita" | "oblast" | "stav_zmenen"
> & {
  kontakty: Pick<Database["doktor"]["Tables"]["kontakty"]["Row"], "jmeno" | "prijmeni"> | null;
};

const KANBAN_STATES = new Set<string>(KANBAN_COLUMNS.map((c) => c.value));

function isKanbanState(value: string): value is KanbanState {
  return KANBAN_STATES.has(value);
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
export function createSupabaseTaskSource(client: typeof supabase = supabase): TaskSource {
  return {
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
  };
}

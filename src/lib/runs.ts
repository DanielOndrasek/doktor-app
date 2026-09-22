import { supabase } from "@/lib/supabase/client";
import type { Database, Json } from "@/types/database";

/**
 * Přehled běhů a zásahů Clauda (K3.9). Tvar převzatý z `crm.agent_runs`
 * (vividbooks CRM, `831f9ae6`): co bylo zadáno, kolik věcí vzniklo, co se
 * přeskočilo a proč, s odkazy na výsledek. `agent_commands` z tabulky
 * převzetí v tom commitu není — `AgentRunsHistory` čte `agent_runs`.
 *
 * V Doktorovi to plní `behy` (zacatek, konec, stav, schranky, pocty, chyba)
 * a `audit` (kdo, nastroj, vstup_hash, vysledek, cas):
 * - **běh** = řádek `behy`; výsledek jsou `polozky` s `beh_id` a k nim
 *   `ukoly` / `udalosti` přes `polozka_id`;
 * - **zásah Clauda** = zápisové nástroje z `audit` (`kdo = claude`: přesun,
 *   vlaječka, koncept, odeslání, kalendář, wiki), seskupené do jednoho
 *   zásahu, když mezi nimi není víc než `GAP_MS`. Čtení (`mail_search`,
 *   `mail_get`) se neukazuje — jsou to stovky řádků a nic nemění.
 * Zásahy aplikace (`kdo = app`) jsou vlastní kliknutí lékaře, ty sem nepatří.
 */

export type RunSource = "beh" | "claude" | "app";
export type RunState = "bezi" | "hotovo" | "chyba";

export interface RunOutcomeRef {
  id: string;
  label: string;
  /** Odkaz do aplikace (položka, úkol, událost). */
  href?: string;
}

export interface Run {
  id: string;
  source: RunSource;
  state: RunState;
  startedAt: string;
  finishedAt: string | null;
  /** Zadání (zásah Clauda) nebo název běhu (7:00 / 13:00 / 17:00). */
  label: string | null;
  /** Počty podle druhu: `{ zpravy: 12, navrhy: 5, ukoly: 2 }`. Klíče jsou z `behy.pocty`, popisky dává i18n. */
  counts: Record<string, number>;
  /** Co se přeskočilo a proč: `{ "bez adresy": 1 }`. */
  skipped: Record<string, number>;
  error: string | null;
  /** Kolik věcí vzniklo; detail se donačte přes `onLoadOutcomes`. */
  createdCount: number;
}

export interface RunsSource {
  /** Poslední běhy a zásahy, nejnovější první. */
  list: (limit?: number) => Promise<Run[]>;
  /** Co z běhu vzniklo — až po rozbalení. */
  outcomes: (run: Run) => Promise<RunOutcomeRef[]>;
}

/** Prázdný zdroj — pro náhledy a testy obrazovky bez databáze. */
export const EMPTY_RUNS_SOURCE: RunsSource = {
  list: async () => [],
  outcomes: async () => [],
};

// ---------------------------------------------------------------------------
// Zdroj nad `behy` + `audit`.
// ---------------------------------------------------------------------------

type BehRow = Database["doktor"]["Tables"]["behy"]["Row"];
type AuditRow = Pick<Database["doktor"]["Tables"]["audit"]["Row"], "id" | "nastroj" | "vysledek" | "cas">;

/** Nástroje, které něco mění; jen ty jsou „zásah". */
export const WRITE_TOOLS = ["mail_move", "mail_flag", "mail_draft", "mail_send", "mail_preposlat", "cal_pridat", "kb_upsert", "mail_sync"] as const;

/** Dvě volání dál od sebe než tohle jsou dva zásahy. */
const GAP_MS = 30 * 60 * 1000;
/** Klíče `pocty`, které znamenají „přeskočeno" (šum). */
const SKIPPED_PREFIX = "sum_";
const STATES = new Set<string>(["bezi", "hotovo", "chyba"]);
const ZASAH_PREFIX = "zasah:";

function toCounts(value: Json): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, number> = {};
  for (const [k, v] of Object.entries(value)) {
    if (typeof v === "number" && Number.isFinite(v)) out[k] = v;
  }
  return out;
}

function toBehRun(r: BehRow): Run {
  const all = toCounts(r.pocty);
  const counts: Record<string, number> = {};
  const skipped: Record<string, number> = {};
  for (const [k, n] of Object.entries(all)) {
    if (k.startsWith(SKIPPED_PREFIX)) skipped[k] = n;
    else counts[k] = n;
  }
  return {
    id: r.id,
    source: "beh",
    state: STATES.has(r.stav) ? (r.stav as RunState) : "chyba",
    startedAt: r.zacatek,
    finishedAt: r.konec,
    label: null,
    counts,
    skipped,
    error: r.chyba,
    createdCount: (counts.polozky ?? 0) + (counts.ukoly ?? 0) + (counts.udalosti ?? 0),
  };
}

/**
 * `audit.vysledek` je buď JSON, nebo Python zápis slovníku (`{'ok': True, …}`),
 * podle toho, který nástroj ho zapsal. Obojí se přečte stejně; co nejde, dá `null`.
 */
function parseResult(vysledek: string | null): Record<string, unknown> | null {
  if (!vysledek) return null;
  const v = vysledek.trim();
  if (!v.startsWith("{")) return null;
  // Python repr → JSON: jednoduše uvozované řetězce (i s `\'` a s `"` uvnitř) se
  // převedou přes JSON.stringify, dvojitě uvozované už JSON jsou; pak True/False/None.
  const pythonish = v
    .replace(/'((?:[^'\\]|\\.)*)'/g, (_m, s: string) => JSON.stringify(s.replace(/\\'/g, "'")))
    .replace(/\bTrue\b/g, "true")
    .replace(/\bFalse\b/g, "false")
    .replace(/\bNone\b/g, "null");
  for (const candidate of [v, pythonish]) {
    try {
      const j: unknown = JSON.parse(candidate);
      if (j && typeof j === "object" && !Array.isArray(j)) return j as Record<string, unknown>;
    } catch {
      /* zkusí se další tvar */
    }
  }
  return null;
}

/** Chyba enginu se do `vysledek` zapisuje jako `chyba: …` nebo slovník s `ok: false`. */
function isFailure(vysledek: string | null): boolean {
  if (!vysledek) return false;
  const v = vysledek.trim().toLowerCase();
  if (v.startsWith("chyba") || v.startsWith("error")) return true;
  const parsed = parseResult(vysledek);
  return parsed?.ok === false;
}

/** Řádky auditu (od nejnovějšího) → zásahy; `rows` v každém zásahu jsou chronologicky. */
export function groupInterventions(rows: AuditRow[]): { run: Run; rows: AuditRow[] }[] {
  const sorted = [...rows].sort((a, b) => a.cas.localeCompare(b.cas));
  const groups: AuditRow[][] = [];
  for (const row of sorted) {
    const last = groups[groups.length - 1];
    const prev = last?.[last.length - 1];
    if (prev && Date.parse(row.cas) - Date.parse(prev.cas) <= GAP_MS) last.push(row);
    else groups.push([row]);
  }
  return groups.reverse().map((g) => {
    const counts: Record<string, number> = {};
    for (const r of g) counts[r.nastroj] = (counts[r.nastroj] ?? 0) + 1;
    const failed = g.filter((r) => isFailure(r.vysledek));
    return {
      rows: g,
      run: {
        id: ZASAH_PREFIX + g[0].id,
        source: "claude",
        state: failed.length ? "chyba" : "hotovo",
        startedAt: g[0].cas,
        finishedAt: g.length > 1 ? g[g.length - 1].cas : null,
        label: null,
        counts,
        skipped: {},
        error: failed.length ? failed.map((r) => r.vysledek).join(" · ") : null,
        createdCount: g.length,
      },
    };
  });
}

/** Krátký text výsledku k řádku auditu: `ok` a JSON se zkrátí na to podstatné. */
function outcomeLabel(nastroj: string, vysledek: string | null): string {
  if (!vysledek) return nastroj;
  const j = parseResult(vysledek);
  if (j) {
    const s = (k: string) => (typeof j[k] === "string" || typeof j[k] === "number" ? String(j[k]) : null);
    const where = s("novy_ref") ?? s("ref") ?? (s("slozka") && s("uid") ? `${s("slozka")}:${s("uid")}` : (s("slozka") ?? s("folder")));
    const parts = [
      s("schranka"),
      s("z") && s("do") ? `${s("z")} → ${s("do")}` : null,
      where,
      s("priznaky"),
      s("message_id"),
      j.ok === false ? (s("chyba") ?? s("duvod")) : null,
    ].filter((x): x is string => !!x);
    return parts.length ? `${nastroj} · ${parts.join(" · ")}` : nastroj;
  }
  const v = vysledek.trim();
  return `${nastroj} · ${v.length > 80 ? `${v.slice(0, 80)}…` : v}`;
}

/**
 * Běhy a zásahy z databáze pod RLS přihlášeného uživatele. `audit` je jen
 * k zápisu a čtení (bez update/delete), `behy` plní běh přes service role.
 */
export function createSupabaseRunsSource(client: typeof supabase = supabase): RunsSource {
  /** Řádky auditu k zásahům z posledního `list()` — detail se z nich skládá bez dalšího dotazu. */
  const interventions = new Map<string, AuditRow[]>();

  return {
    async list(limit = 20) {
      const [behy, audit] = await Promise.all([
        client.from("behy").select("*").order("zacatek", { ascending: false }).limit(limit),
        client
          .from("audit")
          .select("id, nastroj, vysledek, cas")
          .eq("kdo", "claude")
          .in("nastroj", [...WRITE_TOOLS])
          .order("cas", { ascending: false })
          .limit(300),
      ]);
      if (behy.error) throw new Error(behy.error.message);
      if (audit.error) throw new Error(audit.error.message);

      interventions.clear();
      const groups = groupInterventions(audit.data ?? []);
      for (const g of groups) interventions.set(g.run.id, g.rows);

      // Běhy mají přednost: záplava zásahů je nesmí vytlačit ze seznamu (hlavička podle nich pozná, že běhy stojí).
      const runs = (behy.data ?? []).map(toBehRun);
      const interventionRuns = groups.map((g) => g.run).slice(0, Math.max(0, limit - runs.length));
      return [...runs, ...interventionRuns].sort((a, b) => b.startedAt.localeCompare(a.startedAt));
    },

    async outcomes(run) {
      if (run.source === "claude") {
        return (interventions.get(run.id) ?? []).map((r) => ({ id: r.id, label: outcomeLabel(r.nastroj, r.vysledek) }));
      }

      const polozky = await client.from("polozky").select("id, od, predmet").eq("beh_id", run.id).order("datum", { ascending: false });
      if (polozky.error) throw new Error(polozky.error.message);
      const ids = polozky.data.map((p) => p.id);
      const refs: RunOutcomeRef[] = polozky.data.map((p) => ({
        id: `polozka:${p.id}`,
        label: [p.predmet, p.od].filter(Boolean).join(" — "),
        href: `/posta?polozka=${p.id}`,
      }));
      if (!ids.length) return refs;

      const [ukoly, udalosti] = await Promise.all([
        client.from("ukoly").select("id, nazev").in("polozka_id", ids),
        client.from("udalosti").select("id, nazev").in("polozka_id", ids),
      ]);
      if (ukoly.error) throw new Error(ukoly.error.message);
      if (udalosti.error) throw new Error(udalosti.error.message);
      for (const u of ukoly.data) refs.push({ id: `ukol:${u.id}`, label: u.nazev, href: `/ukoly?ukol=${u.id}` });
      for (const e of udalosti.data) refs.push({ id: `udalost:${e.id}`, label: e.nazev, href: `/udalosti?udalost=${e.id}` });
      return refs;
    },
  };
}

import { supabase } from "@/lib/supabase/client";
import type { Database, Json } from "@/types/database";

/**
 * Přehled „Dnes" (K3.5): P1 zprávy, úkoly po termínu, dnešní události, čeká
 * na odpověď. Tvar řádku je převzatý z `crm.today_signals()` (vividbooks CRM,
 * `831f9ae6`) — jeden signál = naléhavost, kategorie, titulek, proč, důkazy
 * a akce — a `signal_dismiss` s trojicí hotovo / odložit / nerelevantní.
 *
 * Signály počítá databáze: `doktor.dnes()` nad `polozky`, `ukoly`, `udalosti`
 * (security invoker, takže RLS platí) a `doktor.signal_odlozit()` je
 * odkládá do `signaly_odlozene` (migrace `20260921120800_signaly_dnes`).
 * Texty skládá funkce česky; aplikace je jen zobrazí.
 */

export type SignalUrgency = 1 | 2 | 3 | 4;

export type SignalCategory = "p1" | "termin" | "udalost" | "odpoved";

export interface SignalAction {
  label: string;
  /** Ikona z `ICONS` v `TodaySignals`; neznámá → obecný odkaz. */
  icon: string;
  /** Kam akce vede; obrazovka to jen předá `onAction`. */
  href: string;
}

export interface Signal {
  /** Stabilní klíč (např. `polozka:<id>`), podle něj se signál odkládá. */
  key: string;
  urg: SignalUrgency;
  cat: SignalCategory;
  title: string;
  why: string;
  evidence: string[];
  actions: SignalAction[];
  /** ISO datum, když signál má termín. */
  dueOn: string | null;
  /** Odkaz na věc, o které signál je (položka, úkol, událost). */
  href?: string;
}

export type SignalDismissAction = "done" | "snoozed" | "irrelevant";

export interface TodaySource {
  load: () => Promise<Signal[]>;
  dismiss: (key: string, action: SignalDismissAction) => Promise<void>;
}

/** Prázdný zdroj — pro náhledy a testy obrazovky bez databáze. */
export const EMPTY_TODAY_SOURCE: TodaySource = {
  load: async () => [],
  dismiss: async () => {},
};

// ---------------------------------------------------------------------------
// Zdroj nad `doktor.dnes()` / `doktor.signal_odlozit()`.
// ---------------------------------------------------------------------------

type DnesRow = Database["doktor"]["Functions"]["dnes"]["Returns"][number];

const URGENCIES = new Set<number>([1, 2, 3, 4]);
const CATEGORIES = new Set<string>(["p1", "termin", "udalost", "odpoved"]);

function isUrgency(value: number): value is SignalUrgency {
  return URGENCIES.has(value);
}

function isCategory(value: string): value is SignalCategory {
  return CATEGORIES.has(value);
}

/** `akce` je jsonb `[{popisek, ikona, href}]` — čte se obranně, cizí tvar dá prázdný seznam. */
function toActions(value: Json): SignalAction[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const a = item as { popisek?: unknown; ikona?: unknown; href?: unknown };
    if (typeof a.href !== "string" || typeof a.popisek !== "string") return [];
    return [{ label: a.popisek, icon: typeof a.ikona === "string" ? a.ikona : "external-link", href: a.href }];
  });
}

/**
 * Generované typy neznají nullabilitu návratových sloupců funkce; `termin`
 * a `href` jsou ve skutečnosti volitelné (viz `returns table` v migraci),
 * proto se tu berou jako `string | null`.
 */
export function toSignal(row: DnesRow): Signal | null {
  if (!isUrgency(row.urg) || !isCategory(row.kat)) return null;
  const termin = row.termin as string | null;
  const href = row.href as string | null;
  return {
    key: row.klic,
    urg: row.urg,
    cat: row.kat,
    title: row.nazev,
    why: row.proc,
    evidence: row.dukazy ?? [],
    actions: toActions(row.akce),
    dueOn: termin ?? null,
    href: href ?? undefined,
  };
}

/**
 * Dnes z databáze: `dnes()` vrací signály seřazené podle naléhavosti
 * a bez odložených; `signal_odlozit(klic, akce)` odloží — hotovo
 * a nerelevantní navždy, odložit na 7 dní. Obojí běží pod RLS
 * přihlášeného uživatele, `user_id` se neposílá.
 */
export function createSupabaseTodaySource(client: typeof supabase = supabase): TodaySource {
  return {
    async load() {
      const { data, error } = await client.rpc("dnes");
      if (error) throw new Error(error.message);
      return (data ?? []).map(toSignal).filter((s): s is Signal => s !== null);
    },

    async dismiss(key, action) {
      const { error } = await client.rpc("signal_odlozit", { p_klic: key, p_akce: action });
      if (error) throw new Error(error.message);
    },
  };
}


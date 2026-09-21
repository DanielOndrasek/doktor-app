/**
 * Přehled běhů a zásahů Clauda (K3.9). Tvar převzatý z `crm.agent_runs`
 * (vividbooks CRM, `831f9ae6`): co bylo zadáno, kolik věcí vzniklo, co se
 * přeskočilo a proč, s odkazy na výsledek. `agent_commands` z tabulky
 * převzetí v tom commitu není — `AgentRunsHistory` čte `agent_runs`.
 *
 * V Doktorovi to plní `behy` (zacatek, konec, stav, schranky, pocty, chyba)
 * a `audit` (kdo, nastroj, vstup_hash, vysledek, cas). Kdo řádky skládá
 * a odkud, rozhodne K2 — sem chodí hotové.
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
  /** Počty podle druhu: `{ zpravy: 12, navrhy: 5, ukoly: 2 }`. */
  counts: Record<string, number>;
  /** Co se přeskočilo a proč: `{ "bez adresy": 1 }`. */
  skipped: Record<string, number>;
  error: string | null;
  /** Kolik věcí vzniklo; detail se donačte přes `onLoadOutcomes`. */
  createdCount: number;
}

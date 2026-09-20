/**
 * Přehled „Dnes" (K3.5): P1 zprávy, úkoly po termínu, dnešní události, čeká
 * na odpověď. Tvar řádku je převzatý z `crm.today_signals()` (vividbooks CRM,
 * `831f9ae6`) — jeden signál = naléhavost, kategorie, titulek, proč, důkazy
 * a akce — a `signal_dismiss` s trojicí hotovo / odložit / nerelevantní.
 *
 * Kde se signály počítají (funkce v Supabase nad `polozky`, `ukoly`,
 * `udalosti`, nebo engine), rozhodne K2. Sem přicházejí hotové.
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

/** Dokud není K2, obrazovka Dnes ukazuje prázdný stav. */
export const EMPTY_TODAY_SOURCE: TodaySource = {
  load: async () => [],
  dismiss: async () => {},
};

/**
 * Zápisy z hovorů (Plaud) čekající na zařazení ke kontaktu.
 *
 * Tvar převzatý z `crm.call_recordings` (vividbooks CRM, `831f9ae6`): přepis,
 * shrnutí, úkoly vytažené z hovoru, nápověda, ke komu hovor patří,
 * a kandidáti. V CRM se hovor zařazoval ke škole a obchodu; v Doktorovi ke
 * kontaktu (K4.6) a zápis končí v `poznamky` (`druh = hovor`, `zdroj = plaud`,
 * `zdroj_id` = id nahrávky), úkoly v `ukoly` (`zdroj = plaud`).
 *
 * Odkud nahrávky přicházejí (edge funkce `plaud-intake` v CRM — v commitu
 * `831f9ae6` není, je jen jmenovaná jako vzor), rozhodne K2. Sem chodí hotové.
 */

export interface ContactCandidate {
  id: string;
  name: string;
  /** Organizace, role — co pomůže rozlišit stejná jména. */
  detail?: string | null;
}

export interface NoteTaskDraft {
  text: string;
  /** ISO datum `YYYY-MM-DD`, nebo `null`. */
  due: string | null;
}

export interface NoteIntake {
  id: string;
  title: string | null;
  /** ISO čas nahrávky; když chybí, bere se `createdAt`. */
  recordedAt: string | null;
  createdAt: string;
  transcript: string;
  summary: string | null;
  tasks: NoteTaskDraft[];
  /** Co v hovoru zaznělo jako jméno / organizace. */
  contactHint: string | null;
  candidates: ContactCandidate[];
}

/** Co uživatel potvrdil v dialogu zařazení. */
export interface NoteAssignment {
  contactId: string;
  summary: string;
  tasks: NoteTaskDraft[];
}

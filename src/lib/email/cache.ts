/**
 * Paměťová cache nad `EngineMailbox` a dvoufázové načítání seznamu.
 *
 * Proč: každé přepnutí schránky nebo složky volalo engine znovu a uživatel koukal
 * na kostru seznamu, i když tytéž zprávy viděl před chvílí. A REST enginu si u
 * `mail_search` vynucuje živé příznaky z IMAPu (nové přihlášení k ÚVN i Gmailu,
 * ~2,4 s), zatímco seznam z indexu trvá milisekundy.
 *
 * Cache drží seznamy, detaily, složky a vlákna **jen v paměti stránky** — nic nejde
 * do Supabase ani do `localStorage` (pravidlo 5: těla zůstávají na enginu; tady jsou
 * jen po dobu otevřené karty prohlížeče). Odhlášení cache vyprázdní (`clearMailCache`).
 *
 * Jak:
 * - `listMessages` vrátí čerstvou stránku bez volání. Jinak načte seznam z indexu
 *   (`liveFlags: false`, milisekundy), vrátí ho a **na pozadí** dotáhne živé příznaky
 *   (`liveFlags: true`); změnu ohlásí přes `watchMessages`, obrazovka si značky přebere.
 * - `peekMessages` dá obrazovce uloženou stránku hned (i prošlou), takže se místo
 *   kostry ukáže starý seznam a potichu se vymění.
 * - `refetchMessages` jde vždy na engine s živými příznaky (tlačítko Obnovit, minutové
 *   obnovení) a výsledek uloží — otevřená složka je tak pořád čerstvá.
 * - souběžné stejné dotazy (StrictMode, dvojí efekt po hledání) sdílejí jeden požadavek.
 * - zápisy (přečteno, vlaječka, přesun, odeslání) cache opraví nebo označí za prošlou;
 *   prošlá stránka se dál ukazuje, jen se při příštím dotazu vymění.
 *
 * Cache je společná pro všechny instance klienta — přepnutí schránky vytváří nový
 * klient, a právě proto musí paměť žít na úrovni modulu.
 */

import type { EngineMailbox, EngineMailboxId } from "./engineMailbox";
import type { ThreadMessage } from "./thread";
import type { MailFolderLayout, MailListMessage, MailListPage, MailListParams, MailMessageDetail } from "./types";

/** Velikost stránky seznamu — jedna hodnota pro obrazovku i přednačtení, jinak se cache mine. */
export const MAIL_PAGE_SIZE = 30;

/** Jak dlouho se seznam bere za čerstvý bez volání enginu; minutové obnovení ho stejně přepisuje. */
export const LIST_FRESH_MS = 2 * 60_000;
const DETAIL_FRESH_MS = 15 * 60_000;
const FOLDERS_FRESH_MS = 15 * 60_000;
const THREAD_FRESH_MS = 2 * 60_000;
/** Kolik detailů (s tělem) se drží; starší vypadávají, ať karta neroste do nekonečna. */
const DETAIL_LIMIT = 80;

interface Entry<T> {
  at: number;
  value: T;
}

interface ListEntry extends Entry<MailListPage> {
  /** Příznaky jsou živé z IMAPu; `false` = z indexu, živé se ještě dotahují. */
  live: boolean;
}

const lists = new Map<string, ListEntry>();
const details = new Map<string, Entry<MailMessageDetail>>();
const folders = new Map<string, Entry<MailFolderLayout>>();
const threads = new Map<string, Entry<ThreadMessage[]>>();
const inflight = new Map<string, Promise<unknown>>();
const listeners = new Set<(key: string) => void>();

/** Vyprázdní všechno — při odhlášení, ať těla zpráv nepřežijí uživatele. */
export function clearMailCache(): void {
  lists.clear();
  details.clear();
  folders.clear();
  threads.clear();
  inflight.clear();
}

function listKey(mailbox: EngineMailboxId, p: MailListParams): string {
  // `unreadOnly` engine nezná a obrazovka ho filtruje sama; `liveFlags` je fáze, ne jiný dotaz.
  const filter = Object.entries(p.filter ?? {})
    .filter(([, v]) => v !== undefined && v !== null && v !== "" && v !== false)
    .sort(([a], [b]) => a.localeCompare(b));
  return [mailbox, p.folderId, (p.search ?? "").trim(), p.pageToken || "0", p.maxResults ?? 25, JSON.stringify(filter)].join("|");
}

function isFresh<T>(entry: Entry<T> | undefined, ttl: number): entry is Entry<T> {
  return !!entry && Date.now() - entry.at < ttl;
}

/** Stejný dotaz za letu se neposílá dvakrát. */
function dedupe<T>(key: string, run: () => Promise<T>): Promise<T> {
  const running = inflight.get(key) as Promise<T> | undefined;
  if (running) return running;
  const promise = run().finally(() => inflight.delete(key));
  inflight.set(key, promise);
  return promise;
}

function notify(key: string): void {
  for (const listener of listeners) listener(key);
}

/**
 * Značky změněné z aplikace (přečteno, vlaječka) v posledních vteřinách. Živé příznaky
 * dotažené na pozadí mohly být přečtené z IMAPu ještě před zápisem — místní změna má
 * na chvíli přednost, jinak by se otevřená zpráva vrátila na tučnou.
 */
const localFlags = new Map<string, { on: boolean; at: number }>();
const LOCAL_FLAG_MS = 30_000;

function applyLocalFlags(page: MailListPage): MailListPage {
  const now = Date.now();
  for (const [key, entry] of localFlags) if (now - entry.at > LOCAL_FLAG_MS) localFlags.delete(key);
  if (!localFlags.size) return page;
  return {
    ...page,
    emails: page.emails.map((m) => {
      let next = m;
      for (const label of ["UNREAD", "STARRED"]) {
        const local = localFlags.get(`${m.id}|${label}`);
        if (local) next = withLabel(next, label, local.on);
      }
      return next;
    }),
  };
}

function storeList(key: string, page: MailListPage, live: boolean): void {
  lists.set(key, { at: Date.now(), value: applyLocalFlags(page), live });
  notify(key);
}

function withLabel(m: MailListMessage, label: string, on: boolean): MailListMessage {
  const has = m.labelIds.includes(label);
  if (on === has) return m;
  return { ...m, labelIds: on ? [...m.labelIds, label] : m.labelIds.filter((l) => l !== label) };
}

/** Upraví zprávu ve všech uložených seznamech (táž zpráva bývá v „vše" i ve své schránce). */
function patchLists(ref: string, patch: (m: MailListMessage) => MailListMessage): void {
  for (const [key, entry] of lists) {
    if (!entry.value.emails.some((m) => m.id === ref)) continue;
    lists.set(key, { ...entry, value: { ...entry.value, emails: entry.value.emails.map((m) => (m.id === ref ? patch(m) : m)) } });
  }
}

function dropFromLists(ref: string): void {
  for (const [key, entry] of lists) {
    if (!entry.value.emails.some((m) => m.id === ref)) continue;
    lists.set(key, { ...entry, value: { ...entry.value, emails: entry.value.emails.filter((m) => m.id !== ref) } });
  }
}

/** Seznamy zůstanou k okamžitému zobrazení, ale příští dotaz je načte znovu. */
function markListsStale(): void {
  for (const entry of lists.values()) entry.at = 0;
}

function patchDetail(ref: string, label: string, on: boolean): void {
  const entry = details.get(ref);
  if (!entry) return;
  const has = entry.value.labelIds.includes(label);
  if (on === has) return;
  const labelIds = on ? [...entry.value.labelIds, label] : entry.value.labelIds.filter((l) => l !== label);
  details.set(ref, { ...entry, value: { ...entry.value, labelIds } });
}

function rememberDetail(ref: string, detail: MailMessageDetail): void {
  details.delete(ref);
  details.set(ref, { at: Date.now(), value: detail });
  while (details.size > DETAIL_LIMIT) {
    const oldest = details.keys().next().value;
    if (oldest === undefined) break;
    details.delete(oldest);
  }
}

export function withMailCache(inner: EngineMailbox, mailbox: EngineMailboxId): EngineMailbox {
  /** Živé příznaky na pozadí — výsledek nahradí stránku z indexu a obrazovka se dozví přes `watchMessages`. */
  const refreshFlags = (params: MailListParams): void => {
    const key = listKey(mailbox, params);
    void dedupe(`${key}|live`, async () => {
      try {
        const page = await inner.listMessages({ ...params, liveFlags: true });
        storeList(key, page, true);
      } catch {
        // Bez živých příznaků se obejdeme — seznam z indexu už uživatel vidí, příště se to zkusí znovu.
      }
    });
  };

  /** Rychlá fáze: index hned, příznaky dojdou. */
  const fetchList = (params: MailListParams): Promise<MailListPage> => {
    const key = listKey(mailbox, params);
    return dedupe(key, async () => {
      const page = await inner.listMessages({ ...params, liveFlags: false });
      storeList(key, page, false);
      refreshFlags(params);
      return page;
    });
  };

  /** Obnovení: jeden dotaz se živými příznaky, výsledek rovnou do cache. */
  const refetchList = (params: MailListParams): Promise<MailListPage> => {
    const key = listKey(mailbox, params);
    return dedupe(`${key}|live`, async () => {
      const page = await inner.listMessages({ ...params, liveFlags: true });
      storeList(key, page, true);
      return page;
    });
  };

  const setFlag = async (ref: string, label: string, on: boolean, write: () => Promise<void>): Promise<void> => {
    localFlags.set(`${ref}|${label}`, { on, at: Date.now() });
    patchLists(ref, (m) => withLabel(m, label, on));
    patchDetail(ref, label, on);
    try {
      await write();
    } catch (err) {
      // Engine to nevzal — cache nesmí tvrdit něco, co ve schránce není.
      localFlags.delete(`${ref}|${label}`);
      patchLists(ref, (m) => withLabel(m, label, !on));
      patchDetail(ref, label, !on);
      throw err;
    }
  };

  const moveMessage: EngineMailbox["moveMessage"] = async (ref, folderId) => {
    const result = await inner.moveMessage(ref, folderId);
    // Přesunem se mění ref i složky na obou stranách — zprávu ze seznamů pryč, zbytek načíst příště znovu.
    dropFromLists(ref);
    details.delete(ref);
    threads.clear();
    markListsStale();
    return result;
  };

  const afterWrite = <T>(result: T): T => {
    // Odesláno / uloženo — Odeslané, Koncepty i vlákna se změnily.
    markListsStale();
    threads.clear();
    return result;
  };

  return {
    ...inner,

    peekMessages(params) {
      return lists.get(listKey(mailbox, params))?.value ?? null;
    },

    async listMessages(params) {
      const entry = lists.get(listKey(mailbox, params));
      if (isFresh(entry, LIST_FRESH_MS)) {
        // Stránka z přednačtení má zatím jen příznaky z indexu — živé se dotáhnou teď.
        if (!entry.live) refreshFlags(params);
        return entry.value;
      }
      return fetchList(params);
    },

    refetchMessages: refetchList,

    watchMessages(params, listener) {
      const key = listKey(mailbox, params);
      const handler = (changed: string) => {
        if (changed !== key) return;
        const entry = lists.get(key);
        if (entry) listener(entry.value);
      };
      listeners.add(handler);
      return () => {
        listeners.delete(handler);
      };
    },

    async getMessage(ref) {
      const entry = details.get(ref);
      if (isFresh(entry, DETAIL_FRESH_MS)) return entry.value;
      return dedupe(`detail|${ref}`, async () => {
        const detail = await inner.getMessage(ref);
        rememberDetail(ref, detail);
        return detail;
      });
    },

    async listFolders() {
      const entry = folders.get(mailbox);
      if (isFresh(entry, FOLDERS_FRESH_MS)) return entry.value;
      return dedupe(`folders|${mailbox}`, async () => {
        const layout = await inner.listFolders();
        folders.set(mailbox, { at: Date.now(), value: layout });
        return layout;
      });
    },

    async thread(threadId) {
      if (!threadId) return [];
      const entry = threads.get(threadId);
      if (isFresh(entry, THREAD_FRESH_MS)) return entry.value;
      return dedupe(`thread|${threadId}`, async () => {
        const rows = await inner.thread(threadId);
        threads.set(threadId, { at: Date.now(), value: rows });
        return rows;
      });
    },

    setRead: (ref, read) => setFlag(ref, "UNREAD", !read, () => inner.setRead(ref, read)),
    setStarred: (ref, starred) => setFlag(ref, "STARRED", starred, () => inner.setStarred(ref, starred)),

    moveMessage,
    moveToFolder: async (ref, folderId) => {
      await moveMessage(ref, folderId);
    },
    archiveMessage: async (ref) => {
      await moveMessage(ref, "archive");
    },

    send: (request) => inner.send(request).then(afterWrite),
    sendWithUploads: (request) => inner.sendWithUploads(request).then(afterWrite),
    forward: (request) => inner.forward(request).then(afterWrite),
    saveDraft: (request) => inner.saveDraft(request).then(afterWrite),
  };
}

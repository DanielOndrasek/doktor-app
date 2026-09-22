import { cs } from "@/lib/i18n/cs";
import type { ComposeSendRequest } from "@/lib/email/compose";
import { htmlToPlainText } from "@/lib/email/html";
import type { ThreadMessage } from "@/lib/email/thread";
import { EngineError, createEngineClient, type EngineClient, type WireEnvelope } from "@/lib/engine/client";
import type {
  MailAttachmentMeta,
  MailContactSearchParams,
  MailContactSearchResult,
  MailFolderLayout,
  MailFolderRef,
  MailListMessage,
  MailListPage,
  MailListParams,
  MailMessageDetail,
  MailSendRequest,
  MailSendResult,
  MailboxClient,
} from "@/lib/email/types";

/**
 * Třetí implementace `MailboxClient`: schránka přes engine `uvn-mail-mcp`,
 * REST `/api/v1` (plán, oddíl 4.1). Se schránkami mluví **jen engine**
 * (pravidlo 1 v `CLAUDE.md`); tohle je tenký klient nad jeho REST.
 *
 * Píše se proti kontraktu, ne proti fantazii: názvy operací jsou názvy
 * nástrojů enginu (`mail_search`, `mail_get`, `mail_flag`, `mail_move`,
 * `mail_send`, `mail_draft`, `mail_folders`, `mail_stats`, `upload`),
 * tvary odpovědí jsou z K1 (`mail_move` → `{ok, novy_ref, slozka,
 * message_id}`; `mail_get(ref, format)`; `prilohy: [{zdroj, …}]`;
 * `{ok:false, duvod}` při odmítnutí). Tvary jsou 1 : 1 s nástroji enginu,
 * jak je vidí MCP (21. 9. 2026) — REST je tenký obal; co engine zatím nemá,
 * je ve `Wire*` typech níže označené jako K2.3.
 *
 * Co tenhle klient **nedělá**, protože to zakazuje `CLAUDE.md`:
 * - `trashMessage`, `deleteFolder`, `createFolder` jsou v kontraktu, ale
 *   vyhodí `not_exposed` a engine se nevolá (pravidlo 3),
 * - `getAttachment` (base64 v kontraktu) vyhodí `attachment_by_link`;
 *   příloha se otevírá podepsaným odkazem `attachmentLink` a nahrává přes
 *   `upload` (pravidlo 2),
 * - `send` s `attachments` (base64) odmítne; přílohy jdou přes
 *   `sendWithUploads` jako `{zdroj: "upload", id}`.
 */

/** Chyby přenosu a obálky jsou společné pro celý engine (`src/lib/engine/client.ts`). */
export { EngineError as EngineMailboxError } from "@/lib/engine/client";
export type { EngineErrorCode as EngineMailboxErrorCode } from "@/lib/engine/client";

/** Schránky, které engine zná (`schranky.typ` v plánu). `all` = sjednocená. */
export type EngineMailboxId = "uvn" | "gmail" | "mediendo" | "all";

export interface EngineMailboxOptions {
  /** Základ REST, typicky `import.meta.env.VITE_ENGINE_URL`. */
  baseUrl: string;
  /** Které schránky se čtou; `all` = sjednocená schránka s přepínačem (K3.2). */
  mailbox?: EngineMailboxId;
  /** JWT ze Supabase — engine ho ověřuje přes JWKS. `null` = nepřihlášen. */
  getToken: () => Promise<string | null>;
  /**
   * Složka, kam jde `archiveMessage`. Výchozí `_Triage/Vyřízeno` — podle
   * kontraktu „Vrátit zpět" v `docs/prevzato/README.md`.
   */
  archiveFolder?: string;
  fetchImpl?: typeof fetch;
}

/** Přesun vrací nový ref — zdroj pravdy o umístění zprávy je engine (ÚKOL 35). */
export interface EngineMoveResult {
  newRef: string;
  folder: string;
  messageId: string;
}

/** Co `send` / `saveDraft` navíc proti `ComposeSendRequest`: podpis (`sendFrom` je už v žádosti z okna psaní). */
export interface EngineSendRequest extends ComposeSendRequest {
  /** `podpis_id` — podpis skládá engine, tělo ho nenese dvakrát. */
  signatureId?: string;
}

export interface EngineUploadResult {
  uploadId: string;
  name: string;
  size: number;
  mimeType: string;
}

/** Výsledek odeslání: kontrakt + varování enginu (`jina_schranka`, pravidlo 8). */
export interface EngineSendResult extends MailSendResult {
  warnings: string[];
}

/** Výsledek přeposlání (`mail_preposlat`): názvy překopírovaných příloh a jestli se povedl `$Forwarded`. */
export interface EngineForwardResult extends EngineSendResult {
  attachments: string[];
  flagged: boolean;
}

/** `MailboxClient` + operace, které kontrakt z CRM nemá a plán je přidává (4.1). */
export interface EngineMailbox extends MailboxClient {
  readonly provider: "engine";
  /** Přesun s výsledkem; `moveToFolder` z kontraktu ho volá a výsledek zahodí. */
  moveMessage(messageId: string, folderId: string): Promise<EngineMoveResult>;
  /** Odeslání s přílohami odkazem (`uploadIds` → `prilohy`). */
  sendWithUploads(request: EngineSendRequest): Promise<EngineSendResult>;
  /** Koncept s přílohami do Konceptů (`mail_draft`). */
  saveDraft(request: EngineSendRequest): Promise<{ ref: string }>;
  /**
   * Přeposlání s původními přílohami (`mail_preposlat`, kontrolní seznam plánu):
   * `request.forwardOf` je ref původní zprávy, `body` poznámka nad ní (HTML se
   * převede na text — engine skládá zprávu sám). Engine to umí jen nad ÚVN.
   */
  forward(request: EngineSendRequest & { forwardOf: string }): Promise<EngineForwardResult>;
  /** Nahrání přílohy multipartem; vrací `upload_id` (pravidlo 2). */
  upload(file: File | Blob, name?: string): Promise<EngineUploadResult>;
  /**
   * Krátkodobý podepsaný odkaz na přílohu (`mail_priloha_odkaz`) — prohlížeč
   * ho otevře napřímo, stream ze skladu, ne base64. Bearer JWT se do `<a href>`
   * nedá, proto odkaz podepisuje engine.
   */
  attachmentLink(messageId: string, attachment: MailAttachmentMeta): Promise<string>;
  /** Celé vlákno chronologicky (`mail_thread`) z indexu enginu, včetně zprávy samé. Obě schránky. */
  thread(threadId: string): Promise<ThreadMessage[]>;
}

/* ── Drátové tvary ─────────────────────────────────────────────────────────
 * Přesně podle nástrojů enginu, jak je vidí MCP 21. 9. 2026 (`mail_search`,
 * `mail_get`, `mail_prilohy`, `mail_folders`, `mail_flag`, `mail_move`,
 * `mail_send`, `mail_draft`, `mail_stats`). REST K2.3 je tenký obal 1 : 1
 * nad nástroji (zadání K2, část B), takže tvary jsou tytéž. Od 21. 9. večer
 * REST stojí (`app/rest_api.py` enginu): `upload`, `mail_priloha_odkaz`,
 * `prilohy` u `mail_send` i `mail_draft`, `telo_html` (REST sám dosadí
 * `format: "html"`), `priznaky` + `schranka` v každém řádku (`zive_priznaky`),
 * `neprectene`, `novy_ref`, `ref` z `mail_draft`, `varovani` u odeslání.
 * ──────────────────────────────────────────────────────────────────────── */

/** Řádek z `mail_search.vysledky` i hlavička z `mail_get`. */
interface WireMessage {
  ref: string;
  id?: number;
  /** `YYYY-MM-DDTHH:MM` bez zóny — místní čas serveru. */
  datum: string;
  smer?: "sent" | "received" | string;
  od: string;
  komu: string;
  kopie?: string;
  predmet: string;
  vlakno: string;
  /** Názvy příloh oddělené čárkou; prázdné = bez příloh. */
  prilohy?: string;
  uryvek?: string;
  /** IMAP FLAGS oddělené čárkou (`\Seen,\Flagged`) — dnes jen z `mail_najdi`, K2.3 i tady. */
  priznaky?: string;
  schranka?: string;
}

interface WireSearchResult extends WireEnvelope {
  pocet: number;
  vysledky: WireMessage[];
}

interface WireMessageDetail extends WireEnvelope, WireMessage {
  message_id: string;
  /** Očištěný text (`plne_telo = true`). */
  telo?: string;
  /** Sanitizované HTML (ÚKOL 36) — až ho engine vrátí, čtečka ho vezme. */
  telo_html?: string;
}

interface WireThread extends WireEnvelope {
  vlakno: string;
  pocet: number;
  zpravy: (WireMessage & { telo?: string })[];
}

interface WireAttachment {
  index: number;
  jmeno: string;
  typ: string;
  bajtu: number;
  druh?: string;
  cist_umim?: boolean;
}

interface WireAttachments extends WireEnvelope {
  pocet: number;
  prilohy: WireAttachment[];
}

interface WireFolder {
  name: string;
  allowed: boolean;
  special: "" | "sent" | "drafts" | string;
  flags: string[];
}

interface WireFolders extends WireEnvelope {
  result: WireFolder[];
}

/** Přesun vrací nový ref (ÚKOL 35). */
interface WireMove extends WireEnvelope {
  novy_ref: string;
  slozka: string;
  message_id: string;
}

interface WireSend extends WireEnvelope {
  message_id?: string;
  priznak_nastaven?: boolean;
  ulozeno_do_sent?: boolean;
  /** `mail_draft`: ref uloženého konceptu. */
  ref?: string;
  /** Např. `jina_schranka: …` — zpráva odešla, ale z jiné schránky, než do které přišla (pravidlo 8). */
  varovani?: string[];
}

interface WireForward extends WireSend {
  /** `složka:uid` původní zprávy. */
  preposlano?: string;
  zpusob?: string;
  priloh?: number;
  /** Názvy překopírovaných příloh. */
  prilohy?: string[];
}

interface WireStats extends WireEnvelope {
  zprav_celkem?: number;
  /** K2.3 — dnes `mail_stats` nepřečtené nevrací. */
  neprectene?: number;
}

interface WireAttachmentLink extends WireEnvelope {
  url: string;
}

interface WireUpload extends WireEnvelope {
  upload_id: string;
  nazev: string;
  velikost: number;
  typ: string;
}

/** Id standardních složek z kontraktu → názvy složek u enginu. */
const STANDARD_FOLDER_TO_ENGINE: Record<string, string> = {
  inbox: "INBOX",
  sent: "Sent",
  drafts: "Drafts",
  archive: "_Triage/Vyřízeno",
};

const STANDARD_FOLDER_NAMES = new Set(Object.values(STANDARD_FOLDER_TO_ENGINE));

/** Gmail refy enginu jsou vždy `[Gmail]/Všechny zprávy:<uid>`. */
const GMAIL_REF_PREFIX = "[Gmail]/";

function engineFolder(folderId: string, archiveFolder: string): string | undefined {
  if (folderId === "all") return undefined;
  if (folderId === "archive") return archiveFolder;
  return STANDARD_FOLDER_TO_ENGINE[folderId] ?? folderId;
}

/** `\Seen,\Flagged,NonJunk` → značky kontraktu (`UNREAD`, `STARRED`). */
function labelsOf(priznaky: string | undefined, smer: string | undefined): string[] {
  const flags = new Set((priznaky ?? "").split(",").map((f) => f.trim()));
  const labels: string[] = [];
  // Bez informace o příznacích (seznam z indexu) zprávu neoznačujeme jako nepřečtenou —
  // lepší nic než všechno tučně.
  if (priznaky !== undefined && !flags.has("\\Seen")) labels.push("UNREAD");
  if (flags.has("\\Flagged")) labels.push("STARRED");
  if (smer === "sent") labels.push("SENT");
  return labels;
}

/** `2026-09-21T11:28` bez zóny → epocha v ms (místní čas prohlížeče = čas lékaře). */
function epochMs(datum: string): string {
  const ms = Date.parse(datum);
  return String(Number.isNaN(ms) ? 0 : ms);
}

function toListMessage(m: WireMessage): MailListMessage {
  return {
    id: m.ref,
    threadId: m.vlakno,
    snippet: m.uryvek ?? "",
    from: m.od,
    to: m.komu,
    subject: m.predmet ?? "",
    date: m.datum,
    internalDate: epochMs(m.datum),
    labelIds: labelsOf(m.priznaky, m.smer),
  };
}

function toAttachmentMeta(a: WireAttachment): MailAttachmentMeta {
  return { filename: a.jmeno, mimeType: a.typ, size: a.bajtu, attachmentId: String(a.index) };
}

/** Jen vyplněné klíče — engine odmítne parametr, který nezná (pydantic). */
function compact(payload: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(payload).filter(([, v]) => v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && v.length === 0)));
}

export function createEngineMailbox(options: EngineMailboxOptions): EngineMailbox {
  const mailbox = options.mailbox ?? "all";
  const archiveFolder = options.archiveFolder ?? "_Triage/Vyřízeno";

  const engine: EngineClient = createEngineClient({
    baseUrl: options.baseUrl,
    getToken: options.getToken,
    fetchImpl: options.fetchImpl,
  });
  /** `POST /api/v1/{tool}` s JSON tělem — tvar 1 : 1 s nástrojem enginu. */
  const call = engine.call;

  // ÚVN je výchozí schránka enginu, proto se `schranka` pro ÚVN neposílá.
  // Sjednocená schránka = `mail_search(schranka: "vse")`; každý řádek nese `schranka`
  // a operace nad jednou zprávou (`mail_get`, `mail_flag`, …) ji potřebují zpět —
  // drží se v `known` podle refu, záložně podle tvaru refu.
  const searchSchranka = mailbox === "all" ? "vse" : mailbox === "uvn" ? undefined : mailbox;
  const known = new Map<string, string>();
  const schrankaOf = (ref: string): string | undefined => {
    if (mailbox !== "all") return searchSchranka;
    const s = known.get(ref) ?? (ref.startsWith(GMAIL_REF_PREFIX) ? "gmail" : "uvn");
    return s === "uvn" ? undefined : s;
  };
  // Odeslání a složky: schránku odeslání určuje `odeslat_z`; bez něj ta, ve které se uživatel dívá.
  const schranka = mailbox === "gmail" || mailbox === "mediendo" ? mailbox : undefined;

  const notExposed = async (): Promise<never> => {
    throw new EngineError("not_exposed", cs.posta.engine.nevystaveno);
  };

  const sendPayload = (request: EngineSendRequest) =>
    compact({
      schranka,
      komu: request.to,
      kopie: request.cc,
      // Prázdné klíče vypadnou v `compact` — engine bere jen vyplněné.
      skryta_kopie: request.bcc,
      predmet: request.subject,
      telo: request.body,
      html: request.isHtml ? true : undefined,
      odpoved_na_message_id: request.inReplyTo,
      odeslat_z: request.sendFrom,
      podpis_id: request.signatureId,
      prilohy: (request.uploadIds ?? []).map((id) => ({ zdroj: "upload", id })),
    });

  async function moveMessage(messageId: string, folderId: string): Promise<EngineMoveResult> {
    const data = await call<WireMove>(
      "mail_move",
      compact({ schranka: schrankaOf(messageId), ref: messageId, slozka: engineFolder(folderId, archiveFolder) }),
    );
    return { newRef: data.novy_ref || messageId, folder: data.slozka, messageId: data.message_id };
  }

  async function search(payload: Record<string, unknown>): Promise<WireMessage[]> {
    const data = await call<WireSearchResult>("mail_search", compact({ schranka: searchSchranka, ...payload }));
    const rows = data.vysledky ?? [];
    for (const m of rows) if (m.schranka) known.set(m.ref, m.schranka);
    return rows;
  }

  async function listMessages(params: MailListParams): Promise<MailListPage> {
    const limit = params.maxResults ?? 25;
    const offset = Number(params.pageToken ?? 0) || 0;
    // `jen_neprectene` engine nemá — filtr nepřečtených přijde s K2.3 (index nezná FLAGS).
    // „Hledat" bez AI (K0.4): `filter` jde 1 : 1 na parametry `mail_search`; `compact` vynechá prázdné.
    const f = params.filter;
    const zpravy = await search({
      slozka: engineFolder(params.folderId, archiveFolder),
      dotaz: params.search?.trim(),
      odesilatel: f?.from?.trim(),
      prijemce: f?.to?.trim(),
      vcetne_kopie: f?.to?.trim() ? true : undefined,
      od_data: f?.dateFrom,
      do_data: f?.dateTo,
      smer: f?.direction,
      // `false` by znamenalo „jen bez přílohy" — to se nenabízí.
      ma_prilohu: f?.hasAttachment ? true : undefined,
      limit,
      offset,
    });
    const more = zpravy.length >= limit;
    return {
      emails: zpravy.map(toListMessage),
      nextPageToken: more ? String(offset + limit) : null,
      resultSizeEstimate: offset + zpravy.length + (more ? 1 : 0),
    };
  }

  const client: EngineMailbox = {
    provider: "engine",

    listMessages,

    async getMessage(messageId): Promise<MailMessageDetail> {
      const s = schrankaOf(messageId);
      const z = await call<WireMessageDetail>("mail_get", compact({ schranka: s, ref: messageId, plne_telo: true }));
      const html = z.telo_html?.trim();
      // Seznam příloh je zvlášť (`mail_prilohy`); volá se jen když zpráva nějaké má.
      const attachments = z.prilohy?.trim()
        ? ((await call<WireAttachments>("mail_prilohy", compact({ schranka: s, ref: messageId }))).prilohy ?? []).map(toAttachmentMeta)
        : [];
      return {
        ...toListMessage(z),
        messageId: z.message_id,
        body: html || z.telo || z.uryvek || "",
        bodyType: html ? "html" : "text",
        attachments,
      };
    },

    async getAttachment(): Promise<string> {
      throw new EngineError("attachment_by_link", cs.posta.engine.prilohaOdkazem);
    },

    async attachmentLink(messageId, attachment) {
      const data = await call<WireAttachmentLink>(
        "mail_priloha_odkaz",
        compact({ schranka: schrankaOf(messageId), ref: messageId, index: Number(attachment.attachmentId) }),
      );
      if (!data.url) throw new EngineError("bad_response", cs.engine.neplatnaOdpoved);
      return data.url;
    },

    async setRead(messageId, read) {
      await call("mail_flag", compact({ schranka: schrankaOf(messageId), ref: messageId, priznak: "seen", nastavit: read }));
    },

    async setStarred(messageId, starred) {
      await call("mail_flag", compact({ schranka: schrankaOf(messageId), ref: messageId, priznak: "flagged", nastavit: starred }));
    },

    trashMessage: notExposed,

    async moveToFolder(messageId, folderId) {
      await moveMessage(messageId, folderId);
    },

    moveMessage,

    async archiveMessage(messageId) {
      await moveMessage(messageId, "archive");
    },

    async listFolders(): Promise<MailFolderLayout> {
      const data = await call<WireFolders>("mail_folders", compact({ schranka }));
      const all = (data.result ?? []).filter((f) => f.allowed !== false && !f.flags?.includes("\\Noselect"));
      const names = new Set(all.map((f) => f.name));
      const standardFolderIds = ["inbox"];
      if (all.some((f) => f.special === "sent")) standardFolderIds.push("sent");
      if (all.some((f) => f.special === "drafts")) standardFolderIds.push("drafts");
      if (names.has(archiveFolder)) standardFolderIds.push("archive");
      const folders: MailFolderRef[] = all
        .filter((f) => !STANDARD_FOLDER_NAMES.has(f.name) && f.name !== archiveFolder && !f.special)
        .map((f) => ({ id: f.name, name: f.name }));
      return { standardFolderIds, folders };
    },

    createFolder: notExposed,
    deleteFolder: notExposed,

    async unreadCount() {
      // Sjednocená schránka sčítá obě; když jedna neodpoví (Gmail vypnutý), počítá se druhá.
      const boxes = mailbox === "all" ? [undefined, "gmail"] : [schranka];
      const results = await Promise.allSettled(boxes.map((s) => call<WireStats>("mail_stats", compact({ schranka: s }))));
      return results.reduce((sum, r) => sum + (r.status === "fulfilled" ? (r.value.neprectene ?? 0) : 0), 0);
    },

    async send(request: MailSendRequest): Promise<MailSendResult> {
      if (request.attachments?.length) {
        throw new EngineError("attachment_by_link", cs.posta.engine.prilohaOdkazem);
      }
      const { attachments: _ignored, ...rest } = request;
      return client.sendWithUploads(rest);
    },

    async sendWithUploads(request): Promise<EngineSendResult> {
      // Odeslání je vždy za potvrzením uživatele v aplikaci (pravidlo 8);
      // engine chce potvrzení výslovně, a to řetězcem.
      const data = await call<WireSend>("mail_send", { ...sendPayload(request), potvrzeni: "ODESLAT" });
      return { sentVia: "engine", total: request.to.length, warnings: data.varovani ?? [] };
    },

    async saveDraft(request) {
      // Koncept bere totéž co odeslání včetně příloh odkazem — do Konceptů je skládá engine.
      const data = await call<WireSend>("mail_draft", sendPayload(request));
      return { ref: data.ref ?? "" };
    },

    async forward(request): Promise<EngineForwardResult> {
      // `mail_preposlat` nezná `schranka` ani `odeslat_z`: čte i odesílá jen ÚVN (22. 9.).
      if (schrankaOf(request.forwardOf) === "gmail") {
        throw new EngineError("not_exposed", cs.posta.engine.preposlaniJenUvn);
      }
      // REST odmítá neznámé parametry — jde jen to, co nástroj má.
      const data = await call<WireForward>("mail_preposlat", {
        ref: request.forwardOf,
        komu: request.to,
        telo: request.isHtml ? htmlToPlainText(request.body) : request.body,
        zpusob: "cast",
        // Odeslání je vždy za potvrzením uživatele v aplikaci (pravidlo 8).
        potvrzeni: "ODESLAT",
      });
      return {
        sentVia: "engine",
        total: request.to.length,
        warnings: data.varovani ?? [],
        attachments: data.prilohy ?? [],
        flagged: data.priznak_nastaven === true,
      };
    },

    async upload(file, name) {
      const form = new FormData();
      form.append("soubor", file, name ?? (file instanceof File ? file.name : "priloha"));
      const data = await engine.callMultipart<WireUpload>("upload", form);
      return { uploadId: data.upload_id, name: data.nazev, size: data.velikost, mimeType: data.typ };
    },

    async thread(threadId) {
      // `mail_thread` nezná `schranka`: čte index podle klíče vlákna, a od indexu Gmailu
      // (ÚKOL 44.3, 21. 9.) jsou v něm obě schránky (`gmail:<X-GM-THRID>`).
      if (!threadId) return [];
      const data = await call<WireThread>("mail_thread", { vlakno: threadId, limit: 40 });
      const rows = data.zpravy ?? [];
      for (const m of rows) if (m.schranka) known.set(m.ref, m.schranka);
      return rows.map((m) => ({ ...toListMessage(m), body: m.telo ?? m.uryvek ?? "" }));
    },

    async findByContacts(params: MailContactSearchParams): Promise<MailContactSearchResult> {
      // `odesilatel` bere jednu adresu; víc adres = víc dotazů, sloučené podle ref.
      const limit = params.maxResults ?? 20;
      const seen = new Map<string, WireMessage>();
      for (const email of params.contactEmails.slice(0, 5)) {
        for (const m of await search({ odesilatel: email, limit })) seen.set(m.ref, m);
      }
      const merged = [...seen.values()].sort((a, b) => b.datum.localeCompare(a.datum)).slice(0, limit);
      return { emails: merged.map(toListMessage), contactEmails: params.contactEmails };
    },
  };

  return client;
}

/** Klient z env a session Supabase — pro obrazovky, které nepotřebují vlastní volby. */
export function createEngineMailboxFromEnv(
  getToken: EngineMailboxOptions["getToken"],
  mailbox: EngineMailboxId = "all",
): EngineMailbox | null {
  const baseUrl = import.meta.env.VITE_ENGINE_URL?.trim();
  if (!baseUrl) return null;
  return createEngineMailbox({ baseUrl, mailbox, getToken });
}

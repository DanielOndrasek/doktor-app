import { cs } from "@/lib/i18n/cs";
import type { ComposeSendRequest } from "@/lib/email/compose";
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
 * `{ok:false, duvod}` při odmítnutí). Co K1 nezadává — názvy polí seznamu
 * zpráv a stránkování — je v `Wire*` typech níže na jednom místě, aby se
 * s K2.3 doladilo jedním zásahem.
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

/** Co `send` / `saveDraft` navíc proti `ComposeSendRequest`: „Odeslat z" a podpis. */
export interface EngineSendRequest extends ComposeSendRequest {
  /** Adresa schránky, ze které se odesílá (`odeslat_z`). */
  sendFrom?: string;
  /** `podpis_id` — podpis skládá engine, tělo ho nenese dvakrát. */
  signatureId?: string;
}

export interface EngineUploadResult {
  uploadId: string;
  name: string;
  size: number;
  mimeType: string;
}

/** `MailboxClient` + operace, které kontrakt z CRM nemá a plán je přidává (4.1). */
export interface EngineMailbox extends MailboxClient {
  readonly provider: "engine";
  /** Přesun s výsledkem; `moveToFolder` z kontraktu ho volá a výsledek zahodí. */
  moveMessage(messageId: string, folderId: string): Promise<EngineMoveResult>;
  /** Odeslání s přílohami odkazem (`uploadIds` → `prilohy`). */
  sendWithUploads(request: EngineSendRequest): Promise<MailSendResult>;
  /** Koncept s přílohami do Konceptů (`mail_draft`). */
  saveDraft(request: EngineSendRequest): Promise<{ ref: string }>;
  /** Nahrání přílohy multipartem; vrací `upload_id` (pravidlo 2). */
  upload(file: File | Blob, name?: string): Promise<EngineUploadResult>;
  /**
   * Krátkodobý podepsaný odkaz na přílohu (`mail_priloha_odkaz`) — prohlížeč
   * ho otevře napřímo, stream ze skladu, ne base64. Bearer JWT se do `<a href>`
   * nedá, proto odkaz podepisuje engine.
   */
  attachmentLink(messageId: string, attachment: MailAttachmentMeta): Promise<string>;
}

/* ── Drátové tvary ─────────────────────────────────────────────────────────
 * Pojmenování podle enginu (česky, `snake_case`). Pole, která K1 nezadává,
 * jsou tady jen jednou; s K2.3 se upraví tady, ne v obrazovkách.
 * ──────────────────────────────────────────────────────────────────────── */

interface WireMessage {
  ref: string;
  vlakno: string;
  od: string;
  komu: string;
  predmet: string;
  datum: string;
  /** Epocha v ms. */
  datum_ms: number;
  ukazka: string;
  priznaky: string[];
  schranka?: string;
}

interface WireSearchResult extends WireEnvelope {
  zpravy: WireMessage[];
  dalsi_strana: string | null;
  celkem: number;
}

interface WireAttachment {
  index: number;
  nazev: string;
  typ: string;
  velikost: number;
}

interface WireMessageDetail extends WireEnvelope {
  zprava: WireMessage & {
    message_id: string;
    telo_html?: string;
    telo_text?: string;
    prilohy: WireAttachment[];
  };
}

interface WireFolders extends WireEnvelope {
  standardni: string[];
  vlastni: { id: string; nazev: string }[];
}

interface WireMove extends WireEnvelope {
  novy_ref: string;
  slozka: string;
  message_id: string;
}

interface WireSend extends WireEnvelope {
  ref?: string;
  odeslano?: number;
}

interface WireStats extends WireEnvelope {
  neprectene: number;
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

function engineFolder(folderId: string, archiveFolder: string): string | undefined {
  if (folderId === "all") return undefined;
  if (folderId === "archive") return archiveFolder;
  return STANDARD_FOLDER_TO_ENGINE[folderId] ?? folderId;
}

function toListMessage(m: WireMessage): MailListMessage {
  return {
    id: m.ref,
    threadId: m.vlakno,
    snippet: m.ukazka ?? "",
    from: m.od,
    to: m.komu,
    subject: m.predmet ?? "",
    date: m.datum,
    internalDate: String(m.datum_ms ?? Date.parse(m.datum) ?? 0),
    labelIds: m.priznaky ?? [],
  };
}

function toAttachmentMeta(a: WireAttachment): MailAttachmentMeta {
  return { filename: a.nazev, mimeType: a.typ, size: a.velikost, attachmentId: String(a.index) };
}

export function createEngineMailbox(options: EngineMailboxOptions): EngineMailbox {
  const mailbox = options.mailbox ?? "all";
  const archiveFolder = options.archiveFolder ?? "_Triage/Vyřízeno";

  const schranky = mailbox === "all" ? undefined : [mailbox];

  const engine: EngineClient = createEngineClient({
    baseUrl: options.baseUrl,
    getToken: options.getToken,
    fetchImpl: options.fetchImpl,
  });
  /** `POST /api/v1/{tool}` s JSON tělem — tvar 1 : 1 s nástrojem enginu. */
  const call = engine.call;

  const notExposed = async (): Promise<never> => {
    throw new EngineError("not_exposed", cs.posta.engine.nevystaveno);
  };

  const sendPayload = (request: EngineSendRequest) => ({
    schranka: mailbox === "all" ? undefined : mailbox,
    odeslat_z: request.sendFrom,
    komu: request.to,
    kopie: request.cc ?? [],
    skryta_kopie: request.bcc ?? [],
    predmet: request.subject,
    telo: request.body,
    html: request.isHtml,
    vlakno: request.threadId,
    in_reply_to: request.inReplyTo,
    references: request.references,
    podpis_id: request.signatureId,
    prilohy: (request.uploadIds ?? []).map((id) => ({ zdroj: "upload", id })),
    // Odeslání je vždy za potvrzením uživatele v aplikaci (pravidlo 8);
    // engine chce potvrzení explicitně, ne implicitně.
    potvrzeni: true,
  });

  async function moveMessage(messageId: string, folderId: string): Promise<EngineMoveResult> {
    const data = await call<WireMove>("mail_move", {
      ref: messageId,
      slozka: engineFolder(folderId, archiveFolder),
    });
    return { newRef: data.novy_ref, folder: data.slozka, messageId: data.message_id };
  }

  async function listMessages(params: MailListParams): Promise<MailListPage> {
    const data = await call<WireSearchResult>("mail_search", {
      schranky,
      slozka: engineFolder(params.folderId, archiveFolder),
      dotaz: params.search?.trim() || undefined,
      jen_neprectene: params.unreadOnly || undefined,
      strana: params.pageToken ?? undefined,
      limit: params.maxResults,
    });
    return {
      emails: (data.zpravy ?? []).map(toListMessage),
      nextPageToken: data.dalsi_strana ?? null,
      resultSizeEstimate: data.celkem ?? 0,
    };
  }

  const client: EngineMailbox = {
    provider: "engine",

    listMessages,

    async getMessage(messageId): Promise<MailMessageDetail> {
      // HTML tělo sanitizuje server (ÚKOL 36); `oboji` dá i text pro čtečku.
      const data = await call<WireMessageDetail>("mail_get", { ref: messageId, format: "oboji" });
      const z = data.zprava;
      const html = z.telo_html?.trim();
      return {
        ...toListMessage(z),
        messageId: z.message_id,
        body: html || z.telo_text || "",
        bodyType: html ? "html" : "text",
        attachments: (z.prilohy ?? []).map(toAttachmentMeta),
      };
    },

    async getAttachment(): Promise<string> {
      throw new EngineError("attachment_by_link", cs.posta.engine.prilohaOdkazem);
    },

    async attachmentLink(messageId, attachment) {
      const data = await call<WireAttachmentLink>("mail_priloha_odkaz", {
        ref: messageId,
        index: Number(attachment.attachmentId),
      });
      if (!data.url) throw new EngineError("bad_response", cs.engine.neplatnaOdpoved);
      return data.url;
    },

    async setRead(messageId, read) {
      await call("mail_flag", { ref: messageId, priznak: "\\Seen", nastavit: read });
    },

    async setStarred(messageId, starred) {
      await call("mail_flag", { ref: messageId, priznak: "\\Flagged", nastavit: starred });
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
      const data = await call<WireFolders>("mail_folders", { schranky });
      const folders: MailFolderRef[] = (data.vlastni ?? []).map((f) => ({ id: f.id, name: f.nazev }));
      return { standardFolderIds: data.standardni?.length ? data.standardni : ["inbox"], folders };
    },

    createFolder: notExposed,
    deleteFolder: notExposed,

    async unreadCount() {
      const data = await call<WireStats>("mail_stats", { schranky });
      return data.neprectene ?? 0;
    },

    async send(request: MailSendRequest): Promise<MailSendResult> {
      if (request.attachments?.length) {
        throw new EngineError("attachment_by_link", cs.posta.engine.prilohaOdkazem);
      }
      const { attachments: _ignored, ...rest } = request;
      return client.sendWithUploads(rest);
    },

    async sendWithUploads(request): Promise<MailSendResult> {
      const data = await call<WireSend>("mail_send", sendPayload(request));
      return { sentVia: "engine", total: data.odeslano ?? request.to.length };
    },

    async saveDraft(request) {
      const data = await call<WireSend>("mail_draft", sendPayload(request));
      if (!data.ref) throw new EngineError("bad_response", cs.engine.neplatnaOdpoved);
      return { ref: data.ref };
    },

    async upload(file, name) {
      const form = new FormData();
      form.append("soubor", file, name ?? (file instanceof File ? file.name : "priloha"));
      const data = await engine.callMultipart<WireUpload>("upload", form);
      return { uploadId: data.upload_id, name: data.nazev, size: data.velikost, mimeType: data.typ };
    },

    async findByContacts(params: MailContactSearchParams): Promise<MailContactSearchResult> {
      // Index podle adres, okamžité, včetně archivů (plán 4.1).
      const data = await call<WireSearchResult>("mail_search", {
        schranky,
        adresy: params.contactEmails,
        limit: params.maxResults,
      });
      return { emails: (data.zpravy ?? []).map(toListMessage), contactEmails: params.contactEmails };
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

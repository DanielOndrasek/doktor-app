/**
 * Kontrakt e-mailové schránky nezávislý na poskytovateli.
 *
 * Tvary vycházejí z toho, co dodnes vracely funkce `gmail-*`, aby nové
 * rozhraní nevynutilo přepis obrazovek, které s nimi pracují. Gmail i IMAP
 * je plní stejně; rozdíly mezi protokoly (štítky vs. složky, opakovaně
 * použitelné id vs. UID) řeší implementace, ne volající.
 *
 * Tohle je ZÁVAZNÁ verze kontraktu.
 *
 * ── Původ a odchylky ────────────────────────────────────────────────────
 * Převzato doslova z vividbooks CRM (`crm/src/lib/email/types.ts`, commit
 * `831f9ae6`) včetně jmen metod — viz pravidlo 3 v
 * `docs/prevzeti-z-vividbooks.md`. Na kontraktu stojí `engineMailbox.ts`,
 * naše třetí implementace.
 *
 * Tři odchylky, každá vynucená pravidlem z `CLAUDE.md`:
 *
 * 1. `provider` a `sentVia` znají navíc `"engine"`. Bez toho by se třetí
 *    implementace do kontraktu nevešla.
 * 2. Pole `dealId` (v `MailSendRequest` a `MailContactSearchParams`) tady
 *    není. Je to zeď obchodu, tedy schéma `crm`, které se nepřebírá.
 * 3. `trashMessage`, `deleteFolder` a `createFolder` v kontraktu zůstávají
 *    (kopie je doslovná), ale naše implementace je nevystaví — pravidlo 3
 *    v `CLAUDE.md`: nic se nemaže.
 *
 * Pozor na `MailAttachmentUpload` a `getAttachment`: base64 v kontraktu je
 * dědictví Gmail API. Naše implementace přílohy předává odkazem (pravidlo 2
 * v `CLAUDE.md`), nahrání jde multipartem na engine a vrací `upload_id`.
 * ────────────────────────────────────────────────────────────────────────
 */

/** Položka seznamu zpráv. */
export interface MailListMessage {
  /** Neprůhledné id zprávy. U Gmailu id zprávy, u IMAP složka + UID. */
  id: string;
  /** Identifikátor konverzace pro seskupení zpráv do vlákna. */
  threadId: string;
  snippet: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  /** Epocha v milisekundách jako řetězec — formát, na kterém stojí řazení. */
  internalDate: string;
  /** Stavové značky zprávy: `UNREAD`, `STARRED`, `INBOX`, `SENT`, … */
  labelIds: string[];
}

export interface MailAttachmentMeta {
  filename: string;
  mimeType: string;
  size: number;
  /** Neprůhledný odkaz na přílohu v rámci zprávy. */
  attachmentId: string;
}

export interface MailMessageDetail {
  id: string;
  threadId: string;
  from: string;
  to: string;
  subject: string;
  date: string;
  /** Hlavička `Message-ID`, potřebná pro `In-Reply-To` při odpovědi. */
  messageId: string;
  internalDate: string;
  labelIds: string[];
  /** Tělo už jako HTML; inline obrázky jsou vložené jako `data:` URI. */
  body: string;
  bodyType: "html" | "text";
  attachments: MailAttachmentMeta[];
}

export interface MailListPage {
  emails: MailListMessage[];
  /** Neprůhledný token další stránky, `null` když další nejsou. */
  nextPageToken: string | null;
  resultSizeEstimate: number;
}

export interface MailListParams {
  /**
   * Id složky z navigace: `inbox`, `sent`, … nebo vlastní složka.
   * `all` znamená „nezužovat na složku" — používá ho vyhledávání.
   */
  folderId: string;
  search?: string;
  unreadOnly?: boolean;
  pageToken?: string | null;
  maxResults?: number;
  /** Doktor navíc proti CRM: „Hledat" bez AI (plán K0.4) — osoba, období, směr, příloha. */
  filter?: MailSearchFilter;
}

/**
 * Přímý dotaz do indexu enginu bez AI (plán K0.4, kontrolní seznam „Zeptat se").
 * Engine: `odesilatel`, `prijemce` (+ `vcetne_kopie`), `od_data`, `do_data`, `smer`, `ma_prilohu`.
 */
export interface MailSearchFilter {
  /** Odesílatel — část adresy nebo jména. */
  from?: string;
  /** Adresát v Komu nebo v kopii. */
  to?: string;
  /** `YYYY-MM-DD` */
  dateFrom?: string;
  dateTo?: string;
  direction?: "sent" | "received";
  /** `true` = jen zprávy s přílohou; jinak bez filtru. */
  hasAttachment?: boolean;
}

/** Vlastní složka (Gmail štítek / IMAP schránka). */
export interface MailFolderRef {
  id: string;
  name: string;
}

/**
 * Rozložení schránky. Standardní složky nelze předpokládat — IMAP server
 * nemusí mít koncepty, spam ani archiv a navigace je pak nesmí nabízet.
 */
export interface MailFolderLayout {
  standardFolderIds: string[];
  folders: MailFolderRef[];
}

export interface MailAttachmentUpload {
  name: string;
  type: string;
  /** Obsah přílohy v base64. */
  data: string;
}

export interface MailSendRequest {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  /** Tělo zprávy; `isHtml` říká, jestli jde o HTML, nebo prostý text. */
  body: string;
  isHtml: boolean;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  attachments?: MailAttachmentUpload[];
}

export interface MailSendResult {
  sentVia: "gmail" | "imap" | "resend" | "engine";
  total: number;
}

/** Zprávy vyměněné s konkrétními kontakty — podklad pro kartu kontaktu. */
export interface MailContactSearchParams {
  contactEmails: string[];
  maxResults?: number;
}

export interface MailContactSearchResult {
  emails: MailListMessage[];
  contactEmails: string[];
}

/**
 * Operace, které obrazovky nad schránkou potřebují. Implementace jsou
 * zaměnitelné; volající nesmí poznat, která běží.
 */
export interface MailboxClient {
  readonly provider: "gmail" | "imap" | "engine";

  listMessages(params: MailListParams): Promise<MailListPage>;
  getMessage(messageId: string): Promise<MailMessageDetail>;
  /** Obsah přílohy v base64url, stejně jako ho vrací Gmail API. */
  getAttachment(messageId: string, attachmentId: string): Promise<string>;

  setRead(messageId: string, read: boolean): Promise<void>;
  setStarred(messageId: string, starred: boolean): Promise<void>;
  trashMessage(messageId: string): Promise<void>;
  moveToFolder(messageId: string, folderId: string): Promise<void>;
  /** Odklizení z doručené pošty: v Gmailu odebrání štítku, v IMAP přesun. */
  archiveMessage(messageId: string): Promise<void>;

  listFolders(): Promise<MailFolderLayout>;
  createFolder(name: string): Promise<MailFolderRef>;
  deleteFolder(folderId: string): Promise<void>;

  unreadCount(): Promise<number>;
  send(request: MailSendRequest): Promise<MailSendResult>;
  findByContacts(params: MailContactSearchParams): Promise<MailContactSearchResult>;
}

/** Složky, které umí každá implementace. */
export const STANDARD_FOLDER_IDS = [
  "inbox",
  "starred",
  "important",
  "sent",
  "drafts",
  "spam",
  "trash",
  "archive",
] as const;

export type StandardFolderId = (typeof STANDARD_FOLDER_IDS)[number];

import type { MailSendRequest } from "@/lib/email/types";

/**
 * Tvary, na kterých stojí okno psaní zprávy. Nejsou součástí kontraktu
 * `MailboxClient` — ten je doslovná kopie z CRM. Tohle je hranice mezi
 * `EmailCompose` a tím, kdo ji používá.
 */

/**
 * Příloha nahraná na engine. **Nikdy base64** (pravidlo 2 v `CLAUDE.md`):
 * soubor jde multipartem na engine a ten vrátí `uploadId`, kterým se příloha
 * k odeslání připojí odkazem.
 */
export interface AttachmentUploadRef {
  uploadId: string;
  name: string;
  size: number;
  mimeType: string;
}

/**
 * Co `EmailCompose` předává k odeslání. Proti `MailSendRequest` je bez
 * `attachments` — místo base64 obsahu nese `uploadIds`.
 *
 * Jak se `uploadIds` dostanou do enginu, rozhodne `engineMailbox.ts`; okno
 * psaní o tom neví a bajty přílohy nikdy nedrží.
 */
export interface ComposeSendRequest extends Omit<MailSendRequest, "attachments"> {
  uploadIds?: string[];
  /** Adresa schránky, ze které se odesílá („Odeslat z", pravidlo 8) — engine ji dostane jako `odeslat_z`. */
  sendFrom?: string;
  /**
   * Přeposlání (`mail_preposlat`): ref původní zprávy. Engine k poznámce v `body`
   * připojí původní hlavičky, text a **původní přílohy** a na zprávě nastaví
   * `$Forwarded`; předmět „Fwd: …" skládá sám. Aplikace přílohy nikdy nedrží.
   */
  forwardOf?: string;
  /**
   * Přílohy z jiné zprávy (K3.4): engine je vezme z IMAPu sám
   * (`{zdroj: "zprava", ref, index}`), přes prohlížeč nikdy neprojdou (pravidlo 2).
   */
  messageAttachments?: { ref: string; index: number }[];
}

/** Příloha původní zprávy, kterou jde jedním kliknutím přiložit k odpovědi (K3.4). */
export interface ComposeSourceAttachment {
  ref: string;
  index: number;
  name: string;
  size: number;
}

/** Co okno psaní potřebuje vědět o přeposílané zprávě: ref a názvy příloh, které engine překopíruje. */
export interface ComposeForwardContext {
  ref: string;
  attachments: { name: string; size: number }[];
}

/** Schránka v nabídce „Odeslat z" okna psaní. */
export interface EmailSenderOption {
  address: string;
  label: string;
}

/** Návrh adresáta v našeptávači (kontakt, účastník vlákna). */
export interface EmailRecipientSuggestion {
  email: string;
  label: string;
  /** Skupina v našeptávači, např. „Z vlákna" nebo „Kontakty". */
  group?: string;
}

/** Šablona zprávy. Kde se ukládá, řeší K2 — sem přichází hotová. */
export interface EmailTemplate {
  id: string;
  name: string;
  subject: string | null;
  bodyHtml: string | null;
  /** Volitelné zařazení do skupiny v seznamu šablon. */
  folder?: string | null;
  /** Kolikrát byla použita; řadí seznam. */
  useCount?: number | null;
}

/** Nová nebo upravená šablona z dialogu šablon. */
export type EmailTemplateDraft = Pick<EmailTemplate, "name" | "subject" | "bodyHtml" | "folder">;

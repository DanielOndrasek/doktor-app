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

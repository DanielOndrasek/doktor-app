import DOMPurify, { type Config as DOMPurifyConfig } from "dompurify";

/**
 * Práce s HTML podpisu: sanitizace, prostý text → HTML, hodnota z DB → fragment
 * do těla zprávy.
 *
 * Převzato z `crm/src/lib/emailSignature.ts` (vividbooks CRM, `831f9ae6`)
 * beze změny chování. V CRM podpis žil v `profiles.email_signature`;
 * v Doktorovi je tabulka `podpisy` (sloupce `html`, `text`), ale tvar
 * hodnoty je stejný — HTML nebo prostý text.
 */

/** Odstraní `<meta charset>` apod. z podpisu z editoru (stejně jako Gmail composer). */
export function stripEmailSignatureMeta(html: string): string {
  return html.replace(/<meta[^>]*>/gi, "");
}

/** Slabá heuristika: je řetězec spíš HTML fragment než prostý text? */
export function looksLikeEmailSignatureHtml(s: string): boolean {
  return /<\/?[a-z][\s\S]*>/i.test(s);
}

/**
 * Sanitizace HTML podpisu (CASA H3). Podpisy potřebují tabulkové HTML, inline
 * styly a obrázky (vkládají se z Outlooku/Gmailu), proto standardní HTML profil,
 * ale bez aktivního obsahu — stejný přístup jako EMAIL_SANITIZE v `lib/email/html.ts`.
 * DOMPurify navíc defaultně odstraní event handlery (onerror…) a javascript: URL.
 */
const SIGNATURE_SANITIZE: DOMPurifyConfig = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "base", "meta", "link"],
  FORBID_ATTR: ["srcdoc", "formaction"],
  ALLOW_DATA_ATTR: false,
};

/** Vrátí HTML podpisu zbavené aktivního obsahu (script, event handlery, javascript: URL…). */
export function sanitizeEmailSignatureHtml(html: string): string {
  return String(DOMPurify.sanitize(html || "", SIGNATURE_SANITIZE));
}

/** Escapuje prostý text a `\n` → `<br>` (shodně s tělem mailu od asistenta). */
export function plainEmailSignatureToHtml(plain: string): string {
  return plain
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\r?\n/g, "<br>");
}

/**
 * Z uložené hodnoty (`podpisy.html`) vytvoří HTML fragment pro vložení do těla mailu.
 * Prostý text zůstane v DB „jak je“; při odeslání se převede na bezpečné HTML.
 */
export function storedEmailSignatureToHtmlFragment(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = stripEmailSignatureMeta(raw).trim();
  if (!trimmed) return null;
  if (looksLikeEmailSignatureHtml(trimmed)) {
    const sanitized = sanitizeEmailSignatureHtml(trimmed).trim();
    return sanitized || null;
  }
  return plainEmailSignatureToHtml(trimmed);
}

/**
 * Podpis do okna e-mailu (Dan 20. 9. 2026: „podpis ať je v okně e-mailu jako text, ne napevno pod ním“).
 * Editor e-mailu umí tabulky i rozměry obrázků, takže podpis jde do těla tak, jak je – jen projde sanitizací.
 */
export function emailSignatureToEditorHtml(raw: string | null | undefined): string | null {
  return storedEmailSignatureToHtmlFragment(raw);
}

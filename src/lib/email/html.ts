import DOMPurify, { type Config as DOMPurifyConfig } from "dompurify";

/**
 * Práce s HTML e-mailu: hlavička `From`, iniciály, barva avataru a sanitizace
 * těla před vložením do iframe.
 *
 * Převzato z `crm/src/lib/emailWallUtils.ts` (vividbooks CRM, commit
 * `831f9ae6`). Jméno „wall" bylo zavádějící — se zdí obchodu soubor nemá nic
 * společného, je to obecná práce s e-mailovým HTML. Přebralo se jen to, co
 * potřebují komponenty pošty; zbytek (`postProcessEmailDocument`,
 * `buildEmailIframeSrcDoc`, `gmailThreadDeeplink`, `groupGmailByThread`,
 * `attachmentVisualKind`, `openNativeMailClient`, `formatGmail*Date`) zůstal
 * ve zdroji a přinese se, až ho některá obrazovka bude chtít.
 */

/** Parsování hlavičky From: „Jméno“ <email> nebo jen email */
export function parseEmailFromHeader(from: string): { displayName: string; email: string } {
  const raw = (from || "").trim();
  if (!raw) return { displayName: "", email: "" };
  const quoted = raw.match(/^"([^"]*)"\s*<([^>]+)>$/);
  if (quoted) {
    const email = quoted[2].trim();
    const name = quoted[1].trim();
    return { displayName: name || email.split("@")[0] || email, email };
  }
  const angle = raw.match(/^(?:([^<]+?)\s*)?<([^>]+)>$/);
  if (angle) {
    const email = angle[2].trim();
    const name = (angle[1] || "").trim().replace(/^"|"$/g, "");
    return { displayName: name || email.split("@")[0] || email, email };
  }
  if (raw.includes("@")) return { displayName: raw.split("@")[0] || raw, email: raw };
  return { displayName: raw, email: "" };
}

export function emailInitials(displayName: string, email: string): string {
  const name = (displayName || "").trim();
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    const a = parts[0][0];
    const b = parts[parts.length - 1][0];
    if (a && b) return (a + b).toUpperCase();
  }
  if (parts.length === 1 && parts[0].length >= 2) return parts[0].slice(0, 2).toUpperCase();
  const local = (email || "").split("@")[0] || "?";
  return local.slice(0, 2).toUpperCase();
}

/**
 * Deterministická paleta barev pro avatar podle jména nebo adresy. Jemné
 * pozadí + sytější text, aby to fungovalo ve světlém i tmavém režimu.
 *
 * Nahrazuje `hsl(hash % 360, 55%, 45%)`, kterým si avatar počítal `EmailInbox`
 * i `EmailListItem` každý po svém — náhodný odstín uměl skončit na barvě,
 * která se s tokeny Doktora bije.
 */
const AVATAR_PALETTE = [
  "bg-sky-500/15 text-sky-700 dark:text-sky-300",
  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
  "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  "bg-rose-500/15 text-rose-700 dark:text-rose-300",
  "bg-violet-500/15 text-violet-700 dark:text-violet-300",
  "bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
  "bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
  "bg-teal-500/15 text-teal-700 dark:text-teal-300",
];

export function avatarColorClass(seed: string): string {
  const s = (seed || "").toLowerCase().trim();
  if (!s) return AVATAR_PALETTE[0];
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

/** Bezpečné vložení HTML těla do iframe (základní ošetření) */
export function escapeForHtmlSrcDoc(html: string): string {
  return (html || "").replace(/<\/script>/gi, "<\\/script>");
}

/**
 * Sanitizace příchozího e-mailového HTML (DOMPurify) před vložením do iframe
 * srcDoc. E-maily potřebují tabulky, inline styly a obrázky — povolujeme tedy
 * standardní HTML profil, ale zakazujeme aktivní obsah (script, event handlery,
 * javascript: URL, iframe/object/embed, formuláře). Obrana proti XSS z cizího
 * e-mailu i tam, kde sandbox iframu dovoluje `allow-same-origin`.
 */
const EMAIL_SANITIZE: DOMPurifyConfig = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["script", "iframe", "object", "embed", "form", "input", "button", "base", "meta", "link"],
  FORBID_ATTR: ["srcdoc", "formaction"],
  ALLOW_DATA_ATTR: false,
  ADD_TAGS: ["style"],
};

export function sanitizeEmailHtml(html: string): string {
  return String(DOMPurify.sanitize(html || "", EMAIL_SANITIZE));
}

/** Vytáhne e-mailové adresy z hlavičky „Jméno <adresa>, …“. */
export function extractEmails(header: string | null | undefined): string[] {
  if (!header) return [];
  const found = header.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return Array.from(new Set(found.map((e) => e.toLowerCase())));
}

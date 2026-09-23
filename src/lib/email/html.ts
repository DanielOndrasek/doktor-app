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

const BLOCK_TAGS = new Set(["P", "DIV", "BLOCKQUOTE", "TABLE", "HR", "UL", "OL", "PRE", "SECTION", "ARTICLE"]);

/** Začátek citované nebo přeposlané části podle textu prvního řádku bloku (Outlook, Apple Mail, Gmail, Thunderbird, Seznam). */
const QUOTE_START = /^\s*(?:-{2,}\s*(?:Původní|Puvodni|Přeposlaná|Preposlana|Original|Forwarded)\b|(?:From|Od|Von|De)\s*:\s*\S.{0,300}?\s(?:Sent|Odesláno|Date|Datum|Gesendet|To|Komu)\s*:|(?:Dne|On)\s.{4,80}\s(?:napsal|wrote)\b)/i;

function isEmptyBlock(el: Element): boolean {
  if (el.querySelector("img, table, hr, iframe, video, audio, svg")) return false;
  return (el.textContent ?? "").replace(/[\s\u00a0\u200b]+/g, "") === "";
}

/**
 * Úprava už sanitizovaného HTML, ať zpráva vypadá jako v Mailu nebo Gmailu:
 * 1. prázdné odstavce (`<p>&nbsp;</p>`, kterými Outlook dělá mezery) se vyhodí —
 *    mezeru mezi odstavci dává CSS iframu, jinak jsou v textu díry přes dva řádky;
 * 2. citovaná nebo přeposlaná část (hlavička From/Sent, „Původní e-mail",
 *    `blockquote`, `.gmail_quote`, Outlook `#divRplyFwdMsg`) se sbalí do
 *    `<details>` s popiskem `quoteLabel`; rozbalí se kliknutím, bez skriptu.
 * Vstup musí být výstup `sanitizeEmailHtml` — tady se nic nečistí.
 */
export function tidyEmailHtml(html: string, quoteLabel: string): string {
  const doc = new DOMParser().parseFromString(`<body>${html || ""}</body>`, "text/html");
  const body = doc.body;

  for (const el of Array.from(body.querySelectorAll("p, div"))) {
    // Jen listové bloky; obal, ve kterém je něco vidět, zůstává.
    if (el.children.length && Array.from(el.children).some((c) => BLOCK_TAGS.has(c.tagName))) continue;
    if (isEmptyBlock(el)) el.remove();
  }

  const quoteStart = findQuoteStart(body);
  if (quoteStart) {
    const details = doc.createElement("details");
    details.className = "citace";
    const summary = doc.createElement("summary");
    summary.textContent = quoteLabel;
    details.appendChild(summary);
    const parent = quoteStart.parentElement ?? body;
    let node: ChildNode | null = quoteStart;
    const moved: ChildNode[] = [];
    while (node) {
      moved.push(node);
      node = node.nextSibling;
    }
    parent.insertBefore(details, quoteStart);
    for (const n of moved) details.appendChild(n);
  }
  return body.innerHTML;
}

function findQuoteStart(body: HTMLElement): Element | null {
  const explicit = body.querySelector("#divRplyFwdMsg, .gmail_quote, blockquote[type='cite'], .moz-cite-prefix, .yahoo_quoted");
  if (explicit) return outermostBlock(explicit, body);
  for (const el of Array.from(body.querySelectorAll("p, div, blockquote, hr"))) {
    if (el.tagName === "HR") continue;
    const text = blockText(el);
    if (text.length < 4) continue;
    if (QUOTE_START.test(text)) return outermostBlock(el, body);
  }
  return null;
}

/**
 * Text bloku pro detekci citace: `<br>` a vnořené bloky se počítají jako mezera
 * (Outlook píše `From: … <br>Sent: …`, kde by `textContent` slepil řádky bez mezery
 * nebo je rozdělil zalomením, které regex nepřekročí), všechna bílá místa se srazí.
 */
function blockText(el: Element): string {
  const parts: string[] = [];
  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? "");
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const tag = (node as Element).tagName;
    if (tag === "BR" || BLOCK_TAGS.has(tag) || tag === "TR" || tag === "LI") parts.push(" ");
    for (const child of Array.from(node.childNodes)) walk(child);
    if (BLOCK_TAGS.has(tag) || tag === "TR" || tag === "LI") parts.push(" ");
  };
  walk(el);
  return parts.join("").replace(/[\s\u00a0\u200b]+/g, " ").trim();
}

/** Blok se sbalí i s obalem (Outlook dává hlavičku do `<div style="border-top…">`), ale ne s celým tělem. */
function outermostBlock(el: Element, body: HTMLElement): Element {
  let current = el;
  while (current.parentElement && current.parentElement !== body) {
    const parent = current.parentElement;
    // Obal, jehož viditelný text začíná citací, patří k ní; jinak by se sbalil i text před ní.
    const before = (parent.textContent ?? "").replace(/[\s\u00a0]+/g, " ").trim();
    const own = (current.textContent ?? "").replace(/[\s\u00a0]+/g, " ").trim();
    if (!before.startsWith(own.slice(0, 40))) break;
    current = parent;
  }
  return current;
}

function escapeHtml(text: string): string {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/**
 * Prosté textové tělo (engine `telo`, když zpráva HTML část nemá) → HTML do
 * iframu: zalomení řádků zůstanou, odkazy jsou klikací, nic dalšího se
 * neinterpretuje. Bez tohohle se text v iframu slije do jednoho odstavce.
 */
export function textToHtml(text: string): string {
  const linked = escapeHtml(text || "").replace(
    /(https?:\/\/[^\s<]+[^\s<.,;:!?)\]"'])/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>',
  );
  return `<div style="white-space:pre-wrap">${linked}</div>`;
}

/**
 * Prostý text návrhu odpovědi (`navrh_telo` z běhu) → HTML pro editor psaní:
 * odstavce z prázdných řádků, `<br>` uvnitř odstavce. Nic se neinterpretuje.
 */
export function plainTextToEditorHtml(text: string): string {
  return (text || "")
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n{2,}/)
    .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br>")}</p>`)
    .join("");
}

/**
 * HTML z editoru → prostý text: zalomení za blokovými prvky, bez značek.
 * Pro nástroje enginu, které berou jen text (`mail_preposlat.telo`, `podpisy.text`).
 */
export function htmlToPlainText(html: string): string {
  const withBreaks = (html || "").replace(/<(br|\/p|\/div|\/tr|\/li|\/h[1-6])[^>]*>/gi, "$&\n");
  const doc = new DOMParser().parseFromString(withBreaks, "text/html");
  return (doc.body.textContent ?? "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/**
 * Rozdělí hlavičku Komu/Kopie na jednotlivé adresáty. Čárka uvnitř uvozovek
 * („Novák, Jan" <jan@…>) ani v `<…>` nerozděluje — naivní `split(",")` by
 * z jednoho adresáta udělal dva.
 */
export function splitAddressHeader(header: string | null | undefined): string[] {
  const out: string[] = [];
  let current = "";
  let quoted = false;
  let angle = false;
  for (const ch of header ?? "") {
    if (ch === '"') quoted = !quoted;
    else if (!quoted && ch === "<") angle = true;
    else if (!quoted && ch === ">") angle = false;
    if (ch === "," && !quoted && !angle) {
      if (current.trim()) out.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  if (current.trim()) out.push(current.trim());
  return out;
}

/** Vytáhne e-mailové adresy z hlavičky „Jméno <adresa>, …“. */
export function extractEmails(header: string | null | undefined): string[] {
  if (!header) return [];
  const found = header.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi) ?? [];
  return Array.from(new Set(found.map((e) => e.toLowerCase())));
}

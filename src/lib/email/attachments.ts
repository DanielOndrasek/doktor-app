/**
 * Přílohy v prohlížeči: náhled a stažení z krátkodobého podepsaného odkazu
 * enginu (`mail_priloha_odkaz`). Bajty tečou z enginu rovnou do prohlížeče,
 * aplikace je nedrží ani nepřevádí na base64 (pravidlo 2 v `CLAUDE.md`).
 */

export type AttachmentPreviewKind = "pdf" | "image" | "text";

/** Co jde ukázat přímo v dialogu; ostatní typy se jen stahují. */
export function attachmentPreviewKind(mimeType: string): AttachmentPreviewKind | null {
  const t = (mimeType || "").toLowerCase();
  if (t === "application/pdf") return "pdf";
  if (t.startsWith("image/")) return "image";
  if (t === "text/plain") return "text";
  return null;
}

/**
 * Stažení pod původním názvem. `<a download>` na cizí origin prohlížeč ignoruje,
 * proto se soubor natáhne `fetch`em (engine má CORS pro aplikaci) a nabídne
 * z `blob:` adresy. Odkaz enginu platí 10 minut, bere se čerstvý pro každé stažení.
 */
export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = objectUrl;
    a.download = filename || "priloha";
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    // Prohlížeč si blob při kliknutí převezme; adresu uvolnit až po chvíli.
    setTimeout(() => URL.revokeObjectURL(objectUrl), 10_000);
  }
}

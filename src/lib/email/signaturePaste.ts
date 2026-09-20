/**
 * Vkládání e-mailového podpisu ze schránky.
 * ---------------------------------------------------------------------------
 * Převzato z `crm/src/lib/emailSignaturePaste.ts` (vividbooks CRM, `831f9ae6`)
 * beze změny chování. Kam se obrázky nahrávají, určuje `SignatureImageUploader`,
 * který dodá volající — tady se o úložišti nerozhoduje.
 *
 * Podpis zkopírovaný z Gmailu nebo Apple Mailu nese obrázky ve formě, která
 * mimo původní aplikaci nepřežije: `data:` URI (zvětší řádek v DB o megabajty
 * a část klientů je blokuje), `blob:` odkaz platný jen pro tuhle stránku, nebo
 * `cid:` referenci na přílohu původní zprávy. Aby se podpis příjemci zobrazil,
 * musí být obrázek na veřejné URL — proto se bajty nahrají do storage a v HTML
 * zůstane jen odkaz. Stejně to řeší Gmail i Apple Mail.
 *
 * Formátování (inline styly, tabulky, fonty, barvy) se nechává beze změny;
 * o odstranění aktivního obsahu se stará `sanitizeEmailSignatureHtml`.
 */

/** Nahraje obrázek a vrátí jeho veřejnou URL. */
export type SignatureImageUploader = (blob: Blob) => Promise<string>;

export interface RehostSignatureImagesResult {
  /** Obrázky přenesené do storage. */
  uploaded: number;
  /** Obrázky, které nešlo zachovat — v podpisu by zůstal rozbitý odkaz. */
  dropped: number;
}

const REMOTE_SRC_RE = /^https?:\/\//i;
const INLINE_SRC_RE = /^(data:image\/|blob:)/i;

/** Obrázek nad tento limit se do podpisu nevejde rozumně ani po kompresi. */
export const MAX_SIGNATURE_IMAGE_BYTES = 2 * 1024 * 1024;

/**
 * Když upload selže, malý `data:` obrázek raději necháme inline — podpis pak
 * sice nese base64, ale zobrazí se. U větších by řádek v `podpisy` narostl
 * neúměrně, takže se obrázek zahodí a uživatel dostane hlášku.
 */
const MAX_INLINE_FALLBACK_LENGTH = 64 * 1024;

const IMAGE_EXTENSIONS: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/gif": "gif",
  "image/webp": "webp",
};

/**
 * Přípona pro storage podle MIME typu. `null` = typ, který do podpisu
 * nepouštíme (zejména SVG — hostovaný skriptovatelný dokument na doméně
 * storage).
 */
export function signatureImageExtension(mimeType: string): string | null {
  return IMAGE_EXTENSIONS[mimeType.toLowerCase().split(";")[0].trim()] ?? null;
}

/** Převede `data:` URI na `Blob`; `null` pokud nejde o použitelný obrázek. */
export function dataUrlToBlob(dataUrl: string): Blob | null {
  const match = /^data:([^;,]+)((?:;[^,]*)*),([\s\S]*)$/i.exec(dataUrl);
  if (!match) return null;
  const [, mimeType, parameters, payload] = match;
  if (!mimeType.toLowerCase().startsWith("image/")) return null;
  try {
    if (!/;base64/i.test(parameters)) {
      return new Blob([decodeURIComponent(payload)], { type: mimeType });
    }
    const binary = atob(payload);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mimeType });
  } catch {
    return null;
  }
}

async function resolveImageBlob(src: string): Promise<Blob | null> {
  if (src.toLowerCase().startsWith("data:")) return dataUrlToBlob(src);
  try {
    const response = await fetch(src);
    if (!response.ok) return null;
    const blob = await response.blob();
    return blob.type.startsWith("image/") ? blob : null;
  } catch {
    return null;
  }
}

/**
 * Přenese obrázky podpisu do storage a přepíše jim `src` na veřejnou URL.
 * Pracuje přímo nad živým DOM editoru, aby se vložený podpis zobrazil hned a
 * dohrání obrázků nerušilo kurzor. Vzdálené `https://` obrázky zůstávají beze
 * změny — už jsou dosažitelné odkudkoli.
 */
export async function rehostSignatureImages(
  root: ParentNode,
  upload: SignatureImageUploader,
): Promise<RehostSignatureImagesResult> {
  let uploaded = 0;
  let dropped = 0;

  for (const img of Array.from(root.querySelectorAll("img"))) {
    /* `srcset` má přednost před `src`, takže by po přepsání vrátil ke slovu
     * původní nedostupný zdroj. */
    img.removeAttribute("srcset");
    const src = img.getAttribute("src")?.trim() ?? "";

    if (!src || REMOTE_SRC_RE.test(src)) continue;

    if (INLINE_SRC_RE.test(src)) {
      const blob = await resolveImageBlob(src);
      if (blob && blob.size <= MAX_SIGNATURE_IMAGE_BYTES) {
        try {
          img.setAttribute("src", await upload(blob));
          uploaded += 1;
          continue;
        } catch {
          /* fallback níže — obrázek se pokusíme zachovat inline */
        }
      }
      if (src.toLowerCase().startsWith("data:") && src.length <= MAX_INLINE_FALLBACK_LENGTH) {
        continue;
      }
    }

    /* `cid:`, `file:` a neúspěšné případy: rozbitý odkaz v podpisu je horší
     * než chybějící obrázek, o kterém uživatel ví. */
    img.remove();
    dropped += 1;
  }

  return { uploaded, dropped };
}

/** Obrázky, které schránka nese jako soubor (kopie samotného obrázku). */
export function clipboardImageFiles(data: DataTransfer): File[] {
  return Array.from(data.files).filter((file) => file.type.startsWith("image/"));
}

/**
 * Vloží HTML na pozici kurzoru v editoru. Bez toho by vkládání přepsalo celý
 * dosavadní podpis, místo aby doplnilo řádek nebo obrázek.
 */
export function insertHtmlAtRange(container: HTMLElement, range: Range | null, html: string): void {
  const template = document.createElement("template");
  template.innerHTML = html;
  const fragment = template.content;
  const lastNode = fragment.lastChild;

  const usableRange = range && container.contains(range.commonAncestorContainer) ? range : null;
  if (!usableRange) {
    container.appendChild(fragment);
    return;
  }

  usableRange.deleteContents();
  usableRange.insertNode(fragment);

  if (!lastNode) return;
  const selection = window.getSelection();
  if (!selection) return;
  const caret = document.createRange();
  caret.setStartAfter(lastNode);
  caret.collapse(true);
  selection.removeAllRanges();
  selection.addRange(caret);
}

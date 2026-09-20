import { useCallback, useEffect, useRef, useState } from "react";
import type { ClipboardEvent } from "react";
import { Code2, Image as ImageIcon, Loader2, PenLine, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";
import { sanitizeEmailSignatureHtml, stripEmailSignatureMeta } from "@/lib/email/signature";
import {
  clipboardImageFiles,
  MAX_SIGNATURE_IMAGE_BYTES,
  rehostSignatureImages,
  type SignatureImageUploader,
} from "@/lib/email/signaturePaste";

interface SignatureEditorProps {
  /** HTML (nebo prostý text) podpisu — `podpisy.html`. */
  value: string;
  onSave: (html: string) => Promise<void> | void;
  /**
   * Nahrání obrázku a vrácení veřejné URL. Obrázky vložené ze schránky jsou
   * `data:` a e-mailoví klienti je blokují, proto se ukládají a odkazují.
   * Kam — engine, nebo úložiště — rozhodne K3.3; bez propu zůstanou malé
   * obrázky vložené a větší vypadnou (viz `rehostSignatureImages`).
   */
  onUploadImage?: SignatureImageUploader;
  placeholder?: string;
}

/**
 * Editor podpisu e-mailu. Dva režimy nad jednou hodnotou:
 *  • Podpis – editační plocha s formátováním; vložení ze schránky si nechá
 *    formátování i obrázky,
 *  • HTML kód – kód podpisu s náhledem.
 * Všechno prochází stejnou sanitizací jako při odeslání.
 *
 * Převzato z `components/vividbooks/EmailSignatureEditor.tsx` (vividbooks CRM,
 * `831f9ae6`). Odstřižené: `supabase.storage.from("company-assets")` — místo
 * něj prop `onUploadImage`; vlastní `materializeImages` nahradilo
 * `rehostSignatureImages` z `lib/email/signaturePaste.ts` (umí i `blob:`,
 * `srcset` a záložní chování bez úložiště); `Segmented` z reportů → `ToggleGroup`
 * z převzatého kitu; `sonner` → `useToast`; texty do slovníku.
 */
export function SignatureEditor({ value, onSave, onUploadImage, placeholder }: SignatureEditorProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"visual" | "html">("visual");
  const [html, setHtml] = useState(value);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const dirty = html.trim() !== (value ?? "").trim();

  useEffect(() => {
    setHtml(value);
  }, [value]);
  // obsah editoru nastavujeme ručně (jinak by se kurzor při psaní vracel na začátek)
  useEffect(() => {
    if (mode === "visual" && box.current && box.current.innerHTML !== html) box.current.innerHTML = html;
  }, [mode, html]);

  const insert = useCallback((fragment: string) => {
    box.current?.focus();
    document.execCommand("insertHTML", false, fragment);
    if (box.current) setHtml(box.current.innerHTML);
  }, []);

  /** Nahraje obrázek přes `onUploadImage`; bez něj vrátí `null` a řekne proč. */
  const upload = useCallback(
    async (file: Blob): Promise<string | null> => {
      if (!onUploadImage) {
        toast({ title: cs.posta.podpis.obrazkyBezUloziste });
        return null;
      }
      try {
        return await onUploadImage(file);
      } catch (err) {
        toast({
          title: cs.posta.podpis.obrazekNenahran,
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
        return null;
      }
    },
    [onUploadImage, toast],
  );

  /** Přenese `data:`/`blob:` obrázky vloženého HTML do úložiště a vrátí přepsané HTML. */
  const materialize = useCallback(
    async (fragment: string): Promise<string> => {
      const doc = new DOMParser().parseFromString(fragment, "text/html");
      if (onUploadImage) {
        const { dropped } = await rehostSignatureImages(doc.body, onUploadImage);
        if (dropped > 0) toast({ title: cs.posta.podpis.obrazkyZahozeny(dropped), variant: "destructive" });
      }
      return doc.body.innerHTML;
    },
    [onUploadImage, toast],
  );

  const onPaste = useCallback(
    async (e: ClipboardEvent<HTMLDivElement>) => {
      const files = clipboardImageFiles(e.clipboardData);
      const pastedHtml = e.clipboardData.getData("text/html");
      if (!files.length && !pastedHtml) return; // prostý text nechá prohlížeč vložit sám
      e.preventDefault();
      setBusy(true);
      try {
        if (files.length) {
          for (const f of files) {
            if (f.size > MAX_SIGNATURE_IMAGE_BYTES) {
              toast({ title: cs.posta.podpis.obrazekVelky, variant: "destructive" });
              continue;
            }
            const url = await upload(f);
            if (url) insert(`<img src="${url}" style="max-width:100%;height:auto" alt="" />`);
          }
          return;
        }
        const clean = sanitizeEmailSignatureHtml(stripEmailSignatureMeta(pastedHtml));
        insert(await materialize(clean));
      } finally {
        setBusy(false);
      }
    },
    [insert, materialize, toast, upload],
  );

  const pickImage = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      if (file.size > MAX_SIGNATURE_IMAGE_BYTES) {
        toast({ title: cs.posta.podpis.obrazekVelky, variant: "destructive" });
        return;
      }
      setBusy(true);
      const url = await upload(file);
      setBusy(false);
      if (url) {
        setMode("visual");
        insert(`<img src="${url}" style="max-width:100%;height:auto" alt="" />`);
      }
    },
    [insert, toast, upload],
  );

  const save = async () => {
    setSaving(true);
    try {
      await onSave(sanitizeEmailSignatureHtml(stripEmailSignatureMeta(html)).trim());
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <ToggleGroup
          type="single"
          size="sm"
          value={mode}
          onValueChange={(v) => {
            if (v === "visual" || v === "html") setMode(v);
          }}
          className="rounded-lg bg-muted p-0.5"
        >
          <ToggleGroupItem value="visual" className="h-7 rounded-md px-2.5 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm">
            {cs.posta.podpis.rezimPodpis}
          </ToggleGroupItem>
          <ToggleGroupItem value="html" className="h-7 rounded-md px-2.5 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm">
            {cs.posta.podpis.rezimHtml}
          </ToggleGroupItem>
        </ToggleGroup>
        <label
          className={cn(
            "inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium",
            onUploadImage ? "cursor-pointer hover:bg-muted" : "cursor-not-allowed opacity-50",
          )}
          title={onUploadImage ? undefined : cs.posta.podpis.obrazkyBezUloziste}
        >
          <ImageIcon className="h-3.5 w-3.5" />
          {cs.posta.podpis.obrazek}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            disabled={!onUploadImage}
            onChange={(e) => {
              void pickImage(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {html ? (
          <button
            type="button"
            onClick={() => {
              setHtml("");
              if (box.current) box.current.innerHTML = "";
            }}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {cs.posta.podpis.smazat}
          </button>
        ) : null}
        <span className="flex-1" />
        {busy ? (
          <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Loader2 className="h-3 w-3 animate-spin" />
            {cs.posta.podpis.nahravamObrazek}
          </span>
        ) : null}
        <Button type="button" size="sm" className="h-8" disabled={!dirty || saving || busy} onClick={() => void save()}>
          {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
          {cs.posta.podpis.ulozit}
        </Button>
      </div>

      {mode === "visual" ? (
        <div
          ref={box}
          contentEditable
          suppressContentEditableWarning
          onInput={() => setHtml(box.current?.innerHTML ?? "")}
          onPaste={(e) => void onPaste(e)}
          data-placeholder={placeholder ?? cs.posta.podpis.placeholder}
          className={cn(
            "min-h-[132px] w-full rounded-md border bg-background px-3 py-2 text-sm leading-snug outline-none",
            "focus-visible:ring-2 focus-visible:ring-ring/60 [&_a]:text-primary [&_a]:underline [&_img]:max-w-full [&_table]:border-collapse",
            "empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]",
          )}
        />
      ) : (
        <>
          <Textarea
            rows={10}
            value={html}
            onChange={(e) => setHtml(e.target.value)}
            spellCheck={false}
            className="font-mono text-xs"
            placeholder={cs.posta.podpis.htmlPlaceholder}
          />
          <div className="rounded-md border bg-muted/30 p-3">
            <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">{cs.posta.sablony.nahled}</p>
            <div
              className="text-sm [&_a]:text-primary [&_a]:underline [&_img]:max-w-full"
              dangerouslySetInnerHTML={{ __html: sanitizeEmailSignatureHtml(stripEmailSignatureMeta(html)) }}
            />
          </div>
        </>
      )}
      <p className="flex items-start gap-1.5 text-[11px] leading-relaxed text-muted-foreground">
        <PenLine className="mt-px h-3 w-3 shrink-0" />
        {cs.posta.podpis.napoveda}
        <Code2 className="ml-1 mt-px h-3 w-3 shrink-0" />
      </p>
    </div>
  );
}

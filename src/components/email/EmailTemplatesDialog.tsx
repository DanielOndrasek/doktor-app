import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "@tiptap/react";
import { Check, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { cn, normalizeSearch } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";
import type { EmailTemplate, EmailTemplateDraft } from "@/lib/email/compose";
import { EmailRichEditor } from "./EmailRichEditor";

interface EmailTemplatesDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Šablony k zobrazení. Kdo je načítá a odkud, řeší volající (K2). */
  templates: EmailTemplate[];
  loading?: boolean;
  onUseTemplate: (template: EmailTemplate) => void;
  /** Bez `onSave` je dialog jen k prohlížení a použití — tlačítka pro úpravy se neukážou. */
  onSave?: (draft: EmailTemplateDraft, id?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

/**
 * Knihovna šablon: seznam se složkami a náhledem, formulář pro novou nebo
 * upravenou šablonu. Převzato z vividbooks CRM (`831f9ae6`).
 *
 * Odstřižené: čtení a zápis do `email_templates` a do bucketu
 * `template-attachments` (schéma `crm` — data teď chodí propsy), sdílení mezi
 * uživateli a záložka „Moje" (`is_shared`, `author_name` — Doktor má jednoho
 * uživatele), přílohy šablony (patří do skladu příloh v K4, a ne jako soubory
 * v Supabase) a počítadlo použití přes RPC (volající si ho spočítá sám
 * v `onUseTemplate`).
 */
export function EmailTemplatesDialog({
  open,
  onOpenChange,
  templates,
  loading = false,
  onUseTemplate,
  onSave,
  onDelete,
}: EmailTemplatesDialogProps) {
  const { toast } = useToast();
  const [mode, setMode] = useState<"list" | "create" | "edit">("list");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [folder, setFolder] = useState<string>("all");
  const [previewId, setPreviewId] = useState<string | null>(null);

  const [formName, setFormName] = useState("");
  const [formSubject, setFormSubject] = useState("");
  const [formFolder, setFormFolder] = useState("");
  const [saving, setSaving] = useState(false);
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);
  const bodyHtmlRef = useRef("");

  useEffect(() => {
    if (open) {
      setMode("list");
      setSearchQuery("");
    }
  }, [open]);

  const folderOf = (t: EmailTemplate) => t.folder?.trim() || cs.posta.sablony.ostatni;
  const folderCounts = useMemo(
    () =>
      templates.reduce<Record<string, number>>((m, t) => {
        m[folderOf(t)] = (m[folderOf(t)] ?? 0) + 1;
        return m;
      }, {}),
    [templates],
  );
  const folderNames = useMemo(
    () =>
      Object.keys(folderCounts).sort((a, b) =>
        a === cs.posta.sablony.ostatni ? 1 : b === cs.posta.sablony.ostatni ? -1 : a.localeCompare(b, "cs"),
      ),
    [folderCounts],
  );

  const filteredTemplates = useMemo(() => {
    const q = normalizeSearch(searchQuery.trim());
    return templates
      .filter((t) => folder === "all" || folderOf(t) === folder)
      .filter(
        (t) =>
          !q ||
          normalizeSearch(t.name).includes(q) ||
          normalizeSearch(t.subject || "").includes(q) ||
          normalizeSearch(folderOf(t)).includes(q),
      )
      .sort((a, b) => (b.useCount ?? 0) - (a.useCount ?? 0) || a.name.localeCompare(b.name, "cs"));
  }, [templates, folder, searchQuery]);

  const previewTemplate = filteredTemplates.find((t) => t.id === previewId) ?? filteredTemplates[0] ?? null;

  const openCreate = () => {
    setEditingId(null);
    setFormName("");
    setFormSubject("");
    setFormFolder("");
    bodyHtmlRef.current = "";
    setMode("create");
  };

  const openEdit = (t: EmailTemplate) => {
    setEditingId(t.id);
    setFormName(t.name);
    setFormSubject(t.subject || "");
    setFormFolder(t.folder || "");
    bodyHtmlRef.current = t.bodyHtml || "";
    setMode("edit");
  };

  const handleSave = async () => {
    if (!onSave) return;
    if (!formName.trim()) {
      toast({ title: cs.posta.sablony.zadejteNazev, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const bodyHtml = editorRef.current?.getHTML() || bodyHtmlRef.current;
      await onSave(
        {
          name: formName.trim(),
          subject: formSubject.trim() || null,
          bodyHtml: bodyHtml || null,
          folder: formFolder.trim() || null,
        },
        editingId ?? undefined,
      );
      toast({ title: cs.posta.sablony.ulozeno });
      setMode("list");
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : String(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!onDelete) return;
    try {
      await onDelete(id);
      toast({ title: cs.posta.sablony.smazano });
      setPreviewId(null);
    } catch (err) {
      toast({ title: err instanceof Error ? err.message : String(err), variant: "destructive" });
    }
  };

  const handleUse = (t: EmailTemplate) => {
    onUseTemplate(t);
    onOpenChange(false);
  };

  const previewSrcDoc = (t: EmailTemplate) =>
    `<!doctype html><meta charset="utf-8"><body style="font:14px/1.5 Arial,sans-serif;color:#222;margin:16px">${(
      t.bodyHtml || `<p style='color:#888'>${cs.posta.sablony.bezTextu}</p>`
    ).replace(/\[([^\]\n]{3,40})\]/g, "<mark>[$1]</mark>")}</body>`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn("flex max-h-[85vh] flex-col", mode === "list" ? "w-[calc(100vw-1.5rem)] max-w-6xl" : "max-w-2xl")}
      >
        <DialogHeader>
          <DialogTitle>
            {mode === "list" && cs.posta.sablony.nazevSeznam}
            {mode === "create" && cs.posta.sablony.nova}
            {mode === "edit" && cs.posta.sablony.upravitNazev}
          </DialogTitle>
        </DialogHeader>

        {mode === "list" && (
          <div className="-m-1 flex flex-1 flex-col gap-3 overflow-auto p-1">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={cs.posta.sablony.hledat}
                  className="h-8 pl-8 text-sm"
                />
              </div>
              {onSave && (
                <Button size="sm" onClick={openCreate} className="flex-shrink-0">
                  <Plus className="mr-1.5 h-3.5 w-3.5" />
                  {cs.posta.sablony.nova}
                </Button>
              )}
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : templates.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">{cs.posta.sablony.zadne}</p>
            ) : (
              <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[13rem_minmax(0,1fr)] lg:grid-cols-[13rem_minmax(0,22rem)_minmax(0,1fr)]">
                <nav className="flex gap-1 overflow-x-auto md:flex-col md:overflow-visible">
                  {(
                    [
                      ["all", cs.posta.sablony.vsechny, templates.length],
                      ...folderNames.map((f) => [f, f, folderCounts[f]]),
                    ] as [string, string, number][]
                  ).map(([key, label, n]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => {
                        setFolder(key);
                        setPreviewId(null);
                      }}
                      className={cn(
                        "flex shrink-0 items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px]",
                        folder === key
                          ? "bg-primary text-primary-foreground"
                          : "text-muted-foreground hover:bg-muted hover:text-foreground",
                        key === "all" && "md:mb-1.5 md:border-b md:pb-2",
                      )}
                    >
                      <span className="truncate">{label}</span>
                      <span className="text-[11.5px] tabular-nums opacity-70">{n}</span>
                    </button>
                  ))}
                </nav>

                <div className="min-h-0 space-y-1 overflow-y-auto md:max-h-[58vh]">
                  {filteredTemplates.length === 0 ? (
                    <p className="py-4 text-center text-sm text-muted-foreground">{cs.posta.sablony.zadneVyberu}</p>
                  ) : (
                    filteredTemplates.map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setPreviewId(t.id)}
                        onDoubleClick={() => handleUse(t)}
                        className={cn(
                          "block w-full rounded-md border px-2.5 py-2 text-left transition-colors",
                          previewTemplate?.id === t.id
                            ? "border-secondary/60 bg-secondary/5"
                            : "border-border hover:bg-muted/40",
                        )}
                      >
                        <div className="truncate text-[13px] font-medium">{t.name}</div>
                        <div className="mt-0.5 flex items-center gap-2 text-[11.5px] text-muted-foreground">
                          <span className="min-w-0 flex-1 truncate">{t.subject || cs.posta.sablony.bezPredmetu}</span>
                          <span className="shrink-0 tabular-nums">
                            {t.useCount ? `${cs.posta.sablony.pouzito} ${t.useCount}×` : cs.posta.sablony.nepouzito}
                          </span>
                        </div>
                      </button>
                    ))
                  )}
                </div>

                <div className="hidden min-h-0 flex-col rounded-md border lg:flex">
                  {previewTemplate ? (
                    <>
                      <div className="flex items-start gap-2 border-b px-3 py-2">
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-semibold">{previewTemplate.name}</div>
                          <div className="truncate text-xs text-muted-foreground">
                            {previewTemplate.subject
                              ? `${cs.posta.sablony.predmetPrefix}${previewTemplate.subject}`
                              : cs.posta.sablony.bezPredmetu}
                          </div>
                        </div>
                        {onSave && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8"
                            onClick={() => openEdit(previewTemplate)}
                            title={cs.posta.sablony.upravit}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => handleDelete(previewTemplate.id)}
                            title={cs.posta.sablony.smazat}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="sm" onClick={() => handleUse(previewTemplate)}>
                          <Check className="mr-1 h-3.5 w-3.5" />
                          {cs.posta.sablony.pouzit}
                        </Button>
                      </div>
                      {/* HTML šablony jen v izolovaném rámu bez skriptů */}
                      <iframe
                        title={cs.posta.sablony.nahled}
                        sandbox=""
                        className="min-h-[46vh] w-full flex-1 bg-white"
                        srcDoc={previewSrcDoc(previewTemplate)}
                      />
                      <p className="border-t px-3 py-1.5 text-[11.5px] text-muted-foreground">
                        {cs.posta.sablony.poleVysvetleni}
                      </p>
                    </>
                  ) : (
                    <p className="p-6 text-center text-sm text-muted-foreground">{cs.posta.sablony.bezNahledu}</p>
                  )}
                </div>

                {/* na užším okně bez náhledu: akce pod seznamem */}
                {previewTemplate ? (
                  <div className="flex items-center gap-2 md:col-start-2 lg:hidden">
                    <Button size="sm" onClick={() => handleUse(previewTemplate)}>
                      <Check className="mr-1 h-3.5 w-3.5" />
                      {cs.posta.sablony.pouzit} „{previewTemplate.name.slice(0, 28)}"
                    </Button>
                    {onSave ? (
                      <Button size="sm" variant="outline" onClick={() => openEdit(previewTemplate)}>
                        {cs.posta.sablony.upravit}
                      </Button>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>
        )}

        {(mode === "create" || mode === "edit") && (
          <div className="-m-1 flex flex-1 flex-col gap-3 overflow-auto p-1">
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{cs.posta.sablony.nazevPole}</label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={cs.posta.sablony.nazevPlaceholder}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{cs.posta.sablony.predmetPole}</label>
              <Input
                value={formSubject}
                onChange={(e) => setFormSubject(e.target.value)}
                placeholder={cs.posta.sablony.predmetPlaceholder}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-muted-foreground">{cs.posta.sablony.zarazeniPole}</label>
              <Input
                value={formFolder}
                onChange={(e) => setFormFolder(e.target.value)}
                list="doktor-template-folders"
                placeholder={cs.posta.sablony.zarazeniPlaceholder}
                className="h-8 text-sm"
              />
              <datalist id="doktor-template-folders">
                {folderNames.map((f) => (
                  <option key={f} value={f} />
                ))}
              </datalist>
            </div>
            <div className="flex min-h-[200px] flex-1 flex-col">
              <label className="mb-1 block text-xs text-muted-foreground">{cs.posta.sablony.obsah}</label>
              <EmailRichEditor
                defaultContent={bodyHtmlRef.current}
                onUpdate={(html) => {
                  bodyHtmlRef.current = html;
                }}
                editorRef={editorRef}
              />
            </div>

            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setMode("list")}>
                <X className="mr-1 h-3.5 w-3.5" />
                {cs.posta.sablony.zrusit}
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                {cs.posta.sablony.ulozit}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

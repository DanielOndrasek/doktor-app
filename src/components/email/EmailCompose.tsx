import { useEffect, useMemo, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { useEditor } from "@tiptap/react";
import {
  AlertTriangle,
  ChevronDown,
  FileIcon,
  Loader2,
  Paperclip,
  Plus,
  Save,
  Search,
  Send,
  Settings,
  X,
  XCircle,
  XIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { normalizeSearch } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";
import type {
  AttachmentUploadRef,
  ComposeForwardContext,
  ComposeSendRequest,
  EmailRecipientSuggestion,
  EmailSenderOption,
  EmailTemplate,
  EmailTemplateDraft,
} from "@/lib/email/compose";
import { EmailTemplatesDialog } from "./EmailTemplatesDialog";
import { SaveAsTemplateDialog } from "./SaveAsTemplateDialog";
import { EmailRichEditor } from "./EmailRichEditor";
import { EmailRecipientsInput } from "./EmailRecipientsInput";
import { signatureBlockHtml } from "./EmailSignatureNode";

/** Rozdělí volný text (CSV) na pole e-mailových adres. */
function parseEmails(raw: string): string[] {
  return raw
    .split(/[,;\s]+/)
    .map((e) => e.trim())
    .filter(Boolean);
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Propsy, které okno psaní dostává zvenčí a `EmailInbox` je jen předává dál.
 * Drží pohromadě všechno, co CRM řešilo přímými importy (schránka, podpis,
 * adresář, šablony, přílohy).
 */
export interface EmailComposeSharedProps {
  /**
   * HTML podpisu, který se připojí na konec těla. Načíst ho je věc volajícího
   * (řádek „Podpisy" — tabulka `podpisy`); CRM si ho tady tahalo z `profiles`.
   */
  signatureHtml?: string | null;
  /**
   * Podpis podle schránky, ze které se bude odesílat (K3.3). Má přednost před
   * `signatureHtml`; počítá se jednou při otevření okna z předvolené schránky.
   */
  signatureFor?: (sender: string) => string | null | undefined;
  /**
   * Schránky, ze kterých jde odeslat („Odeslat z", K3.3). Bez nich se řádek
   * neukáže a engine odešle z výchozí schránky.
   */
  senders?: EmailSenderOption[];
  /** Adresa předvybraná pro nový e-mail — schránka, ve které se uživatel právě dívá. */
  defaultSender?: string;
  /** Návrhy adresátů z kontextu (účastníci vlákna, kontakt u položky). */
  recipientSuggestions?: EmailRecipientSuggestion[];
  /** Hledání v adresáři pro našeptávač adres. */
  onSearchRecipients?: (query: string) => Promise<EmailRecipientSuggestion[]>;
  /** Šablony zpráv; bez nich se výběr šablony neukáže. */
  templates?: EmailTemplate[];
  onSaveTemplate?: (draft: EmailTemplateDraft, id?: string) => Promise<void>;
  onDeleteTemplate?: (id: string) => Promise<void>;
  /** Zaznamená použití šablony (počítadlo). */
  onTemplateUsed?: (template: EmailTemplate) => void;
  /**
   * Nahrání přílohy na engine — multipart, vrací odkaz. Bez tohoto propu je
   * sponka vypnutá. Okno psaní nikdy nedrží bajty přílohy ani base64
   * (pravidlo 2 v `CLAUDE.md`).
   */
  onUploadAttachment?: (file: File) => Promise<AttachmentUploadRef>;
  /**
   * Odeslání. Vždy až po kliknutí na „Odeslat" (pravidlo 8): žádné
   * naplánované ani automatické odeslání tady není.
   */
  onSend: (request: ComposeSendRequest) => Promise<void>;
  /**
   * Rozepsaný text (K3.2, E3): volá se s odstupem po psaní, aby se rozepsaná
   * odpověď uložila k položce a běh ji nepřepsal. Kam, řeší volající.
   */
  onBodyChange?: (html: string, context: { inReplyTo?: string; threadId?: string }) => void;
}

const BODY_CHANGE_DELAY_MS = 1500;

interface EmailComposeProps extends EmailComposeSharedProps {
  defaultTo?: string;
  defaultSubject?: string;
  defaultBody?: string;
  threadId?: string;
  inReplyTo?: string;
  references?: string;
  /**
   * Adresa schránky, do které přišla zpráva, na kterou se odpovídá. Je to
   * předvolba „Odeslat z"; odpověď z jiné schránky hlásí varování (pravidlo 8).
   */
  replyMailbox?: string;
  /**
   * Režim přeposlání (`mail_preposlat`): tělo je jen poznámka, předmět, původní
   * hlavičky, text a přílohy skládá engine. Vlastní přílohy nejdou přidat
   * (nástroj je nebere) a „Odeslat z" se neukazuje — engine přeposílá z ÚVN.
   */
  forwardOf?: ComposeForwardContext;
  /** Přepíše min. výšku editačního pole těla (kompaktní composer). */
  bodyMinHeightClass?: string;
  onClose: () => void;
  onSent?: () => void;
}

interface PendingAttachment {
  key: string;
  name: string;
  size: number;
  /** `null`, dokud engine nevrátí `uploadId`. */
  upload: AttachmentUploadRef | null;
  error?: string;
}

/**
 * Okno psaní zprávy. Převzato z vividbooks CRM (`831f9ae6`).
 *
 * Odstřižené — každá položka kvůli pravidlu z `CLAUDE.md` nebo kvůli schématu
 * `crm`:
 * - `useMailbox` a přímé volání `mailbox.send` → prop `onSend` (jeden
 *   zapisovač je engine; jak se `uploadIds` dostanou k odeslání, rozhodne
 *   `engineMailbox.ts`),
 * - `fileToBase64` a `attachments: [{ data: base64 }]` → přílohy jdou
 *   multipartem přes `onUploadAttachment` a k odeslání se připojují odkazem,
 * - „Později" a `ScheduledEmailsButton` (`crm.scheduled_emails`) → nic se
 *   neodesílá samo,
 * - „Napsat text AI" (`email-text-assist`) → žádné volání modelu z aplikace;
 *   návrhy píše Claude přes MCP,
 * - `EmailQuickActions`, `fillTemplateFields`, `greetingFor` (slučovací pole
 *   nad obchody a školami) a `ownerToRecipientOptions` (vlastníci nemovitosti),
 * - podpis z `profiles.email_signature` → prop `signatureHtml`,
 * - šablony z `email_templates` → propsy `templates` a spol.
 */
export function EmailCompose({
  defaultTo = "",
  defaultSubject = "",
  defaultBody = "",
  threadId,
  inReplyTo,
  references,
  replyMailbox,
  forwardOf,
  signatureHtml,
  signatureFor,
  senders: sendersProp,
  defaultSender,
  recipientSuggestions,
  onSearchRecipients,
  templates,
  onSaveTemplate,
  onDeleteTemplate,
  onTemplateUsed,
  onUploadAttachment: onUploadAttachmentProp,
  onSend,
  onBodyChange,
  bodyMinHeightClass,
  onClose,
  onSent,
}: EmailComposeProps) {
  const { toast } = useToast();
  // Přeposlání: bez „Odeslat z" (engine přeposílá z ÚVN) a bez vlastních příloh (nástroj je nebere).
  const senders = forwardOf ? undefined : sendersProp;
  const onUploadAttachment = forwardOf ? undefined : onUploadAttachmentProp;

  const [to, setTo] = useState<string[]>(parseEmails(defaultTo));
  const [cc, setCc] = useState<string[]>([]);
  const [bcc, setBcc] = useState<string[]>([]);
  const [showCc, setShowCc] = useState(false);
  const [showBcc, setShowBcc] = useState(false);
  const [subject, setSubject] = useState(defaultSubject);
  // „Odeslat z": u odpovědi schránka, kam zpráva přišla; u nové zprávy ta, ve které
  // se uživatel dívá; jinak první v nabídce. Počítá se jednou při otevření okna.
  const [sendFrom, setSendFrom] = useState<string>(() => {
    const list = senders ?? [];
    const preferred = replyMailbox ?? defaultSender;
    return list.find((s) => s.address === preferred)?.address ?? list[0]?.address ?? "";
  });
  const otherMailbox = Boolean(replyMailbox && sendFrom && sendFrom !== replyMailbox);
  const [sending, setSending] = useState(false);
  const [attachments, setAttachments] = useState<PendingAttachment[]>([]);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [saveTemplateOpen, setSaveTemplateOpen] = useState(false);
  const [templatePopoverOpen, setTemplatePopoverOpen] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const editorRef = useRef<ReturnType<typeof useEditor> | null>(null);
  const bodyHtmlRef = useRef(defaultBody);
  const bodyChangeTimer = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (bodyChangeTimer.current) window.clearTimeout(bodyChangeTimer.current);
    },
    [],
  );
  const scheduleBodyChange = (html: string) => {
    if (!onBodyChange) return;
    if (bodyChangeTimer.current) window.clearTimeout(bodyChangeTimer.current);
    bodyChangeTimer.current = window.setTimeout(() => onBodyChange(html, { inReplyTo, threadId }), BODY_CHANGE_DELAY_MS);
  };

  useEffect(() => {
    setTo(parseEmails(defaultTo));
  }, [defaultTo]);

  /* Podpis patří na konec těla jako blok, ať se dá smazat, ale ne rozepsat.
   * Přidává se jen jednou — když ho tělo (šablona, odpověď) už obsahuje,
   * znovu se nepřidá. Počítá se jednou při otevření okna; změna podpisu za
   * běhu by přepsala rozepsaný text (E3 v kontrolním seznamu plánu). */
  const initialContent = useMemo(() => {
    const body = defaultBody?.trim() ? defaultBody : "<p></p>";
    const initialSender = replyMailbox ?? defaultSender ?? senders?.[0]?.address ?? "";
    const sig = (signatureFor ? signatureFor(initialSender) : signatureHtml)?.trim();
    return sig && !body.includes(sig) ? `${body}<p></p>${signatureBlockHtml(sig)}` : body;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    bodyHtmlRef.current = initialContent;
  }, [initialContent]);

  const filteredTemplates = useMemo(() => {
    const list = templates ?? [];
    const q = normalizeSearch(templateSearch.trim());
    return list.filter(
      (t) =>
        !q ||
        normalizeSearch(t.name).includes(q) ||
        normalizeSearch(t.subject || "").includes(q) ||
        normalizeSearch(t.folder || "").includes(q),
    );
  }, [templates, templateSearch]);

  const applyTemplate = (t: EmailTemplate) => {
    onTemplateUsed?.(t);
    if (t.subject && !threadId) setSubject(t.subject);
    const body = t.bodyHtml || "";
    editorRef.current?.commands.setContent(body);
    bodyHtmlRef.current = body;
    setTemplatePopoverOpen(false);
  };

  const addFiles = async (files: File[]) => {
    if (files.length === 0 || !onUploadAttachment) return;
    const pending: PendingAttachment[] = files.map((file) => ({
      key: `${file.name}-${file.size}-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: file.name,
      size: file.size,
      upload: null,
    }));
    setAttachments((prev) => [...prev, ...pending]);
    await Promise.all(
      pending.map(async (att, i) => {
        try {
          const upload = await onUploadAttachment(files[i]);
          setAttachments((prev) => prev.map((a) => (a.key === att.key ? { ...a, upload } : a)));
        } catch (err) {
          const message = err instanceof Error ? err.message : cs.posta.psani.chybaPrilohy;
          setAttachments((prev) => prev.map((a) => (a.key === att.key ? { ...a, error: message } : a)));
          toast({ title: cs.posta.psani.chybaPrilohy, description: message, variant: "destructive" });
        }
      }),
    );
  };

  const handleFilesSelected = (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    void addFiles(Array.from(files));
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeAttachment = (key: string) => {
    setAttachments((prev) => prev.filter((a) => a.key !== key));
  };

  const uploading = attachments.some((a) => !a.upload && !a.error);

  const handleSend = async () => {
    if (to.length === 0) {
      toast({ title: cs.posta.psani.chybiPrijemce, variant: "destructive" });
      return;
    }
    const bodyHtml = editorRef.current?.getHTML() || bodyHtmlRef.current;
    // Poznámka k přeposlání smí být prázdná — obsah dodá engine z původní zprávy.
    if (!forwardOf && (!bodyHtml.trim() || bodyHtml === "<p></p>")) {
      toast({ title: cs.posta.psani.chybiText, variant: "destructive" });
      return;
    }
    const uploadIds = attachments.flatMap((a) => (a.upload ? [a.upload.uploadId] : []));

    setSending(true);
    try {
      await onSend({
        to,
        cc,
        bcc,
        subject: subject.trim(),
        body: bodyHtml, // podpis je už součástí těla (vkládá se do editoru při otevření)
        isHtml: true,
        threadId,
        inReplyTo,
        references,
        uploadIds: uploadIds.length ? uploadIds : undefined,
        sendFrom: sendFrom || undefined,
        forwardOf: forwardOf?.ref,
      });
      toast({ title: forwardOf ? cs.posta.psani.preposlano : cs.posta.psani.odeslano });
      onSent?.();
      onClose();
    } catch (err) {
      toast({
        title: cs.posta.psani.chybaOdeslani,
        description: err instanceof Error ? err.message : String(err),
        variant: "destructive",
      });
    } finally {
      setSending(false);
    }
  };

  const bodyForTemplate = () => editorRef.current?.getHTML() || bodyHtmlRef.current;

  return (
    <div className="flex h-full max-h-full min-h-0 flex-col overflow-hidden bg-background">
      <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-muted/30 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-foreground">
          {forwardOf ? cs.posta.psani.preposlani : threadId ? cs.posta.psani.odpoved : cs.posta.psani.novy}
        </h3>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose} aria-label={cs.ui.zavrit}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="flex-shrink-0 space-y-2 p-3">
        {senders && senders.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="w-12 flex-shrink-0 text-xs text-muted-foreground">{cs.posta.psani.od}</label>
            <Select value={sendFrom} onValueChange={setSendFrom} disabled={senders.length === 1}>
              <SelectTrigger className="h-8 text-sm" aria-label={cs.posta.psani.odeslatZ}>
                <SelectValue placeholder={cs.posta.psani.odeslatZ} />
              </SelectTrigger>
              <SelectContent>
                {senders.map((s) => (
                  <SelectItem key={s.address} value={s.address}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        {otherMailbox && (
          /* Pravidlo 8: odpověď z jiné schránky, než do které zpráva přišla, se neodmítá, ale hlásí. */
          <p role="status" className="flex items-start gap-1.5 pl-14 text-xs text-warning">
            <AlertTriangle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" />
            <span>
              {cs.posta.psani.varovaniJinaSchranka.replace("{prisla}", replyMailbox ?? "").replace("{odesila}", sendFrom)}
            </span>
          </p>
        )}
        <div className="flex items-start gap-2">
          <span className="w-12 flex-shrink-0 pt-2 text-xs text-muted-foreground">{cs.posta.psani.komu}</span>
          <div className="min-w-0 flex-1">
            <EmailRecipientsInput
              value={to}
              onChange={setTo}
              suggestions={recipientSuggestions}
              onSearch={onSearchRecipients}
              placeholder={cs.posta.psani.adresaPlaceholder}
            />
          </div>
          {!showCc && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-0.5 h-7 flex-shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowCc(true)}
            >
              CC
            </Button>
          )}
          {!showBcc && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-0.5 h-7 flex-shrink-0 px-2 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowBcc(true)}
            >
              BCC
            </Button>
          )}
        </div>
        {showCc && (
          <div className="flex items-start gap-2">
            <label className="w-12 flex-shrink-0 pt-2 text-xs text-muted-foreground">CC</label>
            <div className="min-w-0 flex-1">
              <EmailRecipientsInput
                value={cc}
                onChange={setCc}
                suggestions={recipientSuggestions}
                onSearch={onSearchRecipients}
                placeholder={cs.posta.psani.adresaCcPlaceholder}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="mt-0.5 h-7 w-7 flex-shrink-0"
              onClick={() => {
                setShowCc(false);
                setCc([]);
              }}
            >
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        {showBcc && (
          <div className="flex items-start gap-2">
            <label className="w-12 flex-shrink-0 pt-2 text-xs text-muted-foreground">BCC</label>
            <div className="min-w-0 flex-1">
              <EmailRecipientsInput
                value={bcc}
                onChange={setBcc}
                suggestions={recipientSuggestions}
                onSearch={onSearchRecipients}
                placeholder={cs.posta.psani.adresaBccPlaceholder}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="mt-0.5 h-7 w-7 flex-shrink-0"
              onClick={() => {
                setShowBcc(false);
                setBcc([]);
              }}
            >
              <XIcon className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <label className="w-12 flex-shrink-0 text-xs text-muted-foreground">{cs.posta.psani.predmet}</label>
          <Input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={cs.posta.psani.predmetPlaceholder}
            className="h-8 text-sm"
            disabled={Boolean(forwardOf)}
            title={forwardOf ? cs.posta.psani.preposlaniPoznamka : undefined}
          />
        </div>
        {forwardOf && (
          <div className="space-y-1 rounded-md border border-border bg-muted/40 px-2.5 py-2 text-xs text-muted-foreground">
            <p>{cs.posta.psani.preposlaniPoznamka}</p>
            {forwardOf.attachments.length ? (
              <div className="flex flex-wrap items-center gap-1.5">
                <span>{cs.posta.psani.preposlaniPrilohy(forwardOf.attachments.length)}</span>
                {forwardOf.attachments.map((a, i) => (
                  <span key={`${a.name}-${i}`} className="flex items-center gap-1 rounded-md border border-border bg-background px-1.5 py-0.5">
                    <Paperclip className="h-3 w-3" />
                    <span className="max-w-[160px] truncate" title={a.name}>
                      {a.name}
                    </span>
                    <span>({formatFileSize(a.size)})</span>
                  </span>
                ))}
              </div>
            ) : (
              <p>{cs.posta.psani.preposlaniBezPriloh}</p>
            )}
          </div>
        )}

        {templates && (
          <div className="flex items-center gap-1">
            <Popover
              open={templatePopoverOpen}
              onOpenChange={(open) => {
                setTemplatePopoverOpen(open);
                if (open) setTemplateSearch("");
              }}
            >
              <PopoverTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className="h-3 w-3" />
                  {cs.posta.psani.vybratSablonu}
                </Button>
              </PopoverTrigger>
              {/* Výška se řídí místem, které má okno k dispozici (nahoru i dolů) –
                  jinak se při otevření nahoru uřízl začátek seznamu i hledání. */}
              <PopoverContent
                align="start"
                sideOffset={4}
                collisionPadding={12}
                className="flex w-[min(30rem,calc(100vw-2rem))] flex-col overflow-hidden p-0"
                style={{ maxHeight: "min(32rem, var(--radix-popover-content-available-height))" }}
              >
                <div className="shrink-0 p-2">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={templateSearch}
                      onChange={(e) => setTemplateSearch(e.target.value)}
                      placeholder={cs.posta.psani.hledatSablonu}
                      className="h-7 pl-7 text-xs"
                      autoFocus
                    />
                  </div>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto">
                  {filteredTemplates.length === 0 ? (
                    <p className="py-3 text-center text-xs text-muted-foreground">
                      {templateSearch ? cs.posta.psani.zadneVysledky : cs.posta.psani.zadneSablony}
                    </p>
                  ) : (
                    (() => {
                      /* Po složkách, celé názvy (zalomí se); „Ostatní" až na konci. */
                      const other = cs.posta.psani.ostatni;
                      const groups = new Map<string, EmailTemplate[]>();
                      for (const t of filteredTemplates) {
                        const f = t.folder?.trim() || other;
                        groups.set(f, [...(groups.get(f) ?? []), t]);
                      }
                      return [...groups.entries()]
                        .sort(([x], [y]) => (x === other ? 1 : y === other ? -1 : x.localeCompare(y, "cs")))
                        .map(([folderName, list]) => (
                          <div key={folderName}>
                            <div className="sticky top-0 z-10 bg-popover px-3 pb-1 pt-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                              {folderName} <span className="font-normal tabular-nums">{list.length}</span>
                            </div>
                            {list.map((t) => (
                              <button
                                key={t.id}
                                onClick={() => applyTemplate(t)}
                                title={t.subject ? `${cs.posta.sablony.predmetPrefix}${t.subject}` : undefined}
                                className="flex w-full items-start gap-2 px-3 py-1.5 text-left text-[12.5px] leading-snug transition-colors hover:bg-accent"
                              >
                                <span className="min-w-0 flex-1 break-words">{t.name}</span>
                                {t.useCount ? (
                                  <span className="shrink-0 text-[10.5px] tabular-nums text-muted-foreground">
                                    {t.useCount}×
                                  </span>
                                ) : null}
                              </button>
                            ))}
                          </div>
                        ));
                    })()
                  )}
                </div>
                {onSaveTemplate && (
                  <>
                    <Separator />
                    <div className="shrink-0 p-1">
                      <button
                        onClick={() => {
                          setTemplatePopoverOpen(false);
                          setSaveTemplateOpen(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                      >
                        <Plus className="h-3 w-3 text-muted-foreground" />
                        {cs.posta.psani.ulozitJakoSablonu}…
                      </button>
                      <button
                        onClick={() => {
                          setTemplatePopoverOpen(false);
                          setTemplatesOpen(true);
                        }}
                        className="flex w-full items-center gap-2 rounded-sm px-3 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                      >
                        <Settings className="h-3 w-3 text-muted-foreground" />
                        {cs.posta.psani.spravovatSablony}
                      </button>
                    </div>
                  </>
                )}
              </PopoverContent>
            </Popover>
          </div>
        )}
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden px-3 pb-2">
        <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <EmailRichEditor
            compact
            minHeightClass={bodyMinHeightClass}
            defaultContent={initialContent}
            onUpdate={(html) => {
              bodyHtmlRef.current = html;
              scheduleBodyChange(html);
            }}
            onFilesAdded={onUploadAttachment ? (files) => void addFiles(files) : undefined}
            editorRef={editorRef}
          />
        </div>
        {attachments.length > 0 && (
          <div className="mt-2 flex flex-shrink-0 flex-wrap gap-2">
            {attachments.map((att) => (
              <div
                key={att.key}
                className={
                  att.error
                    ? "flex items-center gap-1.5 rounded-md border border-destructive/40 bg-destructive/5 px-2 py-1 text-xs"
                    : "flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2 py-1 text-xs"
                }
                title={att.error}
              >
                {att.upload || att.error ? (
                  <FileIcon className="h-3.5 w-3.5 text-muted-foreground" />
                ) : (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" aria-label={cs.posta.psani.nahravamPrilohu} />
                )}
                <span className="max-w-[150px] truncate">{att.name}</span>
                <span className="text-muted-foreground">({formatFileSize(att.size)})</span>
                <button
                  type="button"
                  onClick={() => removeAttachment(att.key)}
                  className="ml-0.5 text-muted-foreground transition-colors hover:text-destructive"
                  aria-label={cs.posta.psani.odebratPrilohu}
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-shrink-0 items-center gap-2 border-t border-border bg-background px-3 py-2">
        <Button onClick={handleSend} disabled={sending || uploading || to.length === 0} size="sm">
          {sending ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Send className="mr-1.5 h-3.5 w-3.5" />}
          {cs.posta.psani.odeslat}
        </Button>
        {!forwardOf && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => fileInputRef.current?.click()}
            disabled={!onUploadAttachment}
            title={onUploadAttachment ? cs.posta.psani.pridatPrilohu : cs.posta.psani.prilohyNejsouKDispozici}
          >
            <Paperclip className="h-4 w-4" />
          </Button>
        )}
        {onSaveTemplate && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setSaveTemplateOpen(true)}
            title={cs.posta.psani.ulozitJakoSablonu}
          >
            <Save className="h-4 w-4" />
          </Button>
        )}
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFilesSelected} />
      </div>

      {templates && (
        <EmailTemplatesDialog
          open={templatesOpen}
          onOpenChange={setTemplatesOpen}
          templates={templates}
          onUseTemplate={applyTemplate}
          onSave={onSaveTemplate}
          onDelete={onDeleteTemplate}
        />
      )}

      {onSaveTemplate && (
        <SaveAsTemplateDialog
          open={saveTemplateOpen}
          onOpenChange={setSaveTemplateOpen}
          subject={subject}
          bodyHtml={bodyForTemplate()}
          onSave={(draft) => onSaveTemplate(draft)}
        />
      )}
    </div>
  );
}

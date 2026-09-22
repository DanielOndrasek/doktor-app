import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { format } from "date-fns";
import { cs as csLocale } from "date-fns/locale";
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FolderInput,
  Forward,
  Loader2,
  Mail,
  MailOpen,
  Paperclip,
  PenSquare,
  RefreshCw,
  Reply,
  Search,
  Undo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from "@/components/ui/resizable";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";
import { avatarColorClass, emailInitials, parseEmailFromHeader, plainTextToEditorHtml, sanitizeEmailHtml, textToHtml } from "@/lib/email/html";
import type { TriageItem } from "@/lib/items";
import { attachmentPreviewKind, downloadFromUrl, type AttachmentPreviewKind } from "@/lib/email/attachments";
import type { ThreadMessage } from "@/lib/email/thread";
import type {
  MailAttachmentMeta,
  MailFolderRef,
  MailListMessage,
  MailMessageDetail,
  MailboxClient,
} from "@/lib/email/types";
import { EmailListItem } from "./EmailListItem";
import { EmailCompose, type EmailComposeSharedProps } from "./EmailCompose";
import { EmailFolderNav, EmailFolderTabs } from "./EmailFolderNav";
import { emailFoldersFor, type EmailFolder } from "./emailFolders";

function formatDetailDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return `${cs.posta.detail.dnes} ${format(d, "HH:mm")}`;
  }
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) {
    return `${cs.posta.detail.vcera} ${format(d, "HH:mm")}`;
  }
  return format(d, "d. MMMM yyyy, HH:mm", { locale: csLocale });
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface EmailInboxProps {
  /** Schránka, nad kterou obrazovka běží. `null` = zatím žádná není propojená. */
  mailbox: MailboxClient | null;
  /** Co okno psaní potřebuje zvenčí (podpis, adresář, šablony, přílohy, odeslání). */
  compose: EmailComposeSharedProps;
  /**
   * Krátkodobý odkaz na přílohu (engine, `mail_priloha_odkaz`). Nad ním stojí
   * náhled, stažení i „Stáhnout vše"; obrazovka bajty nedrží a base64
   * nedekóduje (pravidlo 2 v `CLAUDE.md`). Bez propu jsou přílohy jen k vidění.
   */
  attachmentUrl?: (message: MailMessageDetail, attachment: MailAttachmentMeta) => Promise<string>;
  /** Ostatní zprávy vlákna k otevřené zprávě (engine `mail_thread`); bez propu se vlákno neukazuje. */
  loadThread?: (message: MailMessageDetail) => Promise<ThreadMessage[]>;
  /** Pole triage z `polozky` k refům v seznamu (K3.2); bez propu seznam ukazuje jen úryvky. */
  loadItems?: (refs: string[]) => Promise<Map<string, TriageItem>>;
  /** Položka k otevřené zprávě podle Message-ID (návrh odpovědi, rozepsaný text). */
  itemForMessage?: (message: MailMessageDetail) => Promise<TriageItem | null>;
  /** Po přesunu do Vyřízeno (stav položky `hotovo`, `stav_zdroj = klik`); `newRef` = `novy_ref` enginu. */
  onArchived?: (message: MailListMessage, newRef?: string) => void;
  /** Po návratu z Vyřízeno do Doručených (stav položky `nove`). */
  onRestored?: (messageId: string) => void;
  /**
   * Kontext k otevřené zprávě (kontakt, historie, úkoly). Řádek „Kontext
   * u e-mailu" ho sem zapojí, aniž by tuhle obrazovku měnil.
   */
  renderContext?: (detail: MailMessageDetail) => ReactNode;
}

/**
 * Obrazovka schránky: složky · seznam · detail. Převzato z vividbooks CRM
 * (`831f9ae6`).
 *
 * Odstřižené a proč:
 * - `useMailbox` (hook nad `crm` tabulkami účtů) → prop `mailbox`,
 * - `CrmEmailContext` → slot `renderContext` (vlastní řádek převzetí),
 * - `trashMessage`, `createFolder`, `deleteFolder` a jejich tlačítka
 *   → pravidlo 3 v `CLAUDE.md`, nic se nemaže,
 * - stažení přílohy dekódováním base64 v prohlížeči → prop `attachmentUrl`
 *   (podepsaný odkaz enginu; náhled a stažení jsou nad ním),
 * - `sonner` → `useToast` z převzatého kitu,
 * - `emailWallUtils` → `lib/email/html.ts`.
 */
export function EmailInbox({
  mailbox,
  compose,
  attachmentUrl,
  loadThread,
  loadItems,
  itemForMessage,
  onArchived,
  onRestored,
  renderContext,
}: EmailInboxProps) {
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const [emails, setEmails] = useState<MailListMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [appliedQuery, setAppliedQuery] = useState("");
  const [nextPageToken, setNextPageToken] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeFolder, setActiveFolder] = useState("inbox");
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<MailMessageDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Pole triage (K3.2): položky k refům v seznamu a položka k otevřené zprávě.
  const [items, setItems] = useState<Map<string, TriageItem>>(() => new Map());
  const [detailItem, setDetailItem] = useState<TriageItem | null>(null);
  const refreshItems = useCallback(
    (messages: MailListMessage[]) => {
      if (!loadItems || !messages.length) return;
      loadItems(messages.map((m) => m.id))
        .then((found) => setItems((prev) => new Map([...prev, ...found])))
        .catch((err: unknown) => console.error(cs.posta.chyby.nacteniSeznamu, err));
    },
    [loadItems],
  );

  const [composing, setComposing] = useState(false);
  const [replyData, setReplyData] = useState<{
    to: string;
    subject: string;
    threadId: string;
    inReplyTo: string;
    references: string;
    /** Předvyplněné tělo: rozepsaný text uživatele (E3), jinak návrh z běhu. */
    body?: string;
    /** Adresa naší schránky, do které zpráva přišla (předvolba „Odeslat z", pravidlo 8). */
    arrivedAt?: string;
  } | null>(null);

  /** Do které z našich schránek zpráva přišla — podle adres v „Komu". */
  const arrivedAt = (d: MailMessageDetail): string | undefined => {
    const to = d.to.toLowerCase();
    return compose.senders?.find((s) => to.includes(s.address.toLowerCase()))?.address;
  };

  // Rozložení schránky: které standardní složky server nabízí a vlastní složky.
  const [standardFolderIds, setStandardFolderIds] = useState<string[]>(["inbox"]);
  const [customFolders, setCustomFolders] = useState<MailFolderRef[]>([]);

  const folders = useMemo(() => emailFoldersFor(standardFolderIds), [standardFolderIds]);

  const errorMessage = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

  const fetchFolders = useCallback(async () => {
    if (!mailbox) return;
    try {
      const layout = await mailbox.listFolders();
      setStandardFolderIds(layout.standardFolderIds);
      setCustomFolders(layout.folders);
    } catch (err) {
      console.error(cs.posta.chyby.nacteniSlozek, err);
    }
  }, [mailbox]);

  useEffect(() => {
    void fetchFolders();
  }, [fetchFolders]);

  const handleMoveToFolder = async (messageId: string, folderId: string, folderName: string) => {
    if (!mailbox) return;
    try {
      await mailbox.moveToFolder(messageId, folderId);
      toast({ title: `${cs.posta.presunuto} „${folderName}"` });
      if (folderId === "inbox" && activeFolder === "archive") onRestored?.(messageId);
      // Zpráva opustila právě zobrazenou složku — ze seznamu pryč (i návrat z Vyřízeno do Doručených).
      if (activeFolder !== folderId) {
        setEmails((prev) => prev.filter((e) => e.id !== messageId));
        if (selectedId === messageId) {
          setSelectedId(null);
          setDetail(null);
        }
      }
    } catch (err) {
      toast({ title: errorMessage(err, cs.posta.chyby.presun), variant: "destructive" });
    }
  };

  /* „Vrátit zpět" (kontrakt t22, `docs/prevzato/README.md`): po Vyřízeno běží 10 s odpočet
   * a schránka o ničem neví. Teprve po něm jde `archiveMessage` (engine `mail_move`, vrací
   * `novy_ref`). Vrácení během odpočtu nevolá schránku vůbec; selhání přesunu vrátí zprávu
   * do seznamu a chybu ukáže — nic se nepředstírá. Stav položky (`polozky.stav`) přibude,
   * až běh položky naplní. */
  const UNDO_SECONDS = 10;
  const [pendingDone, setPendingDone] = useState<{ message: MailListMessage; secondsLeft: number } | null>(null);
  const pendingRef = useRef<{ message: MailListMessage; index: number; tick: number; fire: number } | null>(null);

  const restoreMessage = (message: MailListMessage, index: number) =>
    setEmails((prev) => (prev.some((e) => e.id === message.id) ? prev : [...prev.slice(0, index), message, ...prev.slice(index)]));

  const clearPending = () => {
    if (pendingRef.current) {
      window.clearInterval(pendingRef.current.tick);
      window.clearTimeout(pendingRef.current.fire);
      pendingRef.current = null;
    }
    setPendingDone(null);
  };

  const performDone = async (message: MailListMessage, index: number) => {
    if (!mailbox) return;
    try {
      // Engine vrací `novy_ref` (ÚKOL 35) — položka si ho zapíše do `ref_cache`.
      const withMove = mailbox as MailboxClient & { moveMessage?: (id: string, folderId: string) => Promise<{ newRef: string }> };
      const newRef = withMove.moveMessage ? (await withMove.moveMessage(message.id, "archive")).newRef : (await mailbox.archiveMessage(message.id), undefined);
      onArchived?.(message, newRef);
    } catch (err) {
      restoreMessage(message, index);
      toast({ title: errorMessage(err, cs.posta.vyrizeno.presunSelhal), variant: "destructive" });
    }
  };

  /** Odpočet doběhne hned — druhé Vyřízeno během prvního, nebo odchod z obrazovky. */
  const flushPending = () => {
    const p = pendingRef.current;
    if (!p) return;
    clearPending();
    void performDone(p.message, p.index);
  };

  const handleDone = (message: MailListMessage) => {
    if (!mailbox) return;
    flushPending();
    const index = Math.max(0, emails.findIndex((e) => e.id === message.id));
    setEmails((prev) => prev.filter((e) => e.id !== message.id));
    if (selectedId === message.id) {
      setSelectedId(null);
      setDetail(null);
    }
    const tick = window.setInterval(
      () => setPendingDone((p) => (p ? { ...p, secondsLeft: Math.max(0, p.secondsLeft - 1) } : p)),
      1000,
    );
    const fire = window.setTimeout(() => {
      const p = pendingRef.current;
      clearPending();
      if (p) void performDone(p.message, p.index);
    }, UNDO_SECONDS * 1000);
    pendingRef.current = { message, index, tick, fire };
    setPendingDone({ message, secondsLeft: UNDO_SECONDS });
  };

  const undoDone = () => {
    const p = pendingRef.current;
    if (!p) return;
    clearPending();
    restoreMessage(p.message, p.index);
    toast({ title: cs.posta.vyrizeno.vraceno });
  };

  // Odchod z obrazovky během odpočtu: přesun proběhne hned, ať se odškrtnutí neztratí.
  useEffect(
    () => () => {
      flushPending();
    },
    // `flushPending` čte z refu; stačí zavěsit jednou.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /** Detail zná jen `MailMessageDetail`; pro odpočet stačí hlavička ze seznamu, nebo z detailu. */
  const asListMessage = (d: MailMessageDetail): MailListMessage =>
    emails.find((e) => e.id === d.id) ?? {
      id: d.id,
      threadId: d.threadId,
      snippet: "",
      from: d.from,
      to: d.to,
      subject: d.subject,
      date: d.date,
      internalDate: d.internalDate,
      labelIds: d.labelIds,
    };

  const fetchEmails = useCallback(
    async (folderId?: string, search?: string, pageToken?: string) => {
      if (!mailbox) {
        setLoading(false);
        return;
      }
      const isMore = !!pageToken;
      if (isMore) setLoadingMore(true);
      else setLoading(true);

      try {
        const page = await mailbox.listMessages({
          folderId: folderId || activeFolder,
          search,
          unreadOnly: showUnreadOnly,
          pageToken,
          maxResults: 30,
        });

        if (isMore) setEmails((prev) => [...prev, ...page.emails]);
        else setEmails(page.emails);
        setNextPageToken(page.nextPageToken);
        refreshItems(page.emails);
      } catch (err) {
        console.error(cs.posta.chyby.nacteniSeznamu, err);
        toast({ title: errorMessage(err, cs.posta.chyby.nacteniSeznamu), variant: "destructive" });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeFolder, mailbox, showUnreadOnly, toast, refreshItems],
  );

  useEffect(() => {
    void fetchEmails();
  }, [fetchEmails]);

  // Pravidelné obnovení seznamu; jen první stránka, ať se nepřepíše donačtené.
  useEffect(() => {
    if (!mailbox) return;
    const interval = setInterval(() => {
      mailbox
        .listMessages({
          folderId: activeFolder,
          search: appliedQuery || undefined,
          unreadOnly: showUnreadOnly,
          maxResults: 30,
        })
        .then((page) => {
          setEmails(page.emails);
          setNextPageToken(page.nextPageToken);
          refreshItems(page.emails);
        })
        .catch((err: unknown) => {
          // Automatické obnovení nesmí zahlcovat uživatele hláškami.
          console.error(cs.posta.chyby.nacteniSeznamu, err);
        });
    }, 60000);
    return () => clearInterval(interval);
  }, [activeFolder, appliedQuery, mailbox, showUnreadOnly, refreshItems]);

  const handleSearch = () => {
    setAppliedQuery(searchQuery);
    setSelectedId(null);
    setDetail(null);
    void fetchEmails(activeFolder, searchQuery);
  };

  const handleFolderChange = (folder: EmailFolder) => {
    setActiveFolder(folder.id);
    setEmails([]);
    setSelectedId(null);
    setDetail(null);
    setNextPageToken(null);
    setComposing(false);
    setReplyData(null);
    void fetchEmails(folder.id, appliedQuery);
  };

  const markAsRead = useCallback(
    (messageId: string) => {
      setEmails((prev) =>
        prev.map((e) =>
          e.id === messageId ? { ...e, labelIds: e.labelIds.filter((l) => l !== "UNREAD") } : e,
        ),
      );
      mailbox?.setRead(messageId, true).catch((err: unknown) => {
        // Značku vrátíme zpět, aby seznam neukazoval přečtené, které přečtené není.
        setEmails((prev) =>
          prev.map((e) =>
            e.id === messageId && !e.labelIds.includes("UNREAD")
              ? { ...e, labelIds: [...e.labelIds, "UNREAD"] }
              : e,
          ),
        );
        console.error(cs.posta.chyby.oznaceni, err);
      });
    },
    [mailbox],
  );

  const handleSelectEmail = async (email: MailListMessage) => {
    setSelectedId(email.id);
    setComposing(false);
    setReplyData(null);
    setLoadingDetail(true);
    if (email.labelIds.includes("UNREAD")) {
      markAsRead(email.id);
    }
    try {
      if (!mailbox) throw new Error(cs.posta.chyby.bezSchranky);
      const loaded = await mailbox.getMessage(email.id);
      setDetail(loaded);
      // Položka k detailu podle Message-ID (spolehlivější než ref); záložně z mapy seznamu.
      setDetailItem(items.get(email.id) ?? null);
      if (itemForMessage) {
        itemForMessage(loaded)
          .then((item) => setDetailItem((prev) => item ?? prev))
          .catch(() => undefined);
      }
    } catch (err) {
      console.error(cs.posta.chyby.nacteniZpravy, err);
      toast({ title: errorMessage(err, cs.posta.chyby.nacteniZpravy), variant: "destructive" });
      setSelectedId(null);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleReply = () => {
    if (!detail) return;
    const { email: fromEmail } = parseEmailFromHeader(detail.from);
    // Rozepsaný text uživatele má přednost před návrhem z běhu (E3 v kontrolním seznamu).
    const item = detailItem?.messageId === detail.messageId ? detailItem : null;
    const body = item?.userDraft?.trim() ? item.userDraft : item?.draftBody?.trim() ? plainTextToEditorHtml(item.draftBody) : undefined;
    const subject = item?.draftSubject?.trim() || (detail.subject.startsWith("Re:") ? detail.subject : `Re: ${detail.subject}`);
    setReplyData({
      to: fromEmail,
      subject,
      threadId: detail.threadId,
      inReplyTo: detail.messageId,
      references: detail.messageId,
      arrivedAt: arrivedAt(detail),
      body,
    });
    setComposing(true);
  };

  const handleForward = () => {
    if (!detail) return;
    setReplyData({
      to: "",
      subject: detail.subject.startsWith("Fwd:") ? detail.subject : `Fwd: ${detail.subject}`,
      threadId: detail.threadId,
      inReplyTo: detail.messageId,
      references: detail.messageId,
      arrivedAt: arrivedAt(detail),
    });
    setComposing(true);
  };

  const handleMarkUnreadById = useCallback(
    async (messageId: string) => {
      if (!mailbox) return;
      try {
        await mailbox.setRead(messageId, false);
        setEmails((prev) =>
          prev.map((e) =>
            e.id === messageId && !e.labelIds.includes("UNREAD")
              ? { ...e, labelIds: [...e.labelIds, "UNREAD"] }
              : e,
          ),
        );
      } catch (err) {
        toast({ title: errorMessage(err, cs.posta.chyby.oznaceni), variant: "destructive" });
      }
    },
    [mailbox, toast],
  );

  const handleBack = () => {
    setSelectedId(null);
    setDetail(null);
    setComposing(false);
    setReplyData(null);
  };

  const handleMarkUnread = async () => {
    if (!selectedId || selectedId === "compose") return;
    await handleMarkUnreadById(selectedId);
    handleBack();
  };

  const handleNewEmail = () => {
    setReplyData(null);
    setComposing(true);
    if (isMobile) {
      setSelectedId("compose");
    }
  };

  const composeView = (
    <EmailCompose
      {...compose}
      defaultTo={replyData?.to}
      defaultSubject={replyData?.subject}
      defaultBody={replyData?.body}
      threadId={replyData?.threadId}
      inReplyTo={replyData?.inReplyTo}
      references={replyData?.references}
      replyMailbox={replyData?.arrivedAt}
      onClose={() => {
        setComposing(false);
        setReplyData(null);
        if (isMobile) handleBack();
      }}
      onSent={() => void fetchEmails(activeFolder, appliedQuery)}
    />
  );

  const detailView = detail ? (
    <DetailView
      detail={detail}
      onReply={handleReply}
      onForward={handleForward}
      onMarkUnread={handleMarkUnread}
      customFolders={customFolders}
      onMoveToFolder={handleMoveToFolder}
      folderId={activeFolder}
      onDone={activeFolder !== "archive" ? () => handleDone(asListMessage(detail)) : undefined}
      onRestore={activeFolder === "archive" ? () => handleMoveToFolder(detail.id, "inbox", cs.posta.slozky.inbox) : undefined}
      item={detailItem?.messageId === detail.messageId ? detailItem : (items.get(detail.id) ?? null)}
      attachmentUrl={attachmentUrl}
      loadThread={loadThread}
      renderContext={renderContext}
    />
  ) : null;

  const undoBar = pendingDone ? (
    <div role="status" className="flex flex-shrink-0 items-center gap-3 border-t border-border bg-muted/60 px-4 py-2 text-sm">
      <Check className="h-4 w-4 flex-shrink-0 text-success" aria-hidden />
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium">{cs.posta.vyrizeno.lista}</span>
        <span className="text-muted-foreground"> · {pendingDone.message.subject || cs.posta.seznam.bezPredmetu}</span>
      </span>
      <Button variant="outline" size="sm" className="h-7" onClick={undoDone}>
        <Undo2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
        {cs.posta.vyrizeno.vratitZpet}
        <span className="ml-1.5 tabular-nums text-muted-foreground">{cs.posta.vyrizeno.odpocet(pendingDone.secondsLeft)}</span>
      </Button>
    </div>
  ) : null;

  // Mobil: detail nebo psaní zprávy přes celou obrazovku.
  if (isMobile && (selectedId || composing)) {
    if (composing) {
      return (
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 border-b border-border px-4 py-3">
            <Button variant="ghost" size="icon" onClick={handleBack}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <span className="font-semibold text-foreground">
              {replyData ? cs.posta.psani.odpoved : cs.posta.psani.novy}
            </span>
          </div>
          <div className="flex-1">{composeView}</div>
        </div>
      );
    }

    return (
      <div className="flex h-full flex-col">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <Button variant="ghost" size="icon" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <span className="flex-1 truncate font-semibold text-foreground">
            {detail?.subject || cs.posta.seznam.nacitani}
          </span>
        </div>
        <div className="flex-1 overflow-auto">
          {loadingDetail ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : (
            detailView
          )}
        </div>
      </div>
    );
  }

  const listPanel = (
    <div className="flex h-full flex-col">
      {isMobile && <EmailFolderTabs activeFolder={activeFolder} folders={folders} onFolderChange={handleFolderChange} />}
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder={cs.posta.seznam.hledat}
            className="h-9 pl-9"
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={showUnreadOnly ? "default" : "ghost"}
              size="icon"
              onClick={() => {
                setShowUnreadOnly((prev) => !prev);
                setSelectedId(null);
                setDetail(null);
                setEmails([]);
              }}
              className="flex-shrink-0"
            >
              {showUnreadOnly ? <MailOpen className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{showUnreadOnly ? cs.posta.seznam.vsechny : cs.posta.seznam.pouzeNeprectene}</TooltipContent>
        </Tooltip>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void fetchEmails(activeFolder, appliedQuery)}
          className="flex-shrink-0"
          title={cs.posta.seznam.obnovit}
        >
          <RefreshCw className="h-4 w-4" />
        </Button>
        {isMobile && (
          <Button size="sm" onClick={handleNewEmail} className="flex-shrink-0">
            <PenSquare className="h-4 w-4" />
          </Button>
        )}
      </div>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="space-y-4 p-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-9 w-9 flex-shrink-0 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-3 w-full" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        ) : emails.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            {mailbox ? cs.posta.seznam.zadneEmaily : cs.posta.chyby.bezSchranky}
          </div>
        ) : (
          <>
            {emails.map((email) => (
              <EmailListItem
                key={email.id}
                id={email.id}
                from={email.from}
                subject={email.subject}
                snippet={email.snippet}
                date={email.date}
                internalDate={email.internalDate}
                isUnread={email.labelIds.includes("UNREAD")}
                isSelected={selectedId === email.id}
                onClick={() => void handleSelectEmail(email)}
                onMarkUnread={() => void handleMarkUnreadById(email.id)}
                onDone={activeFolder !== "archive" ? () => handleDone(email) : undefined}
                priority={items.get(email.id)?.priority}
                stateLabel={items.get(email.id)?.state === "ceka" ? cs.posta.triage.stavy.ceka : null}
                toDo={items.get(email.id)?.toDo}
              />
            ))}
            {nextPageToken && (
              <div className="p-4 text-center">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => void fetchEmails(activeFolder, appliedQuery, nextPageToken)}
                  disabled={loadingMore}
                >
                  {loadingMore ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {cs.posta.seznam.nacistDalsi}
                </Button>
              </div>
            )}
          </>
        )}
      </ScrollArea>
      {undoBar}
    </div>
  );

  const detailPanel = (
    <div className="flex h-full flex-col">
      {composing ? (
        composeView
      ) : selectedId && loadingDetail ? (
        <div className="space-y-3 p-6">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : detail ? (
        detailView
      ) : (
        <div className="flex flex-1 items-center justify-center text-muted-foreground">
          {cs.posta.seznam.vyberEmail}
        </div>
      )}
    </div>
  );

  if (isMobile) {
    return listPanel;
  }

  return (
    <div className="flex h-full">
      <div className="w-[180px] flex-shrink-0 border-r border-border">
        <EmailFolderNav
          activeFolder={activeFolder}
          folders={folders}
          onFolderChange={handleFolderChange}
          onNewEmail={handleNewEmail}
          customFolders={customFolders}
        />
      </div>
      <div className="min-w-0 flex-1">
        <ResizablePanelGroup direction="horizontal" className="h-full">
          <ResizablePanel defaultSize={38} minSize={25}>
            {listPanel}
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={62} minSize={30}>
            {detailPanel}
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
}

// --- Detail zprávy v iframe ---

function DetailView({
  detail,
  onReply,
  onForward,
  onMarkUnread,
  customFolders,
  onMoveToFolder,
  folderId,
  onDone,
  onRestore,
  item,
  attachmentUrl,
  loadThread,
  renderContext,
}: {
  detail: MailMessageDetail;
  onReply: () => void;
  onForward: () => void;
  onMarkUnread: () => void;
  customFolders: MailFolderRef[];
  onMoveToFolder: (messageId: string, folderId: string, folderName: string) => Promise<void>;
  /** Složka, ve které je zpráva otevřená — ve Vyřízeno je místo ✓ „Vrátit mezi otevřené". */
  folderId: string;
  onDone?: () => void;
  onRestore?: () => Promise<void>;
  /** Položka z běhu (priorita, kategorie, co řešit, návrh) — `null`, když běh zprávu ještě neviděl. */
  item?: TriageItem | null;
  attachmentUrl?: (message: MailMessageDetail, attachment: MailAttachmentMeta) => Promise<string>;
  loadThread?: (message: MailMessageDetail) => Promise<ThreadMessage[]>;
  renderContext?: (detail: MailMessageDetail) => ReactNode;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { toast } = useToast();
  const { displayName, email } = parseEmailFromHeader(detail.from);

  // Vlákno: ostatní zprávy chronologicky, sbalené; otevřená zpráva je v něm jen značka.
  const [thread, setThread] = useState<ThreadMessage[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    let cancelled = false;
    setThread([]);
    setExpanded(new Set());
    if (!loadThread) return;
    loadThread(detail)
      .then((messages) => {
        if (!cancelled) setThread(messages);
      })
      .catch(() => {
        // Vlákno je doplněk: když ho engine nedá (Gmail, výpadek), zpráva se ukáže bez něj.
        if (!cancelled) setThread([]);
      });
    return () => {
      cancelled = true;
    };
  }, [detail, loadThread]);
  const toggleExpanded = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Přílohy: náhled (PDF, obrázek, text) v dialogu, jinak stažení; „Stáhnout vše" po jedné.
  const [preview, setPreview] = useState<{ att: MailAttachmentMeta; url: string; kind: AttachmentPreviewKind } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const attachmentFailed = (err: unknown) =>
    toast({ title: cs.posta.detail.stazeniSelhalo, description: err instanceof Error ? err.message : undefined, variant: "destructive" });

  const downloadAttachment = async (att: MailAttachmentMeta) => {
    if (!attachmentUrl) return;
    setBusy(att.attachmentId);
    try {
      await downloadFromUrl(await attachmentUrl(detail, att), att.filename);
    } catch (err) {
      attachmentFailed(err);
    } finally {
      setBusy(null);
    }
  };

  const openAttachment = async (att: MailAttachmentMeta) => {
    if (!attachmentUrl) return;
    const kind = attachmentPreviewKind(att.mimeType);
    if (!kind) return downloadAttachment(att);
    setBusy(att.attachmentId);
    try {
      setPreview({ att, url: await attachmentUrl(detail, att), kind });
    } catch (err) {
      attachmentFailed(err);
    } finally {
      setBusy(null);
    }
  };

  const downloadAll = async () => {
    if (!attachmentUrl) return;
    setBusy("all");
    try {
      // Po jedné, ne najednou: prohlížeč se u druhého stažení zeptá na povolení.
      for (const att of detail.attachments ?? []) {
        await downloadFromUrl(await attachmentUrl(detail, att), att.filename);
      }
    } catch (err) {
      attachmentFailed(err);
    } finally {
      setBusy(null);
    }
  };

  const handleIframeLoad = () => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    try {
      const doc = iframe.contentDocument;
      if (doc) {
        iframe.style.height = doc.body.scrollHeight + 32 + "px";
      }
    } catch {
      iframe.style.height = "600px";
    }
  };

  // Prostý text (zpráva bez HTML části) by se v iframu slil do jednoho odstavce —
  // převádí se se zachovaným zalomením a klikacími odkazy. Odkazy se otvírají
  // v nové kartě (`<base target>`), sandbox to dovoluje jen přes popup.
  const bodyHtml = detail.bodyType === "html" ? sanitizeEmailHtml(detail.body) : textToHtml(detail.body);
  const srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><base target="_blank"><style>body{margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;background:#fff;font-size:14px;line-height:1.6;word-wrap:break-word;overflow-wrap:break-word;max-width:100%;overflow-x:hidden}img{max-width:100%;height:auto}a{color:#1a73e8}table{max-width:100%!important}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #ddd;color:#555}</style></head><body>${bodyHtml}</body></html>`;

  const attachments = detail.attachments || [];

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border px-6 py-4">
        <h2 className="mb-3 text-lg font-semibold text-foreground">{detail.subject || cs.posta.seznam.bezPredmetu}</h2>
        <div className="flex items-start gap-3">
          <div
            className={cn(
              "flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full text-sm font-semibold",
              avatarColorClass(email || displayName),
            )}
          >
            {emailInitials(displayName, email)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-sm font-medium text-foreground">{displayName}</span>
              {email && <span className="truncate text-xs text-muted-foreground">&lt;{email}&gt;</span>}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground">
              {cs.posta.detail.komu} {detail.to}
            </div>
            <div className="mt-0.5 text-xs text-muted-foreground" title={detail.date}>
              {formatDetailDate(detail.date)}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-auto px-6 py-4">
        {item && (item.priority || item.category || item.toDo || item.draftBody || item.userDraft) ? (
          <div className="mb-3 space-y-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-xs">
            <div className="flex flex-wrap items-center gap-2">
              {item.priority ? (
                <span
                  className={cn(
                    "rounded px-1.5 py-0.5 font-semibold",
                    item.priority === 1 ? "bg-destructive/15 text-destructive" : item.priority === 2 ? "bg-warning/20 text-warning-foreground" : "bg-muted text-muted-foreground",
                  )}
                >
                  {cs.posta.triage.priorita(item.priority)}
                </span>
              ) : null}
              {item.category ? <span className="text-muted-foreground">{item.category}</span> : null}
              <span className="rounded bg-secondary/15 px-1.5 py-0.5 font-medium text-secondary">{cs.posta.triage.stavy[item.state] ?? item.state}</span>
            </div>
            {item.toDo ? (
              <p className="text-foreground">
                <span className="font-medium text-foreground/80">{cs.posta.triage.coResit}: </span>
                {item.toDo}
              </p>
            ) : null}
            {item.userDraft?.trim() ? (
              <p className="text-muted-foreground">{cs.posta.triage.rozepsano}</p>
            ) : item.draftBody?.trim() ? (
              <p className="text-muted-foreground">{cs.posta.triage.navrhPripraven}</p>
            ) : null}
          </div>
        ) : null}
        {renderContext && <div className="mb-3">{renderContext(detail)}</div>}

        {thread.length > 1 && (
          <div className="mb-4 rounded-lg border border-border">
            <div className="border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {cs.posta.detail.vlakno} ({thread.length})
            </div>
            <ol className="divide-y divide-border">
              {thread.map((m) => {
                const current = m.id === detail.id;
                const who = parseEmailFromHeader(m.from);
                const open = expanded.has(m.id);
                return (
                  <li key={m.id} className={cn("text-sm", current && "bg-muted/40")}>
                    <button
                      type="button"
                      onClick={() => !current && toggleExpanded(m.id)}
                      disabled={current}
                      aria-expanded={current ? undefined : open}
                      aria-label={current ? undefined : open ? cs.posta.detail.skryt : cs.posta.detail.zobrazit}
                      className="flex w-full items-start gap-2 px-3 py-2 text-left disabled:cursor-default"
                    >
                      {current ? (
                        <span className="mt-0.5 h-4 w-4 flex-shrink-0" />
                      ) : open ? (
                        <ChevronDown className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-muted-foreground" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="flex items-baseline gap-2">
                          <span className={cn("truncate font-medium", m.labelIds.includes("SENT") && "text-secondary")}>
                            {who.displayName}
                          </span>
                          <span className="ml-auto flex-shrink-0 text-xs text-muted-foreground" title={m.date}>
                            {formatDetailDate(m.date)}
                          </span>
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {current ? cs.posta.detail.tatoZprava : m.snippet || m.subject}
                        </span>
                      </span>
                    </button>
                    {open && !current && (
                      <div className="whitespace-pre-wrap break-words px-9 pb-3 text-sm leading-relaxed text-foreground">{m.body}</div>
                    )}
                  </li>
                );
              })}
            </ol>
          </div>
        )}

        <iframe
          ref={iframeRef}
          srcDoc={srcdoc}
          sandbox="allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          className="w-full rounded border-0"
          style={{ minHeight: "200px" }}
          onLoad={handleIframeLoad}
          title={cs.posta.detail.telo}
        />

        {attachments.length > 0 && (
          <div className="mt-4 rounded-lg border border-border p-3">
            <div className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
              <Paperclip className="h-4 w-4" />
              {cs.posta.detail.prilohy} ({attachments.length})
              {attachments.length > 1 && attachmentUrl && (
                <Button variant="outline" size="sm" className="ml-auto h-7" onClick={() => void downloadAll()} disabled={busy !== null}>
                  {busy === "all" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Download className="mr-1.5 h-3.5 w-3.5" />}
                  {cs.posta.detail.stahnoutVse}
                </Button>
              )}
            </div>
            <div className="space-y-1">
              {attachments.map((att) => (
                <div key={att.attachmentId} className="group flex items-center gap-1 rounded-md pr-1 transition-colors hover:bg-muted">
                  <button
                    onClick={() => void openAttachment(att)}
                    disabled={!attachmentUrl || busy !== null}
                    title={attachmentUrl ? (attachmentPreviewKind(att.mimeType) ? cs.posta.detail.nahledPrilohy : cs.posta.detail.stahnout) : cs.posta.detail.prilohuOtevreEngine}
                    className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2 text-left text-sm disabled:cursor-default"
                  >
                    {busy === att.attachmentId ? (
                      <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-muted-foreground" />
                    ) : (
                      <Paperclip className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground" />
                    )}
                    <span className="flex-1 truncate text-foreground">{att.filename}</span>
                    <span className="flex-shrink-0 text-xs text-muted-foreground">{formatSize(att.size)}</span>
                  </button>
                  {attachmentUrl && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 flex-shrink-0"
                      title={cs.posta.detail.stahnout}
                      aria-label={cs.posta.detail.stahnout}
                      onClick={() => void downloadAttachment(att)}
                      disabled={busy !== null}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <Dialog open={preview !== null} onOpenChange={(open) => !open && setPreview(null)}>
        <DialogContent className="flex h-[90vh] max-w-5xl flex-col gap-0 p-0">
          <DialogHeader className="px-4 pb-2 pr-12 pt-4 text-left">
            <DialogTitle className="truncate text-base">{preview?.att.filename}</DialogTitle>
            <DialogDescription>
              {preview ? `${formatSize(preview.att.size)} · ${preview.att.mimeType}` : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="min-h-0 flex-1 bg-muted">
            {preview?.kind === "image" ? (
              <img src={preview.url} alt={preview.att.filename} className="mx-auto h-full max-w-full object-contain" />
            ) : preview ? (
              <iframe src={preview.url} title={preview.att.filename} className="h-full w-full border-0 bg-background" />
            ) : null}
          </div>
          <DialogFooter className="gap-2 px-4 py-3 sm:justify-start">
            <Button variant="outline" size="sm" onClick={() => preview && void downloadAttachment(preview.att)} disabled={busy !== null}>
              <Download className="mr-1.5 h-4 w-4" />
              {cs.posta.detail.stahnout}
            </Button>
            {preview && (
              <Button variant="outline" size="sm" asChild>
                <a href={preview.url} target="_blank" rel="noopener noreferrer">
                  {cs.posta.detail.otevritVNoveKarte}
                </a>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="flex flex-wrap items-center gap-2 border-t border-border px-6 py-3">
        {folderId === "archive" && onRestore ? (
          <Button variant="outline" size="sm" onClick={() => void onRestore()}>
            <Undo2 className="mr-1.5 h-4 w-4" />
            {cs.posta.vyrizeno.vratitMeziOtevrene}
          </Button>
        ) : onDone ? (
          <Button size="sm" onClick={onDone}>
            <Check className="mr-1.5 h-4 w-4" />
            {cs.posta.vyrizeno.tlacitko}
          </Button>
        ) : null}
        <Button variant="outline" size="sm" onClick={onReply}>
          <Reply className="mr-1.5 h-4 w-4" />
          {cs.posta.detail.odpovedet}
        </Button>
        <Button variant="outline" size="sm" onClick={onForward}>
          <Forward className="mr-1.5 h-4 w-4" />
          {cs.posta.detail.preposlat}
        </Button>
        <Button variant="outline" size="sm" onClick={onMarkUnread}>
          <MailOpen className="mr-1.5 h-4 w-4" />
          {cs.posta.detail.neprectene}
        </Button>
        {customFolders.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm">
                <FolderInput className="mr-1.5 h-4 w-4" />
                {cs.posta.detail.presunout}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {customFolders.map((folder) => (
                <DropdownMenuItem key={folder.id} onClick={() => void onMoveToFolder(detail.id, folder.id, folder.name)}>
                  {folder.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

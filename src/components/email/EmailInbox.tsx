import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { format } from "date-fns";
import { cs as csLocale } from "date-fns/locale";
import {
  ArrowLeft,
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
} from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { avatarColorClass, emailInitials, parseEmailFromHeader, sanitizeEmailHtml } from "@/lib/email/html";
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
   * Otevření přílohy. Engine ji podá odkazem; obrazovka bajty nedrží a base64
   * nedekóduje (pravidlo 2 v `CLAUDE.md`). Bez propu jsou přílohy jen k vidění.
   */
  onOpenAttachment?: (message: MailMessageDetail, attachment: MailAttachmentMeta) => void;
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
 * - stažení přílohy dekódováním base64 v prohlížeči → prop `onOpenAttachment`,
 * - `sonner` → `useToast` z převzatého kitu,
 * - `emailWallUtils` → `lib/email/html.ts`.
 */
export function EmailInbox({ mailbox, compose, onOpenAttachment, renderContext }: EmailInboxProps) {
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

  const [composing, setComposing] = useState(false);
  const [replyData, setReplyData] = useState<{
    to: string;
    subject: string;
    threadId: string;
    inReplyTo: string;
    references: string;
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
      if (activeFolder === "inbox") {
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
      } catch (err) {
        console.error(cs.posta.chyby.nacteniSeznamu, err);
        toast({ title: errorMessage(err, cs.posta.chyby.nacteniSeznamu), variant: "destructive" });
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [activeFolder, mailbox, showUnreadOnly, toast],
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
        })
        .catch((err: unknown) => {
          // Automatické obnovení nesmí zahlcovat uživatele hláškami.
          console.error(cs.posta.chyby.nacteniSeznamu, err);
        });
    }, 60000);
    return () => clearInterval(interval);
  }, [activeFolder, appliedQuery, mailbox, showUnreadOnly]);

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
      setDetail(await mailbox.getMessage(email.id));
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
    setReplyData({
      to: fromEmail,
      subject: detail.subject.startsWith("Re:") ? detail.subject : `Re: ${detail.subject}`,
      threadId: detail.threadId,
      inReplyTo: detail.messageId,
      references: detail.messageId,
      arrivedAt: arrivedAt(detail),
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
      onOpenAttachment={onOpenAttachment}
      renderContext={renderContext}
    />
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
  onOpenAttachment,
  renderContext,
}: {
  detail: MailMessageDetail;
  onReply: () => void;
  onForward: () => void;
  onMarkUnread: () => void;
  customFolders: MailFolderRef[];
  onMoveToFolder: (messageId: string, folderId: string, folderName: string) => Promise<void>;
  onOpenAttachment?: (message: MailMessageDetail, attachment: MailAttachmentMeta) => void;
  renderContext?: (detail: MailMessageDetail) => ReactNode;
}) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { displayName, email } = parseEmailFromHeader(detail.from);

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

  const srcdoc = `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0;padding:16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#1a1a1a;background:#fff;font-size:14px;line-height:1.6;word-wrap:break-word;overflow-wrap:break-word;max-width:100%;overflow-x:hidden}img{max-width:100%;height:auto}a{color:#1a73e8}table{max-width:100%!important}blockquote{margin:8px 0;padding-left:12px;border-left:3px solid #ddd;color:#555}</style></head><body>${sanitizeEmailHtml(detail.body)}</body></html>`;

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
        {renderContext && <div className="mb-3">{renderContext(detail)}</div>}
        <iframe
          ref={iframeRef}
          srcDoc={srcdoc}
          sandbox="allow-same-origin"
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
            </div>
            <div className="space-y-1">
              {attachments.map((att) => (
                <button
                  key={att.attachmentId}
                  onClick={() => onOpenAttachment?.(detail, att)}
                  disabled={!onOpenAttachment}
                  title={onOpenAttachment ? undefined : cs.posta.detail.prilohuOtevreEngine}
                  className="group flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors enabled:hover:bg-muted disabled:cursor-default"
                >
                  <Paperclip className="h-4 w-4 flex-shrink-0 text-muted-foreground group-hover:text-foreground" />
                  <span className="flex-1 truncate text-foreground">{att.filename}</span>
                  <span className="flex-shrink-0 text-xs text-muted-foreground">{formatSize(att.size)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center gap-2 border-t border-border px-6 py-3">
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

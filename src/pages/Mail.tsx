import { useCallback, useMemo, useState } from "react";

import { EmailInbox } from "@/components/email/EmailInbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import { createEngineMailboxFromEnv, type EngineMailboxId } from "@/lib/email/engineMailbox";
import { getAccessToken } from "@/lib/supabase/token";

const MAILBOX_STORAGE_KEY = "doktor:posta-schranka";
const MAILBOXES: EngineMailboxId[] = ["all", "uvn", "gmail"];

function readMailbox(): EngineMailboxId {
  try {
    const v = localStorage.getItem(MAILBOX_STORAGE_KEY);
    return MAILBOXES.includes(v as EngineMailboxId) ? (v as EngineMailboxId) : "all";
  } catch {
    return "all";
  }
}

/**
 * Pošta (K3.2): sjednocená schránka s přepínačem nad `engineMailbox`.
 * Podpis, adresář, šablony a kontext přijdou, až budou jejich zdroje z K2 —
 * do té doby jsou propsy `EmailInbox` nevyplněné a obrazovka to unese.
 */
export default function Mail() {
  const { toast } = useToast();
  const [mailboxId, setMailboxId] = useState<EngineMailboxId>(readMailbox);

  // Klient je levný; nový vzniká jen při přepnutí schránky.
  const mailbox = useMemo(() => createEngineMailboxFromEnv(getAccessToken, mailboxId), [mailboxId]);

  const switchMailbox = (next: string) => {
    if (!MAILBOXES.includes(next as EngineMailboxId)) return;
    setMailboxId(next as EngineMailboxId);
    try {
      localStorage.setItem(MAILBOX_STORAGE_KEY, next);
    } catch {
      /* jen se nezapamatuje */
    }
  };

  const openAttachment = useCallback(
    async (messageId: string, attachmentIndex: string, filename: string, mimeType: string, size: number) => {
      if (!mailbox) return;
      try {
        const url = await mailbox.attachmentLink(messageId, { attachmentId: attachmentIndex, filename, mimeType, size });
        window.open(url, "_blank", "noopener");
      } catch (err) {
        toast({
          title: cs.posta.otevritPrilohuSelhalo,
          description: err instanceof Error ? err.message : undefined,
          variant: "destructive",
        });
      }
    },
    [mailbox, toast],
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-shrink-0 items-center gap-3 border-b border-border px-4 py-2">
        <span className="text-xs text-muted-foreground">{cs.posta.schranky.popisek}</span>
        <ToggleGroup type="single" size="sm" value={mailboxId} onValueChange={switchMailbox} className="rounded-lg bg-muted p-0.5">
          {MAILBOXES.map((id) => (
            <ToggleGroupItem
              key={id}
              value={id}
              className="h-7 rounded-md px-2.5 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm"
            >
              {cs.posta.schranky[id]}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {!mailbox ? <span className="ml-auto text-xs text-warning">{cs.posta.bezEngine}</span> : null}
      </div>
      <div className="min-h-0 flex-1">
        <EmailInbox
          key={mailboxId}
          mailbox={mailbox}
          compose={{
            onSend: (request) => {
              if (!mailbox) return Promise.reject(new Error(cs.posta.chyby.bezSchranky));
              return mailbox.sendWithUploads(request).then(() => undefined);
            },
            onUploadAttachment: mailbox ? (file) => mailbox.upload(file) : undefined,
          }}
          onOpenAttachment={
            mailbox
              ? (message, att) => void openAttachment(message.id, att.attachmentId, att.filename, att.mimeType, att.size)
              : undefined
          }
        />
      </div>
    </div>
  );
}

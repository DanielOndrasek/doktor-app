import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { cs as csLocale } from "date-fns/locale";

import { CONTACTS_PATH, TASKS_PATH } from "@/components/AppShell";
import { EmailContext, type EmailContextData } from "@/components/email/EmailContext";
import { EmailInbox } from "@/components/email/EmailInbox";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import { contactDisplayName, type ContactSource } from "@/lib/contacts";
import type { EmailRecipientSuggestion } from "@/lib/email/compose";
import { createEngineMailboxFromEnv, type EngineMailboxId } from "@/lib/email/engineMailbox";
import { emailSignatureToEditorHtml } from "@/lib/email/signature";
import type { MailAttachmentMeta, MailListMessage, MailMessageDetail, MailSearchFilter } from "@/lib/email/types";
import type { ClaudeWorkSource } from "@/lib/claudeProjects";
import type { ItemSource, TriageItem } from "@/lib/items";
import { loadMailboxes } from "@/lib/mailboxes";
import type { SignatureSource } from "@/lib/signatures";
import { getAccessToken } from "@/lib/supabase/token";
import { emptyTaskDraft, type TaskSource } from "@/lib/tasks";

const MAILBOX_STORAGE_KEY = "doktor:posta-schranka";
const MAILBOXES: EngineMailboxId[] = ["all", "uvn", "gmail"];
/** `/posta?polozka=<id>` — odkaz z Dnes (`dnes()`) a z přehledu běhů; otevře zprávu položky. */
const ITEM_PARAM = "polozka";

function readMailbox(): EngineMailboxId {
  try {
    const v = localStorage.getItem(MAILBOX_STORAGE_KEY);
    return MAILBOXES.includes(v as EngineMailboxId) ? (v as EngineMailboxId) : "all";
  } catch {
    return "all";
  }
}

/** Relativně („před 3 dny") s absolutním datem v `title` — konvence z CLAUDE.md. */
function formatRelative(iso: string): { label: string; title: string } {
  const d = parseISO(iso);
  if (!isValid(d)) return { label: iso, title: iso };
  return {
    label: formatDistanceToNowStrict(d, { addSuffix: true, locale: csLocale }),
    title: format(d, "d. M. yyyy HH:mm", { locale: csLocale }),
  };
}

/**
 * Pošta (K3.2): sjednocená schránka s přepínačem nad `engineMailbox`.
 * Kontext u e-mailu (K3.8) skládá z kontaktů, enginu (poslední zprávy) a úkolů;
 * „Odeslat z" ze `schranky`; našeptávač adres z adresáře. Podpisy a šablony
 * přijdou s K3.3.
 */
export default function Mail({
  contactSource,
  taskSource,
  signatureSource,
  itemSource,
  claudeWork,
}: {
  contactSource: ContactSource;
  taskSource: TaskSource;
  signatureSource: SignatureSource;
  itemSource: ItemSource;
  /** „Zeptat se": dotaz do fronty pro Clauda; odpověď se ukáže na Dnes. */
  claudeWork: ClaudeWorkSource;
}) {
  const { toast } = useToast();
  const [mailboxId, setMailboxId] = useState<EngineMailboxId>(readMailbox);

  // Klient je levný; nový vzniká jen při přepnutí schránky.
  const mailbox = useMemo(() => createEngineMailboxFromEnv(getAccessToken, mailboxId), [mailboxId]);

  // „Odeslat z": schránky z `schranky` (K3.3). Předvolba pro nový e-mail = schránka, ve které se dívám.
  const { data: mailboxes = [] } = useQuery({ queryKey: ["schranky"], queryFn: () => loadMailboxes() });
  const senders = useMemo(
    () => mailboxes.map((m) => ({ address: m.adresa, label: `${cs.posta.schranky[m.typ]} · ${m.adresa}` })),
    [mailboxes],
  );
  const ownEmails = useMemo(() => mailboxes.map((m) => m.adresa), [mailboxes]);
  const defaultSender = mailboxId === "all" ? undefined : mailboxes.find((m) => m.typ === mailboxId)?.adresa;

  // Podpis podle schránky odeslání (K3.3): výchozí podpis schránky, jinak žádný.
  // Engine `podpis_id` nedostává — podpis je v těle, jinak by ho přidal dvakrát.
  const { data: signatures = [] } = useQuery({ queryKey: ["podpisy"], queryFn: () => signatureSource.list() });
  const signatureFor = useCallback(
    (sender: string) => {
      const box = mailboxes.find((m) => m.adresa.toLowerCase() === sender.toLowerCase());
      const sig = box ? signatures.find((s) => s.defaultForMailboxId === box.id) : undefined;
      return sig ? emailSignatureToEditorHtml(sig.html) : null;
    },
    [mailboxes, signatures],
  );

  const switchMailbox = (next: string) => {
    if (!MAILBOXES.includes(next as EngineMailboxId)) return;
    setMailboxId(next as EngineMailboxId);
    try {
      localStorage.setItem(MAILBOX_STORAGE_KEY, next);
    } catch {
      /* jen se nezapamatuje */
    }
  };

  // Stabilní reference: DetailView na ní má useEffect, nová funkce při každém renderu by vlákno načítala pořád dokola.
  const loadThread = useCallback(
    (message: MailMessageDetail) => (mailbox ? mailbox.thread(message.threadId) : Promise.resolve([])),
    [mailbox],
  );

  // Podepsaný odkaz enginu (10 min); náhled a stažení nad ním dělá obrazovka.
  const attachmentUrl = useCallback(
    (message: MailMessageDetail, att: MailAttachmentMeta) => {
      if (!mailbox) return Promise.reject(new Error(cs.posta.chyby.bezSchranky));
      return mailbox.attachmentLink(message.id, att);
    },
    [mailbox],
  );

  // Kontext (K3.8): kdo to je (kontakty), poslední zprávy (engine podle adres), otevřené úkoly (ukoly).
  const loadContext = useCallback(
    async (emails: string[]): Promise<EmailContextData> => {
      const [contact, recent] = await Promise.all([
        contactSource.findByEmails(emails),
        mailbox
          ? mailbox.findByContacts({ contactEmails: emails, maxResults: 4 }).catch(() => ({ emails: [], contactEmails: emails }))
          : Promise.resolve({ emails: [], contactEmails: emails }),
      ]);
      const openTasks = contact ? await contactSource.openTasks(contact.id) : [];
      return {
        contact: contact
          ? {
              id: contact.id,
              name: contactDisplayName(contact),
              role: contact.role,
              organization: contact.organization,
              href: `${CONTACTS_PATH}?kontakt=${contact.id}`,
            }
          : null,
        recentMessages: recent.emails.map((m) => ({ id: m.id, subject: m.subject, date: m.date })),
        openTasks: openTasks.map((t) => ({ id: t.id, title: t.title, due: t.due, href: `${TASKS_PATH}?ukol=${t.id}` })),
      };
    },
    [contactSource, mailbox],
  );

  // „Úkol z mailu": zdroj `email`, vazba na kontakt; `polozka_id` přibude, až běh naplní `polozky`.
  const createTaskFromMail = useCallback(
    async ({ title, contactId }: { title: string; contactId: string | null }) => {
      await taskSource.create({ ...emptyTaskDraft("todo"), title, contactId, source: "email" });
    },
    [taskSource],
  );

  const renderContext = useCallback(
    (detail: MailMessageDetail) => (
      <EmailContext
        from={detail.from}
        to={detail.to}
        subject={detail.subject}
        ownEmails={ownEmails}
        load={loadContext}
        onCreateTask={createTaskFromMail}
        formatDate={formatRelative}
      />
    ),
    [ownEmails, loadContext, createTaskFromMail],
  );

  // Položky z běhu (K3.2): triage v seznamu podle refu, k detailu podle Message-ID.
  const loadItems = useCallback((refs: string[]) => itemSource.byRefs(refs), [itemSource]);
  const itemForMessage = useCallback((message: MailMessageDetail) => itemSource.byMessageId(message.messageId), [itemSource]);

  // Stav položky se odvozuje i z kliknutí: Vyřízeno = `hotovo`, návrat = `nove`, vždy `stav_zdroj = klik`.
  const onArchived = useCallback(
    (message: MailListMessage, newRef?: string) => {
      itemSource.setStateByRef(message.id, "hotovo", newRef).catch((err: unknown) => console.error(cs.posta.vyrizeno.presunSelhal, err));
    },
    [itemSource],
  );
  const onRestored = useCallback(
    (messageId: string) => {
      itemSource.setStateByRef(messageId, "nove").catch((err: unknown) => console.error(cs.posta.chyby.presun, err));
    },
    [itemSource],
  );

  // Rozepsaný text (E3): ukládá se k položce podle Message-ID zprávy, na kterou se odpovídá.
  const draftItemIds = useRef(new Map<string, string | null>());
  const onBodyChange = useCallback(
    (html: string, context: { inReplyTo?: string }) => {
      const messageId = context.inReplyTo;
      if (!messageId) return;
      const save = async () => {
        let itemId = draftItemIds.current.get(messageId);
        if (itemId === undefined) {
          itemId = (await itemSource.byMessageId(messageId))?.id ?? null;
          draftItemIds.current.set(messageId, itemId);
        }
        if (itemId) await itemSource.saveUserDraft(itemId, html);
      };
      save().catch((err: unknown) => console.error(cs.posta.triage.rozepsaneNeulozeno, err));
    },
    [itemSource],
  );

  // Odkaz na položku (`?polozka=`): ref se dohledá v `polozky`, obrazovka zprávu otevře a parametr se uklidí.
  const [searchParams, setSearchParams] = useSearchParams();
  const itemId = searchParams.get(ITEM_PARAM);
  const [openRef, setOpenRef] = useState<string | null>(null);
  const clearItemParam = useCallback(() => {
    setOpenRef(null);
    setSearchParams(
      (prev) => {
        prev.delete(ITEM_PARAM);
        return prev;
      },
      { replace: true },
    );
  }, [setSearchParams]);
  useEffect(() => {
    if (!itemId) return;
    let cancelled = false;
    itemSource
      .byId(itemId)
      .then((item) => {
        if (cancelled) return;
        if (item?.ref) {
          setOpenRef(item.ref);
        } else {
          toast({ title: cs.posta.chyby.polozkaBezZpravy, variant: "destructive" });
          clearItemParam();
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        toast({ title: err instanceof Error ? err.message : cs.posta.chyby.polozkaBezZpravy, variant: "destructive" });
        clearItemParam();
      });
    return () => {
      cancelled = true;
    };
  }, [itemId, itemSource, toast, clearItemParam]);

  // „Zeptat se" (kontrolní seznam plánu): otázka + kontext hledání do `fronta_claude`; nic se nevolá na model.
  const onAskClaude = useCallback(
    (question: string, context: { query: string; filter: MailSearchFilter; folderId: string }) =>
      claudeWork.ask(question, { zdroj: "posta", schranka: mailboxId, klicove_slovo: context.query || null, filtr: context.filter, slozka: context.folderId }),
    [claudeWork, mailboxId],
  );

  // „Poznámka pro Clauda" ke zprávě: do `fronta_claude` (druh poznamka) s refem, Message-ID a položkou.
  const onNoteForClaude = useCallback(
    (detail: MailMessageDetail, item: TriageItem | null, text: string) =>
      claudeWork.note(text, {
        zdroj: "posta",
        schranka: mailboxId,
        ref: detail.id,
        message_id: detail.messageId,
        predmet: detail.subject,
        od: detail.from,
        polozka_id: item?.id ?? null,
      }),
    [claudeWork, mailboxId],
  );

  // Našeptávač adres z adresáře (kontakty s e-mailem).
  const searchRecipients = useCallback(
    async (query: string): Promise<EmailRecipientSuggestion[]> => {
      if (!query.trim()) return [];
      const found = await contactSource.list(query);
      return found
        .filter((c): c is typeof c & { primaryEmail: string } => !!c.primaryEmail)
        .slice(0, 8)
        .map((c) => ({ email: c.primaryEmail, label: contactDisplayName(c), group: cs.posta.psani.skupinaKontakty }));
    },
    [contactSource],
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
            senders,
            defaultSender,
            signatureFor,
            onSearchRecipients: searchRecipients,
            onSend: async (request) => {
              if (!mailbox) throw new Error(cs.posta.chyby.bezSchranky);
              if (request.forwardOf) {
                // Přeposlání s původními přílohami dělá engine (`mail_preposlat`, `$Forwarded` na originálu).
                const fwd = await mailbox.forward({ ...request, forwardOf: request.forwardOf });
                if (!fwd.flagged) toast({ title: cs.posta.psani.preposlanoBezPriznaku });
                else if (fwd.attachments.length) toast({ title: cs.posta.psani.preposlanoSPrilohami(fwd.attachments.length) });
                if (fwd.warnings.length) toast({ title: cs.posta.odeslanoSVarovanim, description: fwd.warnings.join(" ") });
                return;
              }
              const result = await mailbox.sendWithUploads(request);
              // Např. `jina_schranka`: zpráva odešla, ale z jiné schránky (pravidlo 8) — říct to nahlas.
              if (result.warnings.length) {
                toast({ title: cs.posta.odeslanoSVarovanim, description: result.warnings.join(" ") });
              }
            },
            onUploadAttachment: mailbox ? (file) => mailbox.upload(file) : undefined,
            onBodyChange,
          }}
          attachmentUrl={mailbox ? attachmentUrl : undefined}
          loadThread={mailbox ? loadThread : undefined}
          loadItems={loadItems}
          itemForMessage={itemForMessage}
          onArchived={onArchived}
          onRestored={onRestored}
          openRef={openRef}
          onOpened={clearItemParam}
          onAskClaude={onAskClaude}
          onNoteForClaude={onNoteForClaude}
          renderContext={renderContext}
        />
      </div>
    </div>
  );
}

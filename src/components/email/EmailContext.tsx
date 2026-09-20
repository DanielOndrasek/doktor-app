import { useEffect, useMemo, useState } from "react";
import { ListTodo, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import { extractEmails } from "@/lib/email/html";

/** Kdo to je, poslední zprávy, otevřené úkoly (K3.8). Skládá volající. */
export interface EmailContextData {
  contact: {
    id: string;
    name: string;
    role?: string | null;
    organization?: string | null;
    /** Odkaz na kartu kontaktu (K4.1); bez něj je jméno prostý text. */
    href?: string;
  } | null;
  recentMessages: { id: string; subject: string; date: string; href?: string }[];
  openTasks: { id: string; title: string; due?: string | null; href?: string }[];
}

interface EmailContextProps {
  from: string;
  to: string;
  subject: string;
  /** Vlastní adresy — z hlavičky se vynechají, hledá se protistrana. */
  ownEmails?: string[];
  /** Dohledá kontext k adresám. Kde (kontakty, engine) je věc volajícího. */
  load: (emails: string[]) => Promise<EmailContextData>;
  /** Založí úkol „Vyřídit e-mail: …" u kontaktu. Bez propu tlačítko není. */
  onCreateTask?: (input: { title: string; contactId: string | null }) => Promise<void>;
  /** Format data poslední zprávy — relativně, s absolutním v `title` (volající má date-fns). */
  formatDate?: (iso: string) => { label: string; title: string };
}

/**
 * Kontext u otevřené zprávy: kdo píše, co jsme si naposledy psali, co k němu
 * visí za úkoly, a „Úkol z mailu". Zapojuje se do `EmailInbox` slotem
 * `renderContext`.
 *
 * Převzato z `components/vividbooks/CrmEmailContext.tsx` (vividbooks CRM,
 * `831f9ae6`). Tam se hledalo v Kabinetu (`v_person_list`, `v_school_list`,
 * `db_deals`) a úkol se zapisoval na zeď obchodu (`db_deal_wall_posts`) —
 * všechno schéma `crm`. Zůstal tvar (pruh nad zprávou, `extractEmails`,
 * tlačítko vpravo) a data chodí propsy `load` / `onCreateTask`. Škola, stav,
 * licence a otevřený obchod nahradily poslední zprávy a otevřené úkoly
 * (plán, K3.8).
 */
export function EmailContext({ from, to, subject, ownEmails = [], load, onCreateTask, formatDate }: EmailContextProps) {
  const { toast } = useToast();
  const [data, setData] = useState<EmailContextData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);

  const own = useMemo(() => new Set(ownEmails.map((e) => e.toLowerCase())), [ownEmails]);
  const emails = useMemo(
    () => [...extractEmails(from), ...extractEmails(to)].filter((e) => !own.has(e)),
    [from, to, own],
  );
  const emailsKey = emails.join(",");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setFailed(false);
    if (!emails.length) {
      setData({ contact: null, recentMessages: [], openTasks: [] });
      setLoading(false);
      return;
    }
    load(emails)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err: unknown) => {
        console.error(cs.kontext.nenacten, err);
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `emails` je odvozené z `from`/`to`; klíč drží efekt stabilní.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emailsKey, load]);

  const createTask = async () => {
    if (!onCreateTask) return;
    setCreating(true);
    try {
      await onCreateTask({
        title: cs.kontext.ukolNazev(subject || cs.kontext.bezPredmetu),
        contactId: data?.contact?.id ?? null,
      });
      toast({ title: cs.kontext.ukolZalozen });
    } catch (err) {
      toast({
        title: cs.kontext.ukolNezalozen,
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const label = <span className="font-semibold uppercase tracking-wider text-muted-foreground">{cs.kontext.nazev}</span>;

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
        <Loader2 className="h-3 w-3 animate-spin" /> {cs.kontext.hledam}
      </div>
    );
  }

  const taskButton = onCreateTask ? (
    <Button size="sm" variant="outline" className="ml-auto h-6 px-2 text-[11px]" disabled={creating} onClick={() => void createTask()}>
      {creating ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <ListTodo className="mr-1 h-3 w-3" />}
      {cs.kontext.ukolZMailu}
    </Button>
  ) : null;

  if (failed || !data || !data.contact) {
    return (
      <div className="flex flex-wrap items-center gap-x-2 rounded-lg border border-dashed px-3 py-2 text-xs text-muted-foreground">
        {label}
        <span className="opacity-40">·</span>
        <span>{failed ? cs.kontext.nenacten : cs.kontext.neznamy}</span>
        {taskButton}
      </div>
    );
  }

  const { contact, recentMessages, openTasks } = data;
  const linkOrText = (href: string | undefined, text: string, className = "") =>
    href ? (
      <a href={href} className={`hover:underline ${className}`}>
        {text}
      </a>
    ) : (
      <span className={className}>{text}</span>
    );

  return (
    <div className="space-y-1.5 rounded-lg border bg-muted/30 px-3 py-2 text-xs">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {label}
        <span className="opacity-40">·</span>
        {linkOrText(contact.href, contact.name, "font-medium")}
        {contact.role ? <span className="text-muted-foreground">({contact.role})</span> : null}
        {contact.organization ? (
          <>
            <span className="opacity-40">·</span>
            <span className="text-muted-foreground">{contact.organization}</span>
          </>
        ) : null}
        {taskButton}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-muted-foreground">
        <span className="font-medium text-foreground/80">{cs.kontext.posledniZpravy}:</span>
        {recentMessages.length === 0 ? (
          <span>{cs.kontext.zadneZpravy}</span>
        ) : (
          recentMessages.slice(0, 3).map((m, i) => {
            const d = formatDate?.(m.date);
            return (
              <span key={m.id} className="inline-flex max-w-full items-baseline gap-1">
                {i > 0 ? <span className="opacity-40">·</span> : null}
                {linkOrText(m.href, m.subject || cs.kontext.bezPredmetu, "truncate")}
                {d ? (
                  <span className="shrink-0 tabular-nums" title={d.title}>
                    {d.label}
                  </span>
                ) : null}
              </span>
            );
          })
        )}
      </div>
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-muted-foreground">
        <span className="font-medium text-foreground/80">{cs.kontext.otevreneUkoly}:</span>
        {openTasks.length === 0 ? (
          <span>{cs.kontext.zadneUkoly}</span>
        ) : (
          openTasks.slice(0, 3).map((t, i) => (
            <span key={t.id} className="inline-flex max-w-full items-baseline gap-1">
              {i > 0 ? <span className="opacity-40">·</span> : null}
              {linkOrText(t.href, t.title, "truncate")}
            </span>
          ))
        )}
      </div>
    </div>
  );
}

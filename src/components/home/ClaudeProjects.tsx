import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { cs as csLocale } from "date-fns/locale";
import { ArrowRight, Sparkles } from "lucide-react";

import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import type { ClaudeProject, ClaudeQuestion, ClaudeWorkSource } from "@/lib/claudeProjects";
import { cn } from "@/lib/utils";

const STATE_TONE: Record<string, string> = {
  probiha: "bg-secondary/10 text-secondary",
  ceka: "bg-warning/15 text-warning",
  todo: "bg-muted text-muted-foreground",
  odlozeno: "bg-muted text-muted-foreground",
};

const QUESTION_TONE: Record<ClaudeQuestion["state"], string> = {
  ceka: "bg-warning/15 text-warning",
  bezi: "bg-secondary/10 text-secondary",
  hotovo: "bg-success/15 text-success",
  chyba: "bg-destructive/10 text-destructive",
};

function relative(iso: string): { label: string; title: string } {
  const d = parseISO(iso);
  if (!isValid(d)) return { label: iso, title: iso };
  return { label: formatDistanceToNowStrict(d, { locale: csLocale, addSuffix: true }), title: format(d, "d. M. yyyy HH:mm", { locale: csLocale }) };
}

/**
 * Sekce „Rozpracováno v Claude" na Dnes: karta na projekt s počty otevřených,
 * rozpracovaných, čekajících a po termínu, poslední změnou a třemi úkoly.
 * Tvar karty je z `TodaySignals` (Dnes); data z `ukoly.claude_projekt`.
 */
export function ClaudeProjects({ source, tasksHref }: { source: ClaudeWorkSource; tasksHref: string }) {
  const t = cs.dnes.rozpracovano;
  const { toast } = useToast();
  const [projects, setProjects] = useState<ClaudeProject[]>([]);
  const [questions, setQuestions] = useState<ClaudeQuestion[]>([]);
  const [queued, setQueued] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    source
      .load()
      .then((work) => {
        if (cancelled) return;
        setProjects(work.projects);
        setQueued(work.queued);
        setQuestions(work.questions);
      })
      .catch((err: unknown) => {
        if (!cancelled) toast({ title: t.nacteniSelhalo, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [source, toast, t.nacteniSelhalo]);

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-secondary/10 text-secondary">
          <Sparkles className="h-4 w-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-base font-semibold">{t.titulek}</h2>
          <p className="text-[12px] text-muted-foreground">{queued ? t.veFronte(queued) : t.popis}</p>
        </div>
        <Link to={tasksHref} className="inline-flex items-center gap-1 text-xs font-medium text-secondary hover:underline">
          {t.zobrazitUkoly}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-3 md:grid-cols-2">
          {[0, 1].map((i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-card/60" />
          ))}
        </div>
      ) : projects.length ? (
        <ul className="grid gap-3 md:grid-cols-2">
          {projects.map((p) => {
            const last = relative(p.lastActivity);
            return (
              <li key={p.name} className="home-surface-plain rounded-2xl bg-card px-4 py-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="truncate text-[14.5px] font-semibold leading-tight">{p.name}</div>
                    <div className="mt-0.5 text-[11.5px] text-muted-foreground">
                      {t.naposledy} <span title={last.title}>{last.label}</span>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{t.otevrenych(p.open)}</span>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                  {p.inProgress ? <span className="rounded-full bg-secondary/10 px-2 py-0.5 font-medium text-secondary">{t.probiha(p.inProgress)}</span> : null}
                  {p.waiting ? <span className="rounded-full bg-warning/15 px-2 py-0.5 font-medium text-warning">{t.ceka(p.waiting)}</span> : null}
                  {p.overdue ? <span className="rounded-full bg-destructive/10 px-2 py-0.5 font-medium text-destructive">{t.poTerminu(p.overdue)}</span> : null}
                </div>
                <ul className="mt-2 space-y-1">
                  {p.tasks.map((task) => (
                    <li key={task.id} className="flex items-center gap-2 text-[12.5px]">
                      <span className={cn("shrink-0 rounded px-1 text-[10px] font-medium", STATE_TONE[task.state] ?? "bg-muted text-muted-foreground")}>{cs.ukoly.stavy[task.state]}</span>
                      <Link to={`${tasksHref}?ukol=${task.id}`} className="min-w-0 flex-1 truncate hover:underline">
                        {task.title}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="rounded-2xl bg-card/60 px-4 py-6 text-center text-sm text-muted-foreground">{t.nic}</p>
      )}

      {/* Dotazy z Pošty („Zeptat se") a odpovědi Clauda z `fronta_claude`. */}
      {questions.length ? (
        <div className="home-surface-plain rounded-2xl bg-card px-4 py-3">
          <div className="text-[13px] font-semibold">{t.dotazy}</div>
          <ul className="mt-2 divide-y">
            {questions.map((q) => {
              const when = relative(q.state === "hotovo" ? q.updatedAt : q.createdAt);
              return (
                <li key={q.id} className="py-2 text-[12.5px]">
                  <div className="flex items-start gap-2">
                    <span className={cn("mt-0.5 shrink-0 rounded px-1 text-[10px] font-medium", QUESTION_TONE[q.state])}>{t.dotazStav[q.state] ?? q.state}</span>
                    <span className="min-w-0 flex-1">
                      <span className="mr-1 text-[10.5px] uppercase tracking-wide text-muted-foreground">{t.druh[q.kind] ?? q.kind}</span>
                      <span className="font-medium">{q.question}</span>
                      {q.subject ? <span className="block truncate text-[11.5px] text-muted-foreground">{q.subject}</span> : null}
                    </span>
                    <span className="shrink-0 text-[11px] text-muted-foreground" title={when.title}>
                      {when.label}
                    </span>
                  </div>
                  <p className={cn("mt-1 whitespace-pre-wrap break-words", q.answer ? "text-foreground" : "text-muted-foreground")}>{q.answer ?? t.bezOdpovedi}</p>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

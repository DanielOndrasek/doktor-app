import { useState } from "react";
import { differenceInHours, format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { cs as csLocale } from "date-fns/locale";
import { AlertTriangle, ChevronDown, History } from "lucide-react";
import { Link } from "react-router-dom";

import { cn } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";
import type { Run, RunOutcomeRef } from "@/lib/runs";

interface RunsHistoryProps {
  runs: Run[];
  loading?: boolean;
  /** Donačte, co z běhu vzniklo — až po rozbalení, ne pro všech 40 řádků. */
  onLoadOutcomes?: (run: Run) => Promise<RunOutcomeRef[]>;
}

const STATE_CLASS: Record<Run["state"], string> = {
  bezi: "text-secondary",
  hotovo: "text-success",
  chyba: "text-destructive",
};

/** Běhy jsou 7:00 / 13:00 / 17:00 — po delší mezeře je něco špatně (K2.7: kontrola, že běh proběhl). */
const STALE_AFTER_HOURS = 26;

/**
 * Přehled běhů a zásahů Clauda (K3.9): kdy, co bylo zadáno, kolik věcí
 * vzniklo, co se přeskočilo a proč; po rozbalení odkazy na výsledek.
 *
 * Převzato z `components/vividbooks/AgentRunsHistory.tsx` (vividbooks CRM,
 * `831f9ae6`). Čtení z `agent_runs` a jména z `profiles` → prop `runs`
 * (jeden uživatel, jméno netřeba); obchody z `db_deals` po rozbalení →
 * `onLoadOutcomes` s obecnými odkazy; `formatDateCs` → date-fns s `cs`.
 * Navíc proti CRM: zdroj (běh · Claude · aplikace) a stav (běží · hotovo ·
 * chyba) — Doktor sleduje i to, jestli běh vůbec doběhl (K2.7): hlavička
 * ukáže, kdy byl poslední, a varuje, když je starší než `STALE_AFTER_HOURS`.
 */
export function RunsHistory({ runs, loading, onLoadOutcomes }: RunsHistoryProps) {
  const [open, setOpen] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<Record<string, RunOutcomeRef[] | "error">>({});

  const toggle = async (run: Run) => {
    if (open === run.id) {
      setOpen(null);
      return;
    }
    setOpen(run.id);
    if (outcomes[run.id] || !run.createdCount || !onLoadOutcomes) return;
    try {
      const refs = await onLoadOutcomes(run);
      setOutcomes((m) => ({ ...m, [run.id]: refs }));
    } catch {
      setOutcomes((m) => ({ ...m, [run.id]: "error" }));
    }
  };

  const formatWhen = (iso: string) => {
    const d = parseISO(iso);
    return isValid(d) ? format(d, "d. M. yyyy HH:mm", { locale: csLocale }) : iso;
  };

  const labelOf = (r: Run) => r.label || (r.source === "beh" ? cs.behy.trideni : r.source === "claude" ? cs.behy.zasah : cs.behy.bezZadani);
  const countLabel = (r: Run, key: string) => (r.source === "claude" ? cs.behy.nastroje[key] : cs.behy.pocty[key]) ?? key;

  // Poslední skutečný běh (ne zásah) — podle něj se pozná, že běhy stojí.
  const lastRun = runs.find((r) => r.source === "beh");
  const lastRunAt = lastRun ? parseISO(lastRun.startedAt) : null;
  const stale = !loading && (!lastRunAt || !isValid(lastRunAt) || differenceInHours(new Date(), lastRunAt) >= STALE_AFTER_HOURS);

  if (loading && !runs.length) return null;

  return (
    <section className="mb-6 rounded-2xl border bg-card">
      <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold">
        <History className="h-4 w-4 text-muted-foreground" />
        {cs.behy.nazev}
        {runs.length ? <span className="text-xs font-normal text-muted-foreground">{cs.behy.poslednich(runs.length)}</span> : null}
        <span
          className={cn("ml-auto flex items-center gap-1 text-xs font-normal", stale ? "text-warning" : "text-muted-foreground")}
          title={lastRunAt && isValid(lastRunAt) ? formatWhen(lastRun!.startedAt) : undefined}
        >
          {stale && <AlertTriangle className="h-3.5 w-3.5" />}
          {lastRunAt && isValid(lastRunAt)
            ? cs.behy.posledniBehPred(formatDistanceToNowStrict(lastRunAt, { addSuffix: true, locale: csLocale }))
            : cs.behy.behChybi}
        </span>
      </div>
      {!runs.length ? (
        <div className="px-4 py-3 text-[13px] text-muted-foreground">{cs.behy.zadnyBeh}</div>
      ) : (
        <ul className="divide-y">
          {runs.map((r) => {
            const skipped = Object.entries(r.skipped);
            const skippedTotal = skipped.reduce((a, [, n]) => a + n, 0);
            const counts = Object.entries(r.counts);
            const loaded = outcomes[r.id];
            return (
              <li key={r.id}>
                <button
                  type="button"
                  onClick={() => void toggle(r)}
                  className="flex w-full items-start gap-3 px-4 py-2.5 text-left hover:bg-muted/40"
                >
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-[13.5px] font-medium">{labelOf(r)}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground">
                      <span title={r.finishedAt ? `${formatWhen(r.startedAt)} – ${formatWhen(r.finishedAt)}` : undefined}>
                        {formatWhen(r.startedAt)}
                      </span>
                      <span>·</span>
                      <span>{cs.behy.zdroj[r.source]}</span>
                      <span>·</span>
                      <span className={cn("font-semibold", STATE_CLASS[r.state])}>{cs.behy.stav[r.state]}</span>
                      {counts.map(([k, n]) => (
                        <span key={k}>
                          · {n} {countLabel(r, k)}
                        </span>
                      ))}
                      {skippedTotal ? <span>· {cs.behy.preskoceno(skippedTotal)}</span> : null}
                    </div>
                  </div>
                  <ChevronDown
                    className={cn("mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-150", open === r.id && "rotate-180")}
                  />
                </button>
                {open === r.id ? (
                  <div className="space-y-2 bg-muted/30 px-4 py-3 text-[12.5px]">
                    {r.error ? <div className="break-words text-destructive">{r.error}</div> : null}
                    {skipped.length ? (
                      <div className="flex flex-wrap gap-1.5">
                        {skipped.map(([k, n]) => (
                          <span key={k} className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                            {countLabel(r, k)} · {n}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {r.createdCount ? (
                      loaded === "error" ? (
                        <div className="text-destructive">{cs.behy.detailSelhal}</div>
                      ) : loaded ? (
                        <ul className="grid gap-1 sm:grid-cols-2">
                          {loaded.map((o) => (
                            <li key={o.id}>
                              {o.href ? (
                                <Link to={o.href} className="block truncate rounded-md px-1.5 py-1 hover:bg-card hover:underline" title={o.label}>
                                  {o.label}
                                </Link>
                              ) : (
                                <span className="block truncate px-1.5 py-1" title={o.label}>
                                  {o.label}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <div className="text-muted-foreground">{onLoadOutcomes ? cs.behy.nacitamDetail : `${r.createdCount}`}</div>
                      )
                    ) : (
                      <div className="text-muted-foreground">{cs.behy.bezVysledku}</div>
                    )}
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

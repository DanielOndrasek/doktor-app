import { useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { cs as csLocale } from "date-fns/locale";
import { ChevronDown, History } from "lucide-react";

import { cn } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";
import type { Run, RunOutcomeRef } from "@/lib/runs";

interface RunsHistoryProps {
  runs: Run[];
  /** Donačte, co z běhu vzniklo — až po rozbalení, ne pro všech 40 řádků. */
  onLoadOutcomes?: (run: Run) => Promise<RunOutcomeRef[]>;
}

const STATE_CLASS: Record<Run["state"], string> = {
  bezi: "text-secondary",
  hotovo: "text-success",
  chyba: "text-destructive",
};

/**
 * Přehled běhů a zásahů Clauda (K3.9): kdy, co bylo zadáno, kolik věcí
 * vzniklo, co se přeskočilo a proč; po rozbalení odkazy na výsledek.
 *
 * Převzato z `components/vividbooks/AgentRunsHistory.tsx` (vividbooks CRM,
 * `831f9ae6`). Čtení z `agent_runs` a jména z `profiles` → prop `runs`
 * (jeden uživatel, jméno netřeba); obchody z `db_deals` po rozbalení →
 * `onLoadOutcomes` s obecnými odkazy; `formatDateCs` → date-fns s `cs`.
 * Navíc proti CRM: zdroj (běh · Claude · aplikace) a stav (běží · hotovo ·
 * chyba) — Doktor sleduje i to, jestli běh vůbec doběhl (K2.7).
 */
export function RunsHistory({ runs, onLoadOutcomes }: RunsHistoryProps) {
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

  if (!runs.length) return null;

  return (
    <section className="mb-6 rounded-2xl border bg-card">
      <div className="flex items-center gap-2 border-b px-4 py-2.5 text-sm font-semibold">
        <History className="h-4 w-4 text-muted-foreground" />
        {cs.behy.nazev}
        <span className="text-xs font-normal text-muted-foreground">{cs.behy.poslednich(runs.length)}</span>
      </div>
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
                  <div className="line-clamp-2 text-[13.5px] font-medium">{r.label || cs.behy.bezZadani}</div>
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
                        · {k} {n}
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
                  {r.error ? <div className="text-destructive">{r.error}</div> : null}
                  {skipped.length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {skipped.map(([k, n]) => (
                        <span key={k} className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                          {k} · {n}
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
                              <a href={o.href} className="block truncate rounded-md px-1.5 py-1 hover:bg-card hover:underline">
                                {o.label}
                              </a>
                            ) : (
                              <span className="block truncate px-1.5 py-1">{o.label}</span>
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
    </section>
  );
}

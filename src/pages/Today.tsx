import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { ClaudeProjects } from "@/components/home/ClaudeProjects";
import { TodaySignals } from "@/components/home/TodaySignals";
import { RunsHistory } from "@/components/runs/RunsHistory";
import { TASKS_PATH } from "@/components/AppShell";
import type { ClaudeWorkSource } from "@/lib/claudeProjects";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import type { Run, RunsSource } from "@/lib/runs";
import type { Signal, TodaySource } from "@/lib/today";

/**
 * Dnes (K3.5): čemu se dnes věnovat, co je rozpracované v Claude
 * (`ClaudeProjects`, na přání 21. 9.) a přehled běhů a zásahů Clauda
 * (`RunsHistory`, K3.9). Připnuté pohledy přijdou s K4.2.
 *
 * Převzato z `pages/HomePage.tsx` (vividbooks CRM, `831f9ae6`) jako kostra:
 * kontejner se sekcemi. Nepřebráno: `VbAssistantHero` (AI asistent),
 * `VbEarningsCard` (provize), `NewsStrip`, `SequenceApprovals`,
 * `OpportunitiesBoard`, `PortfolioSection` (obchody, sekvence, portfolio —
 * schéma `crm`) a `CallRecordingsInbox` (vlastní řádek Zápisy). Aurora
 * v pozadí (`page-aurora-soft`) je značka Vividbooks.
 */
export default function Today({ source, claudeWork, runs }: { source: TodaySource; claudeWork: ClaudeWorkSource; runs: RunsSource }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [runList, setRunList] = useState<Run[]>([]);
  const [loadingRuns, setLoadingRuns] = useState(true);

  useEffect(() => {
    let cancelled = false;
    runs
      .list()
      .then((list) => {
        if (!cancelled) setRunList(list);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        toast({ title: cs.behy.nacteniSelhalo, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
      })
      .finally(() => {
        if (!cancelled) setLoadingRuns(false);
      });
    return () => {
      cancelled = true;
    };
  }, [runs, toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSignals(await source.load());
    } catch (err) {
      toast({
        title: cs.dnes.nacteniSelhalo,
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [source, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <main className="container mx-auto px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 md:pb-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">{cs.dnes.titulek}</h1>
        <TodaySignals
          signals={signals}
          loading={loading}
          onDismiss={async (signal, action) => {
            try {
              await source.dismiss(signal.key, action);
            } catch (err) {
              toast({ title: err instanceof Error ? err.message : String(err), variant: "destructive" });
              throw err;
            }
          }}
          onAction={(_signal, action) => navigate(action.href)}
        />
        <ClaudeProjects source={claudeWork} tasksHref={TASKS_PATH} />
        <RunsHistory runs={runList} loading={loadingRuns} onLoadOutcomes={runs.outcomes} />
      </div>
    </main>
  );
}

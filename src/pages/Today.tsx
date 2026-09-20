import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { TodaySignals } from "@/components/home/TodaySignals";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import type { Signal, TodaySource } from "@/lib/today";

/**
 * Dnes (K3.5): čemu se dnes věnovat. Připnuté pohledy přijdou s K4.2.
 *
 * Převzato z `pages/HomePage.tsx` (vividbooks CRM, `831f9ae6`) jako kostra:
 * kontejner se sekcemi. Nepřebráno: `VbAssistantHero` (AI asistent),
 * `VbEarningsCard` (provize), `NewsStrip`, `SequenceApprovals`,
 * `OpportunitiesBoard`, `PortfolioSection` (obchody, sekvence, portfolio —
 * schéma `crm`) a `CallRecordingsInbox` (vlastní řádek Zápisy). Aurora
 * v pozadí (`page-aurora-soft`) je značka Vividbooks.
 */
export default function Today({ source }: { source: TodaySource }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);

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
      </div>
    </main>
  );
}

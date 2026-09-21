import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

import { KanbanBoard, type KanbanCardData, type KanbanState } from "@/components/kanban";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import type { TaskSource } from "@/lib/tasks";

/**
 * Úkoly (K3.6): kanban TODO · V procesu · Čekám · Hotovo · Odloženo.
 * Seznam po termínech a kalendář přijdou k tomu; zakládání úkolu a jeho
 * detail čekají na data z K2, proto tabule zatím nemá „+".
 */
export default function Tasks({ source }: { source: TaskSource }) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [cards, setCards] = useState<KanbanCardData[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCards(await source.load());
    } catch (err) {
      toast({
        title: cs.ukoly.nacteniSelhalo,
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

  const move = async (card: KanbanCardData, to: KanbanState) => {
    await source.move(card, to);
    // Tabule už kartu přesunula optimisticky; tady jen potvrdíme stav
    // v datech, ať přepis zmizí bez nového načtení všech řádků.
    const now = new Date().toISOString();
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, state: to, stateEnteredAt: now } : c)));
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-shrink-0 items-center gap-3 px-4 pb-2 pt-4">
        <h1 className="text-2xl font-bold tracking-tight">{cs.ukoly.titulek}</h1>
        {!loading && cards.length === 0 ? (
          <span className="text-xs text-muted-foreground">{cs.ukoly.bezZdroje}</span>
        ) : null}
      </div>
      <div className="min-h-0 flex-1">
        <KanbanBoard
          cards={cards}
          loading={loading}
          onMove={move}
          onCardClick={(card) => {
            if (card.href) navigate(card.href);
          }}
        />
      </div>
    </div>
  );
}

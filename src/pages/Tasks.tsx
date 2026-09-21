import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus } from "lucide-react";

import { KanbanBoard, type KanbanCardData, type KanbanState } from "@/components/kanban";
import { TaskDialog, type TaskDialogTarget } from "@/components/tasks";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import type { TaskSource } from "@/lib/tasks";

/** `?ukol=<id>` otevře detail — stejný odkaz dává karta, Dnes i e-mail. */
const TASK_PARAM = "ukol";

/**
 * Úkoly (K3.6): kanban TODO · V procesu · Čekám · Hotovo · Odloženo,
 * detail a zakládání v dialogu (`TaskDialog`). Seznam po termínech
 * a kalendář jsou další pohledy téže obrazovky.
 */
export default function Tasks({ source }: { source: TaskSource }) {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cards, setCards] = useState<KanbanCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<KanbanState | null>(null);

  const editingId = searchParams.get(TASK_PARAM);
  const dialogTarget = useMemo<TaskDialogTarget | null>(
    () => (editingId ? { mode: "edit", id: editingId } : creating ? { mode: "new", state: creating } : null),
    [editingId, creating],
  );

  const openTask = (id: string) =>
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.set(TASK_PARAM, id);
        return next;
      },
      { replace: true },
    );

  const closeDialog = useCallback(() => {
    setCreating(null);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete(TASK_PARAM);
        return next;
      },
      { replace: true },
    );
  }, [setSearchParams]);

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
        <Button size="sm" className="ml-auto h-8" onClick={() => setCreating("todo")}>
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
          {cs.ukoly.kanban.pridatUkol}
        </Button>
      </div>
      <div className="min-h-0 flex-1">
        <KanbanBoard
          cards={cards}
          loading={loading}
          onMove={move}
          onCardClick={(card) => openTask(card.id)}
          onAddCard={(state) => setCreating(state)}
        />
      </div>
      <TaskDialog target={dialogTarget} source={source} onClose={closeDialog} onSaved={() => void load()} />
    </div>
  );
}

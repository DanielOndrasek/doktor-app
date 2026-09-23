import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarDays, Columns3, List, Plus, Search } from "lucide-react";

import { KanbanBoard, type KanbanCardData, type KanbanState } from "@/components/kanban";
import { TaskCalendar, TaskDialog, TaskList, type TaskDialogTarget } from "@/components/tasks";
import { Button } from "@/components/ui/button";
import { ToastAction } from "@/components/ui/toast";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import { iso } from "@/lib/taskDue";
import type { TaskSource } from "@/lib/tasks";
import { cn } from "@/lib/utils";

/** `?ukol=<id>` otevře detail — stejný odkaz dává karta, Dnes i e-mail. */
const TASK_PARAM = "ukol";

type View = "kanban" | "list" | "calendar";
const VIEWS: [View, keyof typeof cs.ukoly.pohledy, typeof Columns3][] = [
  ["kanban", "kanban", Columns3],
  ["list", "seznam", List],
  ["calendar", "kalendar", CalendarDays],
];
const VIEW_KEY = "doktor:ukoly-pohled";

function readView(): View {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    return v === "list" || v === "calendar" ? v : "kanban";
  } catch {
    return "kanban";
  }
}

/**
 * Úkoly (K3.6): tři pohledy nad týmiž kartami — kanban TODO · V procesu ·
 * Čekám · Hotovo · Odloženo, seznam po termínech a kalendář týden / měsíc;
 * detail a zakládání v dialogu (`TaskDialog`).
 *
 * Přepínač pohledů a hledání jsou z `VbTasksPage.tsx` (vividbooks CRM,
 * `831f9ae6`); tam byl seznam + kalendář, kanban je z obchodů. Odstřižené:
 * výběr kolegy („Moje / Všichni"), AI plán dne (`tasks-ai`), filtr typů
 * aktivit.
 */
export default function Tasks({ source }: { source: TaskSource }) {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [cards, setCards] = useState<KanbanCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<{ state: KanbanState; dueDate?: string } | null>(null);
  const [view, setView] = useState<View>(readView);
  const [query, setQuery] = useState("");
  const today = iso(new Date());

  useEffect(() => {
    try {
      localStorage.setItem(VIEW_KEY, view);
    } catch {
      /* soukromé okno — nevadí */
    }
  }, [view]);

  const editingId = searchParams.get(TASK_PARAM);
  const dialogTarget = useMemo<TaskDialogTarget | null>(
    () => (editingId ? { mode: "edit", id: editingId } : creating ? { mode: "new", ...creating } : null),
    [editingId, creating],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return cards;
    return cards.filter((c) => `${c.title} ${c.contactLabel ?? ""} ${c.area ?? ""}`.toLowerCase().includes(q));
  }, [cards, query]);

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

  /* Seznam a kalendář zapisují optimisticky a při chybě načtou znovu (z CRM `patch`). */
  const toggleDone = async (card: KanbanCardData, done: boolean) => {
    const to: KanbanState = done ? "hotovo" : "todo";
    const now = new Date().toISOString();
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, state: to, stateEnteredAt: now } : c)));
    try {
      await source.move(card, to);
    } catch (err) {
      toast({ title: cs.ukoly.kanban.chybaPresunu, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
      void load();
    }
  };

  // „Smazat" = `zruseno` (nic se nemaže, pravidlo 3); řádek zmizí hned a toast nabídne návrat.
  const cancelTask = async (card: KanbanCardData) => {
    setCards((prev) => prev.filter((c) => c.id !== card.id));
    try {
      await source.cancel(card);
      toast({
        title: cs.ukoly.seznam.smazano,
        description: cs.ukoly.seznam.smazanoPopis,
        action: (
          <ToastAction
            altText={cs.ukoly.seznam.vratitZpet}
            onClick={() => {
              setCards((prev) => (prev.some((c) => c.id === card.id) ? prev : [...prev, card]));
              source.uncancel(card).catch((err: unknown) => {
                toast({ title: cs.ukoly.kanban.chybaPresunu, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
                void load();
              });
            }}
          >
            {cs.ukoly.seznam.vratitZpet}
          </ToastAction>
        ),
      });
    } catch (err) {
      toast({ title: cs.ukoly.seznam.smazaniSelhalo, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
      void load();
    }
  };

  const reschedule = async (card: KanbanCardData, dueDate: string, message: string) => {
    const time = card.due && card.due.length > 10 ? card.due.slice(10) : "";
    setCards((prev) => prev.map((c) => (c.id === card.id ? { ...c, due: `${dueDate}${time}` } : c)));
    try {
      await source.reschedule(card, dueDate);
      toast({ title: message });
    } catch (err) {
      toast({ title: cs.ukoly.seznam.presunSelhal, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
      void load();
    }
  };

  const addNew = (state: KanbanState = "todo", dueDate?: string) => setCreating({ state, dueDate });

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-shrink-0 flex-wrap items-center gap-2 px-4 pb-2 pt-4">
        <h1 className="mr-1 text-2xl font-bold tracking-tight">{cs.ukoly.titulek}</h1>
        <div className="inline-flex h-8 items-center rounded-md bg-muted p-0.5 text-sm">
          {VIEWS.map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => setView(key)}
              className={cn("inline-flex items-center gap-1.5 rounded-sm px-2.5 py-1 text-xs font-medium", view === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground")}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden />
              {cs.ukoly.pohledy[label]}
            </button>
          ))}
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" aria-hidden />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={cs.ukoly.hledat}
            aria-label={cs.ukoly.hledat}
            className="h-8 w-56 rounded-md border border-input bg-background pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {!loading && cards.length === 0 ? <span className="text-xs text-muted-foreground">{cs.ukoly.bezZdroje}</span> : null}
        <Button size="sm" className="ml-auto h-8" onClick={() => addNew("todo", view === "calendar" ? today : undefined)}>
          <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
          {cs.ukoly.kanban.pridatUkol}
        </Button>
      </div>
      {view === "kanban" ? (
        <div className="min-h-0 flex-1">
          <KanbanBoard cards={filtered} loading={loading} onMove={move} onCardClick={(card) => openTask(card.id)} onAddCard={(state) => addNew(state)} />
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-2 md:pb-6">
          {loading ? (
            <div className="space-y-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-14 animate-pulse rounded-xl bg-card/70" />
              ))}
            </div>
          ) : view === "list" ? (
            <TaskList cards={filtered} today={today} onOpen={(card) => openTask(card.id)} onToggleDone={toggleDone} onReschedule={reschedule} onCancel={cancelTask} onAdd={() => addNew()} />
          ) : (
            <TaskCalendar cards={filtered} today={today} onOpen={(card) => openTask(card.id)} onReschedule={reschedule} onAddOn={(dueDate) => addNew("todo", dueDate)} />
          )}
        </div>
      )}
      <TaskDialog target={dialogTarget} source={source} onClose={closeDialog} onSaved={() => void load()} />
    </div>
  );
}

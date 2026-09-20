import { useMemo, useState } from "react";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";

import { useToast } from "@/hooks/use-toast";
import { useDelayedLoading } from "@/hooks/useDelayedLoading";
import { cs } from "@/lib/i18n/cs";
import { KanbanCard } from "./KanbanCard";
import { KanbanColumn } from "./KanbanColumn";
import { KanbanLoadingBoard } from "./KanbanLoadingBoard";
import { KANBAN_COLUMNS, type KanbanCard as KanbanCardData, type KanbanState } from "./types";

interface Props {
  cards: KanbanCardData[];
  loading?: boolean;
  /**
   * Zápis nového stavu. Tabule kartu přesune hned (optimisticky) a při
   * chybě ji vrátí; kdo stav ukládá a jak, je věc volajícího — a ten
   * nezapomene na `stav_zdroj = klik` (pravidlo 4 v `CLAUDE.md`).
   */
  onMove: (card: KanbanCardData, to: KanbanState) => Promise<void>;
  onCardClick: (card: KanbanCardData) => void;
  onAddCard?: (state: KanbanState) => void;
}

/**
 * Kanban úkolů: TODO · V procesu · Čekám · Hotovo · Odloženo.
 *
 * Převzato ze `SalesKanbanBoard` (vividbooks CRM, `831f9ae6`) jako mřížka
 * sloupců, optimistický přesun s návratem při chybě a odložená kostra
 * načítání (`useDelayedLoading`, 150/300 ms).
 *
 * Odstřižené: načítání obchodů z `db_deals` se stránkováním a joiny,
 * profily makléřů, počty úkolů po termínu, fast-path pro `?deal=`, filtry
 * makléře a pipeline (`brokerFilter`, `dealFilter`, `vbPipeline`), detail
 * obchodu, formulář obchodu, zápis na zeď obchodu při změně fáze
 * a dialog akcí po přesunu (rezervace, publikace, konec ZS). Data přicházejí
 * propsem `cards`; sloupce jsou stavy úkolu z `CLAUDE.md`, ne fáze obchodu.
 * Přetahování je na `@dnd-kit` místo nativního HTML5 drag & drop.
 */
export function KanbanBoard({ cards, loading = false, onMove, onCardClick, onAddCard }: Props) {
  const { toast } = useToast();
  /* Kanban je list-like — kostra se ukáže až po 150 ms (rychlé), drží se
   * min. 300 ms. Pod tím skočí přímo karty. */
  const showSkeleton = useDelayedLoading(loading, { delay: 150, minShow: 300 });

  /* Optimistický stav: karta přesunutá kliknutím je ve svém sloupci hned,
   * dokud zápis neskončí. Při chybě se přepis smaže a karta se vrátí. */
  const [overrides, setOverrides] = useState<Record<string, KanbanState>>({});
  const [activeCard, setActiveCard] = useState<KanbanCardData | null>(null);

  const sensors = useSensors(
    // Krátký práh, ať klik na kartu zůstane klikem a ne začátkem tahu.
    useSensor(MouseSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const byColumn = useMemo(() => {
    const map = new Map<KanbanState, KanbanCardData[]>();
    for (const column of KANBAN_COLUMNS) map.set(column.value, []);
    for (const card of cards) {
      const state = overrides[card.id] ?? card.state;
      map.get(state)?.push({ ...card, state });
    }
    return map;
  }, [cards, overrides]);

  const handleDragStart = (event: DragStartEvent) => {
    const card = (event.active.data.current as { card?: KanbanCardData } | undefined)?.card ?? null;
    setActiveCard(card);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    setActiveCard(null);
    const card = (event.active.data.current as { card?: KanbanCardData } | undefined)?.card;
    const to = event.over?.id as KanbanState | undefined;
    if (!card || !to || !KANBAN_COLUMNS.some((c) => c.value === to)) return;
    const from = overrides[card.id] ?? card.state;
    if (from === to) return;

    setOverrides((prev) => ({ ...prev, [card.id]: to }));
    try {
      await onMove(card, to);
      const label = KANBAN_COLUMNS.find((c) => c.value === to)?.label ?? to;
      toast({ title: `${cs.ukoly.kanban.presunutoDo} ${label}` });
    } catch (err) {
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[card.id];
        return next;
      });
      toast({
        title: cs.ukoly.kanban.chybaPresunu,
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      // Jakmile volající pošle nové `cards`, přepis už není potřeba.
      setOverrides((prev) => {
        if (!(card.id in prev)) return prev;
        const next = { ...prev };
        delete next[card.id];
        return next;
      });
    }
  };

  if (loading) {
    if (showSkeleton) {
      return <KanbanLoadingBoard columns={KANBAN_COLUMNS} />;
    }
    /* Načítání běží, ale ještě nedosáhlo `delay` — držíme prázdné místo,
     * ať mřížka nepoposkočí, až data za pár desítek ms dorazí. */
    return <div className="h-full min-h-[40vh]" aria-hidden />;
  }

  return (
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={(e) => void handleDragEnd(e)}>
      <div className="flex h-full min-h-0 flex-col">
        {/* Mřížka s minmax: všechny sloupce se vejdou bez vodorovného posuvníku na běžných monitorech. */}
        <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden scroll-smooth">
          <div
            className="grid h-full min-h-0 gap-2 px-3 pb-4 pt-2 max-md:w-max max-md:min-w-full sm:gap-3 sm:px-4 md:w-full md:min-w-0"
            style={{ gridTemplateColumns: `repeat(${KANBAN_COLUMNS.length}, minmax(180px, 1fr))` }}
          >
            {KANBAN_COLUMNS.map((column) => (
              <KanbanColumn
                key={column.value}
                column={column}
                cards={byColumn.get(column.value) ?? []}
                onCardClick={onCardClick}
                onAddCard={onAddCard}
              />
            ))}
          </div>
        </div>
      </div>
      <DragOverlay>
        {activeCard ? (
          <KanbanCard
            card={activeCard}
            stateLabel={KANBAN_COLUMNS.find((c) => c.value === activeCard.state)?.label ?? ""}
            onClick={() => {}}
            overlay
          />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

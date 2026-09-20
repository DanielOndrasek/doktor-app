import { useDroppable } from "@dnd-kit/core";
import { Plus } from "lucide-react";

import { cn } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";
import { KanbanCard } from "./KanbanCard";
import type { KanbanCard as KanbanCardData, KanbanColumnConfig } from "./types";

interface Props {
  column: KanbanColumnConfig;
  cards: KanbanCardData[];
  onCardClick: (card: KanbanCardData) => void;
  onAddCard?: (state: KanbanColumnConfig["value"]) => void;
}

/**
 * Sloupec kanbanu. Převzato ze `SalesKanbanColumn` (vividbooks CRM,
 * `831f9ae6`): proužek, hlavička s počtem, seznam karet, prázdný stav
 * s „+" a tlačítko pro přidání dole.
 *
 * Odstřižený součet provize v hlavičce (`formatCzk`, `sumFn`) — úkoly se
 * nesčítají. Cíl pro puštění karty řeší `@dnd-kit` (`useDroppable`).
 */
export function KanbanColumn({ column, cards, onCardClick, onAddCard }: Props) {
  const { setNodeRef, isOver } = useDroppable({ id: column.value });

  return (
    <div
      ref={setNodeRef}
      className={cn(
        "flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm transition-all",
        isOver && "bg-primary/5 shadow-lg ring-2 ring-primary/40",
      )}
    >
      <div className={cn("h-1 w-full shrink-0 rounded-t-[3px]", column.accentBarClass)} aria-hidden />

      <div className="shrink-0 border-b border-border/50 bg-card px-2.5 pb-2.5 pt-2.5">
        <div className="flex items-center justify-between gap-1.5">
          <span className="min-w-0 truncate text-[13px] font-semibold leading-tight text-foreground">
            {column.label}
          </span>
          <span className="shrink-0 rounded-full bg-muted px-[7px] py-px text-[11px] font-medium tabular-nums text-muted-foreground">
            {cards.length}
          </span>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col bg-muted/20 p-2">
        {cards.length > 0 ? (
          <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto">
            {cards.map((card) => (
              <KanbanCard key={card.id} card={card} stateLabel={column.label} onClick={onCardClick} />
            ))}
          </div>
        ) : (
          <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-2 py-6">
            <button
              type="button"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-muted-foreground/35 text-muted-foreground transition-colors hover:border-primary/45 hover:bg-muted/50 hover:text-primary disabled:pointer-events-none disabled:opacity-50"
              onClick={() => onAddCard?.(column.value)}
              disabled={!onAddCard}
              aria-label={cs.ukoly.kanban.pridatUkol}
            >
              <Plus className="h-4 w-4" />
            </button>
            <span className="text-center text-[12px] text-muted-foreground">{cs.ukoly.kanban.zadneUkoly}</span>
          </div>
        )}

        {onAddCard ? (
          <button
            type="button"
            className="mt-2 flex h-8 w-full shrink-0 items-center justify-center rounded-lg border-0 bg-transparent text-lg font-light text-muted-foreground transition-colors hover:bg-muted/80 hover:text-foreground"
            onClick={() => onAddCard(column.value)}
            aria-label={cs.ukoly.kanban.pridatUkol}
          >
            +
          </button>
        ) : null}
      </div>
    </div>
  );
}

import { cn } from "@/lib/utils";
import { Skeleton } from "@/components/ui/skeleton";
import type { KanbanColumnConfig } from "./types";

interface Props {
  /** Sloupce, které mají být vykresleny — počet, popisek a proužek stejný jako reálná tabule. */
  columns: readonly Pick<KanbanColumnConfig, "label" | "accentBarClass">[];
  /** Kolik placeholder kartiček vykreslit v každém sloupci. Default 3. */
  cardsPerColumn?: number;
}

/**
 * Kostra kanbanu pro stav načítání. Drží stejnou strukturu jako reálná
 * tabule (`KanbanColumn`): sloupce s proužkem, nadpisem, počtem a kartami
 * uvnitř — ale obsah je `<Skeleton>`. Cíl: žádný posun rozložení při přechodu
 * načítání → data, žádný celoobrazovkový překryv, který schová navigaci.
 *
 * Převzato z `components/kanban/KanbanLoadingBoard.tsx` (vividbooks CRM,
 * `831f9ae6`); bez řádku pro součet provize v hlavičce.
 */
export function KanbanLoadingBoard({ columns, cardsPerColumn = 3 }: Props) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex min-h-0 flex-1 overflow-x-auto overflow-y-hidden scroll-smooth">
        <div
          className="grid h-full min-h-0 gap-2 px-3 pb-4 pt-2 max-md:w-max max-md:min-w-full sm:gap-3 sm:px-4 md:w-full md:min-w-0"
          style={{ gridTemplateColumns: `repeat(${columns.length}, minmax(180px, 1fr))` }}
        >
          {columns.map((column, i) => (
            <div
              key={`${column.label}-${i}`}
              className="flex h-full w-full min-w-0 flex-col overflow-hidden rounded-xl border border-border/60 bg-card shadow-sm"
            >
              <div className={cn("h-1 w-full shrink-0 rounded-t-[3px]", column.accentBarClass)} aria-hidden />
              <div className="shrink-0 border-b border-border/50 bg-card px-2.5 pb-2.5 pt-2.5">
                <div className="flex items-center justify-between gap-1.5">
                  <span className="min-w-0 truncate text-[13px] font-semibold leading-tight text-foreground">
                    {column.label}
                  </span>
                  <Skeleton className="h-4 w-6 rounded-full" />
                </div>
              </div>
              <div className="flex min-h-0 flex-1 flex-col bg-muted/20 p-2">
                <div className="min-h-0 flex-1 space-y-2.5">
                  {Array.from({ length: cardsPerColumn }).map((_, j) => (
                    <Skeleton key={j} className="h-[78px] w-full rounded-lg" />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

import { useDraggable } from "@dnd-kit/core";
import { CSS } from "@dnd-kit/utilities";
import { differenceInCalendarDays, format, formatDistanceToNowStrict, isPast, isValid, parseISO } from "date-fns";
import { cs as csLocale } from "date-fns/locale";
import type { MouseEvent } from "react";

import { cn } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";
import type { KanbanCard as KanbanCardData } from "./types";

function daysInState(card: KanbanCardData): number | null {
  if (!card.stateEnteredAt) return null;
  const t = new Date(card.stateEnteredAt).getTime();
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((Date.now() - t) / 86400000));
}

/** České skloňování „den": 1 den, 2–4 dny, 5+ dní (a 0 dní). */
function formatDaysCs(n: number): string {
  if (n === 1) return `1 ${cs.ukoly.kanban.den}`;
  const m10 = n % 10;
  const m100 = n % 100;
  if (n !== 0 && m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return `${n} ${cs.ukoly.kanban.dny}`;
  return `${n} ${cs.ukoly.kanban.dni}`;
}

/** Termín relativně („za 3 dny") s absolutním datem v `title` — konvence z `CLAUDE.md`. */
function dueDisplay(due: string | null | undefined): { relative: string; absolute: string; overdue: boolean } | null {
  if (!due) return null;
  const d = parseISO(due);
  if (!isValid(d)) return null;
  const overdue = isPast(d) && differenceInCalendarDays(new Date(), d) > 0;
  return {
    relative: formatDistanceToNowStrict(d, { addSuffix: true, locale: csLocale }),
    absolute: format(d, "EEEE d. MMMM yyyy", { locale: csLocale }),
    overdue,
  };
}

interface Props {
  card: KanbanCardData;
  stateLabel: string;
  onClick: (card: KanbanCardData) => void;
  /** Vykresluje se v `DragOverlay` — bez vlastního přetahování a s plnou sytostí. */
  overlay?: boolean;
}

/**
 * Karta úkolu. Převzato ze `SalesKanbanCard` (vividbooks CRM, `831f9ae6`):
 * zůstal tvar — název na dva řádky, řádek s údajem, patička se dvěma řádky
 * a stářím ve sloupci, zvýraznění podle délky ve sloupci.
 *
 * Odstřižené je všechno, co bylo o obchodech: provize a náklady (`formatCzk`,
 * `calculateDealNetCommission`), vlastník, tipař, makléř s avatarem, škola,
 * štítky z Kabinetu, typ akvizice, konec ZS, sdílení s kolegy a odkaz na
 * `/obchody`. Přetahování je na `@dnd-kit` (stack z `CLAUDE.md`) místo
 * nativního HTML5 drag & drop, které nefunguje na dotyku.
 */
export function KanbanCard({ card, stateLabel, onClick, overlay = false }: Props) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: card.id,
    data: { card },
    disabled: overlay,
  });

  const days = daysInState(card);
  const ageClass =
    days === null || days <= 14
      ? "text-muted-foreground"
      : days <= 30
        ? "text-warning"
        : "font-medium text-destructive";

  const due = dueDisplay(card.due);
  const title = card.title.trim() || cs.ukoly.kanban.bezNazvu;
  let hoverTitle = `${title} — ${stateLabel}`;
  if (due?.overdue) hoverTitle += ` — ${cs.ukoly.kanban.poTerminu}`;

  const handleClick = (e: MouseEvent) => {
    // Střední tlačítko / ⌘-klik nechá prohlížeči odkaz, když karta nějaký má.
    if (card.href && (e.metaKey || e.ctrlKey || e.button === 1)) return;
    e.preventDefault();
    onClick(card);
  };

  const Tag = card.href ? "a" : "div";

  return (
    <Tag
      ref={setNodeRef}
      href={card.href}
      style={{ transform: CSS.Translate.toString(transform) }}
      title={hoverTitle}
      onClick={handleClick}
      {...(overlay ? {} : { ...listeners, ...attributes })}
      className={cn(
        "relative flex h-[132px] w-full flex-shrink-0 cursor-grab flex-col overflow-hidden rounded-lg border border-border/60 bg-background p-2.5 text-sm shadow-sm transition-shadow hover:border-primary/20 hover:shadow-md active:cursor-grabbing",
        isDragging && !overlay && "opacity-40",
        overlay && "rotate-1 shadow-lg",
      )}
    >
      <div className="flex min-h-0 flex-1 flex-col">
        {/* Řádky 1–2: název (vždy vyhrazené 2 řádky, oříznutí přes line-clamp-2). */}
        <span className="block min-h-[2.6em] w-full break-words text-[13px] font-medium leading-[1.3] text-foreground line-clamp-2">
          {title}
        </span>
        {/* Řádek 3: termín + priorita. */}
        <div className="mt-1 flex min-w-0 items-center gap-1.5">
          {due ? (
            <span
              className={cn(
                "min-w-0 truncate text-[12px] font-medium tabular-nums",
                due.overdue ? "text-destructive" : "text-muted-foreground",
              )}
              title={`${cs.ukoly.kanban.termin}: ${due.absolute}`}
            >
              {due.relative}
            </span>
          ) : null}
          {card.priority ? (
            <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-[10px] font-semibold uppercase leading-[16px] text-primary">
              {card.priority}
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-auto grid flex-shrink-0 grid-cols-[1fr_auto] items-center gap-x-2 gap-y-1 border-t border-border/50 pt-2">
        <div className="min-w-0 truncate text-[11px] font-medium text-foreground/80">{card.contactLabel ?? ""}</div>
        <div className="min-w-0 truncate text-[11px] text-muted-foreground">{card.area ?? ""}</div>
        <div className="col-span-2 flex min-h-4 items-center justify-end">
          {days !== null ? (
            <span
              className={cn("text-[11px] tabular-nums", ageClass)}
              title={`${formatDaysCs(days)} ${cs.ukoly.kanban.veSloupci}`}
            >
              {formatDaysCs(days)}
            </span>
          ) : null}
        </div>
      </div>
    </Tag>
  );
}

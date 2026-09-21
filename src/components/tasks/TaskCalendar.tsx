import { useMemo, useState, type DragEvent } from "react";
import { addDays, addMonths, addWeeks, endOfMonth, endOfWeek, format, isSameDay, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import { cs as csLocale } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Plus } from "lucide-react";

import type { KanbanCardData } from "@/components/kanban";
import { Button } from "@/components/ui/button";
import { cs } from "@/lib/i18n/cs";
import { iso, isOverdue, splitDue } from "@/lib/taskDue";
import { cn } from "@/lib/utils";

interface TaskCalendarProps {
  cards: KanbanCardData[];
  today: string;
  onOpen: (card: KanbanCardData) => void;
  onReschedule: (card: KanbanCardData, dueDate: string, message: string) => void;
  onAddOn: (dueDate: string) => void;
}

const DRAG_TYPE = "text/ukol";

/**
 * Kalendář úkolů: týden nebo měsíc, dnešek zvýrazněný, úkol jde přetáhnout
 * na jiný den, „+" v rohu dne založí úkol s tím termínem.
 *
 * Převzato z `pages/crm/VbTasksPage.tsx` (vividbooks CRM, `831f9ae6`):
 * `calDays`, `byDay` s řazením podle času, `onDropDay` s nativním
 * drag & drop, mřížka 7 sloupců, limit 14 / 4 položek s „+N dalších".
 * Odstřižené: barvy podle typu aktivity (schůzka vs. úkol) — tady po
 * termínu = varovná, hotovo = ztlumená, jinak akcent; věta o Google
 * Kalendáři — zápis do iCloud je jen na kliknutí přes engine.
 */
export function TaskCalendar({ cards, today, onOpen, onReschedule, onAddOn }: TaskCalendarProps) {
  const t = cs.ukoly.kalendar;
  const [mode, setMode] = useState<"week" | "month">("week");
  const [cursor, setCursor] = useState(new Date());

  const days = useMemo(() => {
    const from = mode === "week" ? startOfWeek(cursor, { weekStartsOn: 1 }) : startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 });
    const to = mode === "week" ? endOfWeek(cursor, { weekStartsOn: 1 }) : endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 });
    const out: Date[] = [];
    for (let d = from; d <= to; d = addDays(d, 1)) out.push(d);
    return out;
  }, [cursor, mode]);

  const byDay = useMemo(() => {
    const m = new Map<string, KanbanCardData[]>();
    for (const card of cards) {
      const { date } = splitDue(card.due);
      if (!date) continue;
      const list = m.get(date) ?? [];
      list.push(card);
      m.set(date, list);
    }
    for (const list of m.values()) list.sort((a, b) => (splitDue(a.due).time || "99").localeCompare(splitDue(b.due).time || "99"));
    return m;
  }, [cards]);

  const byId = useMemo(() => new Map(cards.map((c) => [c.id, c])), [cards]);

  const onDropDay = (e: DragEvent, day: Date) => {
    e.preventDefault();
    const card = byId.get(e.dataTransfer.getData(DRAG_TYPE));
    const target = iso(day);
    if (card && splitDue(card.due).date !== target) {
      onReschedule(card, target, cs.ukoly.seznam.presunutoNa(format(day, "d. M.", { locale: csLocale })));
    }
  };

  const title =
    mode === "week"
      ? `${format(days[0], "d. M.", { locale: csLocale })} – ${format(days[6], "d. M. yyyy", { locale: csLocale })}`
      : format(cursor, "LLLL yyyy", { locale: csLocale });

  return (
    <section className="overflow-hidden rounded-2xl bg-card ring-1 ring-border/70">
      <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
        <Button variant="outline" size="sm" className="h-8" onClick={() => setCursor(new Date())}>
          {t.dnes}
        </Button>
        <button type="button" onClick={() => setCursor((c) => (mode === "week" ? addWeeks(c, -1) : addMonths(c, -1)))} className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted" aria-label={t.predchozi}>
          <ChevronLeft className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => setCursor((c) => (mode === "week" ? addWeeks(c, 1) : addMonths(c, 1)))} className="grid h-8 w-8 place-items-center rounded-md hover:bg-muted" aria-label={t.dalsi}>
          <ChevronRight className="h-4 w-4" />
        </button>
        <span className="text-sm font-semibold capitalize">{title}</span>
        <div className="ml-auto inline-flex h-8 items-center rounded-md bg-muted p-0.5 text-xs">
          {(["week", "month"] as const).map((m) => (
            <button key={m} type="button" onClick={() => setMode(m)} className={cn("rounded-sm px-2.5 py-1 font-medium", mode === m ? "bg-background shadow-sm" : "text-muted-foreground")}>
              {m === "week" ? t.tyden : t.mesic}
            </button>
          ))}
        </div>
      </div>
      <div className="grid grid-cols-7 border-b text-center text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        {t.dny.map((d) => (
          <div key={d} className="py-1.5">
            {d}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = iso(day);
          const list = byDay.get(key) ?? [];
          const isToday = isSameDay(day, new Date());
          const max = mode === "week" ? 14 : 4;
          return (
            <div
              key={key}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => onDropDay(e, day)}
              className={cn(
                "min-w-0 border-b border-r p-1.5 last:border-r-0",
                mode === "week" ? "min-h-[420px]" : "min-h-[116px]",
                mode === "month" && !isSameMonth(day, cursor) && "bg-muted/30",
                isToday && "bg-secondary/[0.05]",
              )}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className={cn("grid h-6 min-w-6 place-items-center rounded-full px-1 text-[12px] tabular-nums", isToday ? "bg-secondary font-bold text-secondary-foreground" : "text-muted-foreground")}>
                  {format(day, "d")}
                </span>
                <button type="button" onClick={() => onAddOn(key)} title={t.pridatNaDen} aria-label={t.pridatNaDen} className="grid h-5 w-5 place-items-center rounded text-muted-foreground/60 hover:bg-muted hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="space-y-1">
                {list.slice(0, max).map((card) => {
                  const done = card.state === "hotovo";
                  const over = isOverdue(card, today);
                  const { time } = splitDue(card.due);
                  return (
                    <button
                      key={card.id}
                      type="button"
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData(DRAG_TYPE, card.id)}
                      onClick={() => onOpen(card)}
                      title={`${card.title}${card.contactLabel ? ` · ${card.contactLabel}` : ""}`}
                      className={cn(
                        "flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-left text-[11.5px] leading-tight ring-1",
                        done ? "bg-muted/60 text-muted-foreground line-through ring-transparent" : over ? "bg-destructive/10 text-destructive ring-destructive/30" : "bg-secondary/10 ring-secondary/30",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">
                        {time ? <b className="mr-1 tabular-nums">{time}</b> : null}
                        {card.title}
                      </span>
                    </button>
                  );
                })}
                {list.length > max ? (
                  <button
                    type="button"
                    onClick={() => {
                      setMode("week");
                      setCursor(day);
                    }}
                    className="px-1 text-[11px] text-muted-foreground hover:underline"
                  >
                    {t.dalsich(list.length - max)}
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
      <p className="px-3 py-2 text-[11.5px] text-muted-foreground">{t.napoveda}</p>
    </section>
  );
}

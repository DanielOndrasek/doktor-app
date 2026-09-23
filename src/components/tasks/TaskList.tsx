import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { cs as csLocale } from "date-fns/locale";
import { CalendarDays, Check, Clock, ListTodo, Plus, Trash2 } from "lucide-react";

import type { KanbanCardData } from "@/components/kanban";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cs } from "@/lib/i18n/cs";
import { OPEN_BUCKETS, bucketOf, daysOverdue, iso, isOverdue, splitDue, type TaskBucket } from "@/lib/taskDue";
import { cn } from "@/lib/utils";

interface TaskListProps {
  cards: KanbanCardData[];
  today: string;
  onOpen: (card: KanbanCardData) => void;
  /** Kolečko vlevo: hotovo ↔ zpět do TODO (zapisuje `stav_zdroj = klik`). */
  onToggleDone: (card: KanbanCardData, done: boolean) => void;
  onReschedule: (card: KanbanCardData, dueDate: string, message: string) => void;
  /** Koš vpravo: úkol dostane `zruseno` (nemaže se) a jde vrátit z toastu. */
  onCancel: (card: KanbanCardData) => void;
  onAdd: () => void;
}

const RESCHEDULE: [keyof typeof cs.ukoly.seznam.presuny, number][] = [
  ["dnes", 0],
  ["zitra", 1],
  ["za3dny", 3],
  ["zaTyden", 7],
  ["za2tydny", 14],
];

/** „Hotovo" ukazuje jen dokončené za posledních 14 dní, jako `task_feed(p_done_days = 14)` v CRM. */
const DONE_DAYS = 14;

/**
 * Seznam úkolů po termínech: Po termínu · Dnes · Zítra · Tento týden ·
 * Později · Bez termínu, a Hotovo zvlášť. Filtr bucketů nahoře, prázdné
 * skupiny se neukazují, dlouhé se stránkují po 25 / 50.
 *
 * Převzato z `pages/crm/VbTasksPage.tsx` (vividbooks CRM, `831f9ae6`):
 * `BUCKETS`, řádek s kolečkem hotovo, termínem, přeplánováním z nabídky
 * a poznámkou na dva řádky, „přesunout vše na dnes" u víc než tří po
 * termínu. Odstřižené: typy aktivit (ikony), škola / osoba / obchod
 * s hodnotou, místo, Meet, kolega (`assigned_to`), AI návrh řešení
 * (`DealSummaryDialog`). Mazání z CRM je tu jako koš, ale úkol se nemaže —
 * dostane stav `zruseno` a jde vrátit zpět.
 */
export function TaskList({ cards, today, onOpen, onToggleDone, onReschedule, onCancel, onAdd }: TaskListProps) {
  const t = cs.ukoly.seznam;
  const [bucket, setBucket] = useState<TaskBucket | "open">("open");
  const [shown, setShown] = useState<Record<string, number>>({});

  const visible = useMemo(() => {
    const doneSince = iso(addDays(new Date(today), -DONE_DAYS));
    return cards.filter((c) => c.state !== "hotovo" || (c.stateEnteredAt ?? "") >= doneSince);
  }, [cards, today]);

  const counts = useMemo(() => {
    const c: Partial<Record<TaskBucket, number>> = {};
    for (const card of visible) {
      const b = bucketOf(card, today);
      c[b] = (c[b] ?? 0) + 1;
    }
    return c;
  }, [visible, today]);

  const openCount = OPEN_BUCKETS.reduce((a, b) => a + (counts[b] ?? 0), 0);
  const sections: TaskBucket[] = bucket === "open" ? OPEN_BUCKETS : [bucket];
  const anyInView = visible.some((c) => (bucket === "done" ? c.state === "hotovo" : c.state !== "hotovo"));

  const rescheduleMessage = (days: number) => (days === 0 ? t.presunutoNaDnes : t.presunutoO(days));

  const row = (card: KanbanCardData) => {
    const done = card.state === "hotovo";
    const over = isOverdue(card, today);
    const { date, time } = splitDue(card.due);
    return (
      <li key={card.id} className="group flex items-start gap-3 px-3.5 py-2.5 hover:bg-muted/40">
        <button
          type="button"
          onClick={() => onToggleDone(card, !done)}
          aria-label={done ? t.vratitMeziOtevrene : t.hotovoAria}
          className={cn(
            "mt-0.5 grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-2 transition-colors",
            done ? "border-success bg-success text-success-foreground" : "border-muted-foreground/40 text-transparent hover:border-success hover:text-success",
          )}
        >
          <Check className="h-3 w-3" strokeWidth={3} />
        </button>
        <div className="min-w-0 flex-1">
          <button
            type="button"
            onClick={() => onOpen(card)}
            className={cn("block max-w-full truncate text-left text-[14.5px] font-medium leading-snug hover:text-secondary", done && "text-muted-foreground line-through")}
          >
            {card.priority ? <span className="mr-1.5 rounded bg-muted px-1 text-[10.5px] font-semibold text-muted-foreground">{card.priority}</span> : null}
            {card.title}
          </button>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-muted-foreground">
            {date ? (
              <span className={cn("inline-flex items-center gap-1 tabular-nums", over && "font-semibold text-destructive")}>
                <Clock className="h-3 w-3" />
                {format(new Date(date), "EEE d. M.", { locale: csLocale })}
                {time ? ` ${time}` : ""}
                {over ? ` · ${t.dniPoTerminu(daysOverdue(card, today))}` : ""}
              </span>
            ) : null}
            {card.contactLabel ? <span className="max-w-[260px] truncate">{card.contactLabel}</span> : null}
            {card.area ? <span>{card.area}</span> : null}
            {!done && card.state !== "todo" ? <span className="rounded bg-muted px-1 text-[11px]">{cs.ukoly.stavy[card.state]}</span> : null}
          </div>
          {card.description ? <div className="mt-1 line-clamp-2 rounded-md bg-warning/10 px-2 py-1 text-[12.5px] text-foreground/80">{card.description}</div> : null}
        </div>
        <div className="flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
          {!done ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" title={t.preplanovat} aria-label={t.preplanovat} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground">
                  <CalendarDays className="h-3.5 w-3.5" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {RESCHEDULE.map(([key, days]) => (
                  <DropdownMenuItem key={key} onSelect={() => onReschedule(card, iso(addDays(new Date(), days)), rescheduleMessage(days))}>
                    {t.presuny[key]}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          <button
            type="button"
            onClick={() => onCancel(card)}
            title={t.smazat}
            aria-label={t.smazat}
            className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </li>
    );
  };

  return (
    <div className="space-y-4">
      {/* filtry – jeden řádek, prázdné skupiny se neukazují */}
      <div className="flex flex-nowrap items-center gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {(["open", ...OPEN_BUCKETS, "done"] as (TaskBucket | "open")[]).map((b) => {
          const n = b === "open" ? openCount : (counts[b] ?? 0);
          if (!n && bucket !== b && b !== "open") return null;
          return (
            <button
              key={b}
              type="button"
              onClick={() => setBucket(b)}
              title={b === "done" ? t.hotovoTitle : undefined}
              className={cn(
                "inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[12.5px] font-medium",
                bucket === b ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground ring-1 ring-inset ring-border hover:text-foreground",
              )}
            >
              {b === "open" ? t.otevrene : t.buckety[b]}
              <span className={cn("tabular-nums", b === "overdue" && n > 0 && bucket !== b && "font-bold text-destructive")}>{n}</span>
            </button>
          );
        })}
      </div>

      {sections.map((b) => {
        const list = visible.filter((c) => bucketOf(c, today) === b);
        if (!list.length) return null;
        const lim = shown[b] ?? 25;
        return (
          <section key={b}>
            <h2 className={cn("mb-1.5 flex items-center gap-2 px-1 text-[12px] font-bold uppercase tracking-[0.06em]", b === "overdue" ? "text-destructive" : "text-muted-foreground")}>
              {t.buckety[b]}
              <span className="font-normal tabular-nums">{list.length}</span>
              {b === "overdue" && list.length > 3 ? (
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm(t.potvrditPresunVse(list.length))) list.forEach((c) => onReschedule(c, today, t.presunutoNaDnes));
                  }}
                  className="ml-auto text-[11.5px] font-medium normal-case tracking-normal text-secondary hover:underline"
                >
                  {t.presunoutVseNaDnes}
                </button>
              ) : null}
            </h2>
            <ul className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card ring-1 ring-border/70">{list.slice(0, lim).map(row)}</ul>
            {list.length > lim ? (
              <button type="button" onClick={() => setShown((s) => ({ ...s, [b]: lim + 50 }))} className="mt-1.5 w-full rounded-lg py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/60">
                {t.dalsich(Math.min(50, list.length - lim), list.length - lim)}
              </button>
            ) : null}
          </section>
        );
      })}

      {!anyInView ? (
        <div className="rounded-xl border border-dashed bg-card/60 px-4 py-10 text-center">
          <ListTodo className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
          <p className="text-sm font-medium">{t.nicTuNeni}</p>
          <Button size="sm" className="mt-3" onClick={onAdd}>
            <Plus className="mr-1 h-4 w-4" />
            {cs.ukoly.kanban.pridatUkol}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

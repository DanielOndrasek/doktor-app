import { useState } from "react";
import { format, isValid, parseISO } from "date-fns";
import { cs as csLocale } from "date-fns/locale";
import { AlertTriangle, CalendarPlus, Check, Loader2, MapPin, Mail, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";
import type { CalendarRef, EventProposal } from "@/lib/events";

function formatRange(event: EventProposal): { label: string; title: string } {
  const start = parseISO(event.start);
  const end = event.end ? parseISO(event.end) : null;
  if (!isValid(start)) return { label: event.start, title: event.start };
  const day = format(start, "EEEE d. MMMM yyyy", { locale: csLocale });
  if (event.allDay) return { label: `${format(start, "d. M. yyyy", { locale: csLocale })} · ${cs.udalosti.celodenni}`, title: day };
  const from = format(start, "d. M. yyyy HH:mm", { locale: csLocale });
  const to = end && isValid(end) ? format(end, "HH:mm", { locale: csLocale }) : null;
  return { label: to ? `${from} – ${to}` : from, title: day };
}

interface EventCardProps {
  event: EventProposal;
  calendars: CalendarRef[];
  onAdd: (event: EventProposal, calendarId: string) => Promise<void>;
  onReject: (event: EventProposal) => Promise<void>;
  /** Zvýraznění karty, na kterou vede odkaz `/udalosti?udalost=<id>` (z Dnes, z přehledu běhů). */
  highlighted?: boolean;
}

/**
 * Karta návrhu události: čas, místo, původ (zpráva), kolize ve vrstvách
 * kalendářů, výběr kalendáře a dvě akce. Zápis do kalendáře jde **jen**
 * z tlačítka — nikdy sám (`CLAUDE.md`, „Čeho se vyvarovat").
 */
export function EventCard({ event, calendars, onAdd, onReject, highlighted }: EventCardProps) {
  const [calendarId, setCalendarId] = useState<string>(event.calendarId ?? calendars[0]?.id ?? "");
  const [busy, setBusy] = useState<"add" | "reject" | null>(null);
  const when = formatRange(event);
  const conflicts = event.conflicts ?? [];
  const isNew = event.state === "novy";
  const calendarName = calendars.find((c) => c.id === (event.calendarId ?? calendarId))?.name;

  const run = async (kind: "add" | "reject") => {
    setBusy(kind);
    try {
      if (kind === "add") await onAdd(event, calendarId);
      else await onReject(event);
    } finally {
      setBusy(null);
    }
  };

  return (
    <li
      id={`udalost-${event.id}`}
      className={cn(
        "home-surface-plain relative overflow-hidden rounded-2xl bg-card px-4 py-3",
        event.state === "zamitnuto" && "opacity-60",
        highlighted && "ring-2 ring-secondary",
      )}
    >
      <span
        aria-hidden
        className={cn(
          "absolute inset-y-0 left-0 w-1",
          event.state === "pridano" ? "bg-success" : conflicts.length ? "bg-warning" : "bg-secondary",
        )}
      />
      <div className="pl-2">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[14.5px] font-semibold leading-tight text-foreground">{event.title}</div>
            <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-muted-foreground">
              <span className="tabular-nums" title={when.title}>
                {when.label}
              </span>
              {event.place ? (
                <>
                  <span>·</span>
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3" />
                    {event.place}
                  </span>
                </>
              ) : null}
              {event.itemLabel ? (
                <>
                  <span>·</span>
                  {event.itemHref ? (
                    <a href={event.itemHref} className="inline-flex items-center gap-1 hover:underline">
                      <Mail className="h-3 w-3" />
                      {event.itemLabel}
                    </a>
                  ) : (
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {event.itemLabel}
                    </span>
                  )}
                </>
              ) : null}
            </div>
          </div>
          {event.state === "pridano" ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[11px] font-semibold text-success">
              <Check className="h-3 w-3" />
              {cs.udalosti.pridano}
              {calendarName ? ` · ${calendarName}` : ""}
            </span>
          ) : null}
        </div>

        {conflicts.length ? (
          <div className="mt-2 rounded-lg border border-warning/40 bg-warning/10 px-3 py-2 text-[12.5px]">
            <div className="mb-1 inline-flex items-center gap-1 font-semibold text-warning">
              <AlertTriangle className="h-3.5 w-3.5" />
              {cs.udalosti.kolizeS(conflicts.length)}
            </div>
            <ul className="space-y-0.5 text-foreground/90">
              {conflicts.map((c, i) => {
                const s = parseISO(c.start);
                const e = c.end ? parseISO(c.end) : null;
                const time = isValid(s)
                  ? `${format(s, "HH:mm")}${e && isValid(e) ? `–${format(e, "HH:mm")}` : ""}`
                  : c.start;
                return (
                  <li key={i}>
                    <span className="tabular-nums text-muted-foreground">{time}</span> {c.title}{" "}
                    <span className="text-muted-foreground">({cs.udalosti.vKalendari(c.calendar)})</span>
                  </li>
                );
              })}
            </ul>
          </div>
        ) : null}

        {isNew ? (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Select value={calendarId} onValueChange={setCalendarId} disabled={!calendars.length || busy !== null}>
              <SelectTrigger className="h-8 w-56 text-xs" aria-label={cs.udalosti.kalendar}>
                <SelectValue placeholder={cs.udalosti.vybratKalendar} />
              </SelectTrigger>
              <SelectContent>
                {calendars.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" className="h-8" disabled={!calendarId || busy !== null} onClick={() => void run("add")}>
              {busy === "add" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <CalendarPlus className="mr-1.5 h-3.5 w-3.5" />}
              {busy === "add" ? cs.udalosti.pridavam : cs.udalosti.pridatDoKalendare}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" disabled={busy !== null} onClick={() => void run("reject")}>
              {busy === "reject" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <X className="mr-1.5 h-3.5 w-3.5" />}
              {cs.udalosti.zamitnout}
            </Button>
          </div>
        ) : null}
      </div>
    </li>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

import { EventCard } from "@/components/events/EventCard";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import type { CalendarRef, EventProposal, EventSource, EventState } from "@/lib/events";

const STATES: EventState[] = ["novy", "pridano", "zamitnuto"];
/** `/udalosti?udalost=<id>` — odkaz z Dnes (`dnes()`) a z přehledu běhů; přepne záložku a kartu zvýrazní. */
const EVENT_PARAM = "udalost";

/**
 * Události (K3.7): návrhy z mailů se stavem nové · přidané · zamítnuté,
 * kolize ve vrstvách kalendářů a zápis do kalendáře jen na kliknutí.
 * Vlastní události (úprava, mazání) jsou O7 a K5 — tady se jen schvaluje,
 * co navrhl běh.
 */
export default function Events({ source }: { source: EventSource }) {
  const { toast } = useToast();
  const [events, setEvents] = useState<EventProposal[]>([]);
  const [calendars, setCalendars] = useState<CalendarRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<EventState>("novy");
  const [searchParams, setSearchParams] = useSearchParams();
  // Zvýraznění se drží ve stavu a parametr se po prvním použití uklidí — jinak by každá
  // změna události (Přidat, Zamítnout) znovu přepínala záložku podle odkazu.
  const [highlightId, setHighlightId] = useState<string | null>(() => searchParams.get(EVENT_PARAM));
  const [highlightDone, setHighlightDone] = useState(false);

  // Odkaz na událost: až jsou data, jednou přepnout na její záložku a přijet ke kartě.
  useEffect(() => {
    if (loading || !highlightId || highlightDone) return;
    setHighlightDone(true);
    setSearchParams(
      (prev) => {
        prev.delete(EVENT_PARAM);
        return prev;
      },
      { replace: true },
    );
    const target = events.find((e) => e.id === highlightId);
    if (!target) {
      setHighlightId(null);
      return;
    }
    setState(target.state);
    const timer = window.setTimeout(() => {
      document.getElementById(`udalost-${target.id}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loading, highlightId, highlightDone, events, setSearchParams]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [items, cals] = await Promise.all([source.load(), source.calendars()]);
      setEvents(items);
      setCalendars(cals);
    } catch (err) {
      toast({
        title: cs.udalosti.nacteniSelhalo,
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

  const counts = useMemo(
    () =>
      events.reduce<Record<EventState, number>>(
        (m, e) => {
          m[e.state] += 1;
          return m;
        },
        { novy: 0, pridano: 0, zamitnuto: 0 },
      ),
    [events],
  );
  const list = events.filter((e) => e.state === state);

  const patch = (id: string, next: Partial<EventProposal>) =>
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, ...next } : e)));

  const add = async (event: EventProposal, calendarId: string) => {
    try {
      const { calUid } = await source.add(event, calendarId);
      patch(event.id, { state: "pridano", calendarId, calUid });
      toast({ title: cs.udalosti.pridano });
    } catch (err) {
      toast({
        title: cs.udalosti.pridaniSelhalo,
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const reject = async (event: EventProposal) => {
    try {
      await source.reject(event);
      patch(event.id, { state: "zamitnuto" });
      toast({ title: cs.udalosti.zamitnuto });
    } catch (err) {
      toast({
        title: cs.udalosti.zamitnutiSelhalo,
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  return (
    <main className="container mx-auto px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 md:pb-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{cs.udalosti.titulek}</h1>
          <ToggleGroup
            type="single"
            size="sm"
            value={state}
            onValueChange={(v) => {
              if (STATES.includes(v as EventState)) setState(v as EventState);
            }}
            className="rounded-lg bg-muted p-0.5"
          >
            {STATES.map((s) => (
              <ToggleGroupItem
                key={s}
                value={s}
                className="h-7 gap-1.5 rounded-md px-2.5 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm"
              >
                {cs.udalosti.stav[s]}
                <span className="tabular-nums text-muted-foreground">{counts[s]}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          {!loading && events.length === 0 ? (
            <span className="text-xs text-muted-foreground">{cs.udalosti.bezZdroje}</span>
          ) : null}
          {!loading && calendars.length === 0 && counts.novy > 0 ? (
            <span className="text-xs text-warning">{cs.udalosti.bezKalendaru}</span>
          ) : null}
        </div>

        {loading ? (
          <ul className="space-y-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-24 animate-pulse rounded-2xl bg-card/60" />
            ))}
          </ul>
        ) : list.length === 0 ? (
          <div className="home-surface-plain rounded-2xl bg-card px-4 py-6 text-center text-sm text-muted-foreground">
            {cs.udalosti.zadne[state]}
          </div>
        ) : (
          <ul className="space-y-3">
            {list.map((e) => (
              <EventCard key={e.id} event={e} calendars={calendars} onAdd={add} onReject={reject} highlighted={e.id === highlightId} />
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

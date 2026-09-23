import { useMemo, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  Check,
  Clock,
  ExternalLink,
  ListTodo,
  Mail,
  PenLine,
  Reply,
  Sparkles,
  ThumbsDown,
  type LucideIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";
import type { Signal, SignalAction, SignalCategory, SignalDismissAction, SignalUrgency } from "@/lib/today";
import { EvidenceChips } from "./EvidenceChips";

/** Naléhavost: barva karty = naléhavost, kategorie jen ikonou. Barvy z tokenů. */
const URG: Record<SignalUrgency, { label: string; bar: string; badge: string; dot: string }> = {
  1: { label: cs.dnes.urg[1], bar: "bg-destructive", badge: "bg-destructive/15 text-destructive", dot: "bg-destructive" },
  2: { label: cs.dnes.urg[2], bar: "bg-warning", badge: "bg-warning/15 text-warning", dot: "bg-warning" },
  3: { label: cs.dnes.urg[3], bar: "bg-secondary", badge: "bg-secondary/15 text-secondary", dot: "bg-secondary" },
  4: { label: cs.dnes.urg[4], bar: "bg-muted-foreground/50", badge: "bg-muted text-muted-foreground", dot: "bg-muted-foreground/50" },
};

const CAT: Record<SignalCategory, { label: string; icon: LucideIcon }> = {
  p1: { label: cs.dnes.kategorie.p1, icon: AlertTriangle },
  koncept: { label: cs.dnes.kategorie.koncept, icon: PenLine },
  termin: { label: cs.dnes.kategorie.termin, icon: ListTodo },
  udalost: { label: cs.dnes.kategorie.udalost, icon: CalendarClock },
  odpoved: { label: cs.dnes.kategorie.odpoved, icon: Reply },
};

const ICONS: Record<string, LucideIcon> = {
  mail: Mail,
  reply: Reply,
  task: ListTodo,
  event: CalendarClock,
  "external-link": ExternalLink,
};

interface TodaySignalsProps {
  signals: Signal[];
  loading?: boolean;
  onDismiss: (signal: Signal, action: SignalDismissAction) => Promise<void>;
  onAction: (signal: Signal, action: SignalAction) => void;
}

/**
 * „Čemu se dnes věnovat": dlaždice s počty podle kategorie, filtr, karty
 * signálů s akcemi a odložením.
 *
 * Převzato z `components/home/TodaySignals.tsx` (vividbooks CRM, `831f9ae6`).
 * Kategorie jsou z K3.5 (P1, po termínu, dnešní události, čeká na odpověď)
 * místo trialů, obnov, faktur a nabídek. Nepřebráno: volání RPC
 * `today_signals` / `signal_dismiss` (data chodí propsy), přepínač
 * Moje / Všichni (jeden uživatel), sbalený pruh „Administrativa"
 * a slučování faktur po splatnosti jednoho odběratele, mezipaměť
 * v `sessionStorage` (patří k tomu, kdo data načítá), navigace na
 * `/obchody` a `/databaze` (akce nesou `href` a obrazovka je jen předá).
 */
export function TodaySignals({ signals, loading = false, onDismiss, onAction }: TodaySignalsProps) {
  const [cat, setCat] = useState<SignalCategory | "vse">("vse");
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  const rows = useMemo(
    () => signals.filter((s) => !hidden.has(s.key)).slice().sort((a, b) => a.urg - b.urg),
    [signals, hidden],
  );
  const counts = useMemo(
    () =>
      rows.reduce<Record<string, number>>((m, r) => {
        m[r.cat] = (m[r.cat] ?? 0) + 1;
        return m;
      }, {}),
    [rows],
  );
  const list = rows.filter((r) => cat === "vse" || r.cat === cat);

  const dismiss = async (signal: Signal, action: SignalDismissAction) => {
    // Optimisticky pryč; při chybě zpět.
    setHidden((prev) => new Set(prev).add(signal.key));
    try {
      await onDismiss(signal, action);
    } catch {
      setHidden((prev) => {
        const next = new Set(prev);
        next.delete(signal.key);
        return next;
      });
    }
  };

  return (
    <section className="animate-fade-in-up">
      <div className="mb-3 flex flex-wrap items-center gap-2.5 px-1">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{cs.dnes.cemuSeVenovat}</h2>
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary/10 px-2.5 py-0.5 text-[11.5px] font-bold text-secondary">
          <Sparkles className="h-3 w-3" /> {rows.length}
        </span>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(Object.entries(CAT) as [SignalCategory, (typeof CAT)[SignalCategory]][]).map(([k, c]) => {
          const n = counts[k] ?? 0;
          return (
            <button
              key={k}
              type="button"
              onClick={() => setCat(cat === k ? "vse" : k)}
              className={cn(
                "home-surface-plain flex items-center gap-2.5 rounded-2xl bg-card px-3 py-2.5 text-left transition-all hover:-translate-y-0.5",
                cat === k && "ring-2 ring-secondary/60",
                !n && "opacity-55",
              )}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary/10 text-secondary">
                <c.icon className="h-4 w-4" />
              </span>
              <span className="min-w-0">
                <span className="block text-lg font-bold leading-none tabular-nums text-foreground">{n}</span>
                <span className="mt-0.5 block truncate text-[11.5px] font-medium leading-tight text-muted-foreground">{c.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      {cat !== "vse" ? (
        <div className="mb-2 flex items-center gap-2 px-1 text-xs text-muted-foreground">
          {cs.dnes.filtr} <b className="text-foreground">{CAT[cat].label}</b>
          <button type="button" onClick={() => setCat("vse")} className="font-semibold text-secondary">
            {cs.dnes.zrusitFiltr}
          </button>
        </div>
      ) : null}

      {loading ? (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <li key={i} className="h-28 animate-pulse rounded-2xl bg-card/60" />
          ))}
        </ul>
      ) : !list.length ? (
        <div className="home-surface-plain rounded-2xl bg-card px-4 py-6 text-center text-sm text-muted-foreground">
          {cs.dnes.nicNalehaveho}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
          {list.map((r) => {
            const u = URG[r.urg] ?? URG[4];
            const c = CAT[r.cat];
            return (
              <li key={r.key} className="home-surface-plain relative overflow-hidden rounded-2xl bg-card px-4 py-3">
                <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", u.bar)} />
                <div className="pl-2">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      {r.href ? (
                        <a href={r.href} className="block text-[14.5px] font-semibold leading-tight text-foreground hover:underline">
                          {r.title}
                        </a>
                      ) : (
                        <span className="block text-[14.5px] font-semibold leading-tight text-foreground">{r.title}</span>
                      )}
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12.5px] text-muted-foreground">
                        <span className={cn("inline-flex items-center gap-1 rounded-full px-1.5 py-px text-[10.5px] font-bold uppercase tracking-wide", u.badge)}>
                          <span className={cn("h-1.5 w-1.5 rounded-full", u.dot)} />
                          {u.label}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <c.icon className="h-3 w-3" />
                          {c.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center">
                      <button type="button" onClick={() => void dismiss(r, "done")} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent" title={cs.dnes.hotovo}>
                        <Check className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => void dismiss(r, "snoozed")} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent" title={cs.dnes.odlozit}>
                        <Clock className="h-3.5 w-3.5" />
                      </button>
                      <button type="button" onClick={() => void dismiss(r, "irrelevant")} className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent" title={cs.dnes.nerelevantni}>
                        <ThumbsDown className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="mt-1.5 text-[13px] text-foreground/90">{r.why}</p>
                  {r.evidence.length ? <EvidenceChips items={r.evidence} /> : null}
                  {r.actions.length ? (
                    <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
                      {r.actions.map((a, k) => {
                        const Icon = ICONS[a.icon] ?? ExternalLink;
                        return (
                          <Button key={a.href + k} size="sm" variant={k ? "outline" : "default"} className="h-7 px-2.5 text-xs" onClick={() => onAction(r, a)}>
                            <Icon className="mr-1 h-3.5 w-3.5" />
                            {a.label}
                          </Button>
                        );
                      })}
                    </div>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

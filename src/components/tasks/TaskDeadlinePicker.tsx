import { useMemo, useState } from "react";
import { format, parse as parseDateFns } from "date-fns";
import { cs as csLocale } from "date-fns/locale";
import { CalendarIcon, Clock, Sun, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";

interface TaskDeadlinePickerProps {
  /** ISO datum „YYYY-MM-DD" nebo prázdný řetězec = bez termínu. */
  date: string;
  /** Čas „HH:MM" nebo prázdný řetězec = celodenní. */
  time: string;
  onChange: (next: { date: string; time: string }) => void;
  /** Defaultně `md`; `sm` pro kompaktní formuláře. */
  size?: "sm" | "md";
  className?: string;
  id?: string;
}

/* Presety času v půlhodinovém rastru 7:00–20:00; jiný čas jde zapsat ručně. */
const TIME_PRESETS: string[] = (() => {
  const out: string[] = [];
  for (let h = 7; h <= 20; h += 1) {
    out.push(`${String(h).padStart(2, "0")}:00`);
    out.push(`${String(h).padStart(2, "0")}:30`);
  }
  return out;
})();

/** Bezpečné čtení ISO data; neplatný vstup nesmí vyhodit výjimku do renderu. */
function parseIso(iso: string): Date | undefined {
  if (!iso) return undefined;
  const parsed = parseDateFns(iso, "yyyy-MM-dd", new Date());
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatDate(iso: string): string {
  const parsed = parseIso(iso);
  return parsed ? format(parsed, "d. M. yyyy", { locale: csLocale }) : iso;
}

/**
 * Termín úkolu: datum + volitelný čas s režimem „celodenní". Dva nezávislé
 * popovery; výběr data nezavírá ani neotvírá čas — většina úkolů čas nemá.
 *
 * Převzato z `components/tasks/TaskDeadlinePicker.tsx` (vividbooks CRM,
 * `831f9ae6`); texty přes `cs.ukoly.terminVyber`, kalendář na react-day-picker
 * v9 stejně jako `DatePicker`. Popisky pro ARIA nejsou props — jsou v `cs`.
 */
export function TaskDeadlinePicker({ date, time, onChange, size = "md", className, id }: TaskDeadlinePickerProps) {
  const t = cs.ukoly.terminVyber;
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [customTime, setCustomTime] = useState("");

  const selectedDate = useMemo(() => parseIso(date), [date]);
  const triggerHeight = size === "sm" ? "h-8" : "h-10";

  const dateLabel = date ? formatDate(date) : t.vybratDatum;
  const timeLabel = !date ? "—" : time ? time : t.celodenni;

  const selectDate = (d: Date | undefined) => {
    onChange(d ? { date: format(d, "yyyy-MM-dd"), time } : { date: "", time: "" });
    setDateOpen(false);
  };
  const selectTime = (next: string) => {
    onChange({ date, time: next });
    setTimeOpen(false);
  };
  const allDay = () => selectTime("");
  const clearAll = () => {
    onChange({ date: "", time: "" });
    setDateOpen(false);
    setTimeOpen(false);
  };

  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      <Popover open={dateOpen} onOpenChange={setDateOpen}>
        <PopoverTrigger asChild>
          <Button
            id={id}
            type="button"
            variant="outline"
            size="sm"
            aria-label={t.datumTerminu}
            className={cn(
              // 8rem udrží čitelné „29. 5. 2026" i v úzkém sloupci; jinak flex-wrap zalomí čas na další řádek.
              "min-w-[8rem] flex-1 justify-start gap-2 px-3 text-sm font-normal",
              triggerHeight,
              !date && "text-muted-foreground",
            )}
          >
            <CalendarIcon className="h-4 w-4 shrink-0" aria-hidden />
            <span className="truncate">{dateLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={selectDate}
            defaultMonth={selectedDate}
            locale={csLocale}
            weekStartsOn={1}
            autoFocus
          />
          {date ? (
            <div className="flex items-center justify-between border-t px-3 py-2">
              <button
                type="button"
                onClick={clearAll}
                className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive focus-visible:underline focus-visible:outline-none"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
                {t.smazatTermin}
              </button>
            </div>
          ) : null}
        </PopoverContent>
      </Popover>

      <Popover open={timeOpen} onOpenChange={setTimeOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!date}
            aria-label={t.casTerminu}
            className={cn("min-w-[6.5rem] shrink-0 justify-start gap-2 px-3 text-sm font-normal", triggerHeight, !time && "text-muted-foreground")}
          >
            {!time ? <Sun className="h-4 w-4 shrink-0" aria-hidden /> : <Clock className="h-4 w-4 shrink-0" aria-hidden />}
            <span className="truncate">{timeLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64 p-0" align="end">
          <div className="border-b px-2 py-2">
            <button
              type="button"
              onClick={allDay}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                !time && "bg-secondary/10 font-medium text-foreground",
              )}
            >
              <Sun className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
              <div className="min-w-0 flex-1">
                <div>{t.celodenniUkol}</div>
                <div className="text-[11px] text-muted-foreground">{t.bezKonkretnihoCasu}</div>
              </div>
              {!time ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-secondary" aria-hidden /> : null}
            </button>
          </div>
          <div className="max-h-60 overflow-y-auto px-2 py-2">
            <div className="px-1 pb-1 text-[11px] uppercase tracking-wide text-muted-foreground">{t.konkretniCas}</div>
            <div className="grid grid-cols-3 gap-1">
              {TIME_PRESETS.map((preset) => (
                <button
                  type="button"
                  key={preset}
                  onClick={() => selectTime(preset)}
                  className={cn(
                    "rounded-md px-1.5 py-1 text-center text-sm tabular-nums transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
                    time === preset && "bg-secondary text-secondary-foreground hover:bg-secondary/90",
                  )}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>
          <div className="border-t px-2 py-2">
            <div className="mb-1 px-1 text-[11px] uppercase tracking-wide text-muted-foreground">{t.vlastniCas}</div>
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                if (customTime) {
                  selectTime(customTime);
                  setCustomTime("");
                }
              }}
            >
              <Input
                type="time"
                value={customTime || time}
                onChange={(e) => setCustomTime(e.target.value)}
                className="h-8 flex-1 text-sm"
                aria-label={t.vlastniCas}
              />
              <Button type="submit" size="sm" variant="secondary" className="h-8 px-3" disabled={!customTime}>
                {t.nastavit}
              </Button>
            </form>
            {time ? (
              <button
                type="button"
                onClick={allDay}
                className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:underline focus-visible:outline-none"
              >
                <X className="h-3 w-3" aria-hidden />
                {t.vymazatCas}
              </button>
            ) : null}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}

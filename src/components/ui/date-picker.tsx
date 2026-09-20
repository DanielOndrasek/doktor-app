import { useMemo, useState } from "react";
import { format, parse as parseDateFns } from "date-fns";
import { cs as csLocale } from "date-fns/locale";
import { CalendarIcon, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";

interface DatePickerProps {
  /** ISO datum „YYYY-MM-DD" nebo prázdný string = bez data. */
  value: string;
  onChange: (next: string) => void;
  /** Defaultně `md`; `sm` pro inline / kompaktní formuláře. */
  size?: "sm" | "md";
  /** Placeholder text v triggeru když není datum zvolené. */
  placeholder?: string;
  /** Skrytý popisek pro ARIA. */
  ariaLabel?: string;
  /** Povolit smazání data (tlačítko v popoveru). Default `true`. */
  clearable?: boolean;
  /** Pokud `true`, datum nelze měnit. */
  disabled?: boolean;
  className?: string;
  id?: string;
  /** Volitelný start měsíce — defaultně dnes nebo aktuální hodnota. */
  defaultMonth?: Date;
  /** Nejdřívější povolené datum (ISO `YYYY-MM-DD`). */
  minDate?: string;
  /** Nejpozdější povolené datum (ISO `YYYY-MM-DD`). */
  maxDate?: string;
  /**
   * Layout hlavičky kalendáře (hodnoty react-day-picker v9):
   * - `label` (default) — název měsíce a šipky vlevo/vpravo
   * - `dropdown` — selecty pro měsíc i rok
   * - `dropdown-months` / `dropdown-years` — select jen pro jedno z nich
   *
   * Při `dropdown*` je vhodné nastavit `minDate`/`maxDate`, jinak se použije
   * 100 let dozadu a konec letošního roku.
   */
  captionLayout?: "label" | "dropdown" | "dropdown-months" | "dropdown-years";
}

/** Bezpečné čtení ISO data; neplatný vstup nesmí vyhodit výjimku do renderu. */
function parseIso(iso: string | undefined): Date | undefined {
  if (!iso) return undefined;
  const parsed = parseDateFns(iso, "yyyy-MM-dd", new Date());
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function formatDate(iso: string): string {
  const parsed = parseIso(iso);
  return parsed ? format(parsed, "d. M. yyyy", { locale: csLocale }) : iso;
}

/**
 * Jednotný picker pouze pro datum (bez času). Nahrazuje nativní
 * `<input type="date">`, který má napříč OS a prohlížeči jiný vzhled.
 *
 * Převzato z vividbooks CRM (`831f9ae6`); texty přesunuty do
 * `src/lib/i18n/cs.ts` a props kalendáře přepsané na react-day-picker v9.
 */
export function DatePicker({
  value,
  onChange,
  size = "md",
  placeholder = cs.datum.vybratDatum,
  ariaLabel = cs.datum.popisek,
  clearable = true,
  disabled = false,
  className,
  id,
  defaultMonth,
  minDate,
  maxDate,
  captionLayout,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);

  const selectedDate = useMemo(() => parseIso(value), [value]);
  const minDateObj = useMemo(() => parseIso(minDate), [minDate]);
  const maxDateObj = useMemo(() => parseIso(maxDate), [maxDate]);

  const triggerHeight = size === "sm" ? "h-8" : "h-10";

  const label = value ? formatDate(value) : placeholder;

  const handleSelect = (d: Date | undefined) => {
    onChange(d ? format(d, "yyyy-MM-dd") : "");
    setOpen(false);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          size="sm"
          aria-label={ariaLabel}
          disabled={disabled}
          className={cn(
            "w-full min-w-0 justify-start gap-2 px-3 font-normal text-sm",
            triggerHeight,
            !value && "text-muted-foreground",
            className,
          )}
        >
          <CalendarIcon className="h-4 w-4 shrink-0" aria-hidden />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={handleSelect}
          defaultMonth={selectedDate ?? defaultMonth}
          locale={csLocale}
          weekStartsOn={1}
          startMonth={minDateObj}
          endMonth={maxDateObj}
          disabled={[
            ...(minDateObj ? [{ before: minDateObj }] : []),
            ...(maxDateObj ? [{ after: maxDateObj }] : []),
          ]}
          captionLayout={captionLayout}
          autoFocus
        />
        {clearable && value ? (
          <div className="flex items-center justify-between border-t px-3 py-2">
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:underline"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden />
              {cs.datum.smazatDatum}
            </button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}

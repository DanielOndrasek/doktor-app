import { useEffect, useMemo, useRef, useState } from "react";
import type { ClipboardEvent, KeyboardEvent } from "react";
import { User, X } from "lucide-react";

import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { cn, normalizeSearch } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";
import type { EmailRecipientSuggestion } from "@/lib/email/compose";

interface EmailRecipientsInputProps {
  /** Aktuální seznam e-mailových adres. */
  value: string[];
  onChange: (emails: string[]) => void;
  /** Návrhy, které zná volající předem (účastníci vlákna, kontakt u položky). */
  suggestions?: EmailRecipientSuggestion[];
  /**
   * Hledání v adresáři. Volá se s odstupem 250 ms od posledního znaku.
   *
   * Je to prop, ne import: CRM tady sahalo přímo do svých tabulek osob
   * (`lib/partySearch`), což je schéma `crm`. Kdo adresář drží, rozhoduje
   * volající — kontakty Doktora přijdou v řádku „Karta kontaktu".
   */
  onSearch?: (query: string) => Promise<EmailRecipientSuggestion[]>;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(e: string): boolean {
  return EMAIL_RE.test(e.trim());
}

function normEmail(e: string): string {
  return e.trim().toLowerCase();
}

/**
 * Pole adresátů s odznáčky a našeptávačem. Převzato z vividbooks CRM
 * (`831f9ae6`).
 *
 * Odstřižené: `searchEmailRecipients` nad tabulkami osob CRM (nahrazeno
 * propem `onSearch`) a pevné pořadí rolí „Vlastník · Kupující · Nájemník ·
 * Zájemce" — to jsou role realitního CRM. Skupiny se teď řadí abecedně
 * a „Ostatní" jde na konec.
 */
export function EmailRecipientsInput({
  value,
  onChange,
  suggestions = [],
  onSearch,
  placeholder = cs.posta.psani.adresaPlaceholder,
  autoFocus,
  className,
}: EmailRecipientsInputProps) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [searchHits, setSearchHits] = useState<EmailRecipientSuggestion[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const existing = useMemo(() => new Set(value.map(normEmail)), [value]);

  useEffect(() => {
    if (!onSearch || !query.trim()) {
      setSearchHits([]);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const hits = await onSearch(query);
        if (!cancelled) setSearchHits(hits);
      } catch {
        // Našeptávač nesmí shodit psaní zprávy — bez výsledků se prostě píše ručně.
        if (!cancelled) setSearchHits([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query, onSearch]);

  const addEmail = (raw: string) => {
    const email = raw.trim().replace(/[,;]+$/, "").trim();
    if (!email || !isValidEmail(email)) return false;
    if (existing.has(normEmail(email))) {
      setQuery("");
      return true;
    }
    onChange([...value, email]);
    setQuery("");
    return true;
  };

  const removeEmail = (email: string) => {
    onChange(value.filter((e) => e !== email));
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === "," || e.key === ";" || e.key === "Tab") {
      if (query.trim()) {
        if (addEmail(query)) {
          e.preventDefault();
        } else if (e.key !== "Tab") {
          e.preventDefault();
        }
      }
    } else if (e.key === "Backspace" && query === "" && value.length > 0) {
      removeEmail(value[value.length - 1]);
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (text && /[,;\s]/.test(text)) {
      e.preventDefault();
      const parts = text.split(/[,;\s]+/).filter(Boolean);
      const next = [...value];
      const seen = new Set(value.map(normEmail));
      for (const p of parts) {
        if (isValidEmail(p) && !seen.has(normEmail(p))) {
          next.push(p.trim());
          seen.add(normEmail(p));
        }
      }
      onChange(next);
      setQuery("");
    }
  };

  const filteredSuggestions = useMemo(() => {
    const q = normalizeSearch(query.trim());
    return suggestions
      .filter((s) => s.email && !existing.has(normEmail(s.email)))
      .filter((s) =>
        q === "" ? true : normalizeSearch(`${s.label} ${s.email} ${s.group || ""}`).includes(q),
      );
  }, [suggestions, query, existing]);

  const groupedSuggestions = useMemo(() => {
    const groups = new Map<string, EmailRecipientSuggestion[]>();
    for (const s of filteredSuggestions) {
      const group = s.group || cs.posta.psani.ostatni;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group)!.push(s);
    }
    // „Ostatní" je vždy poslední, zbytek abecedně podle češtiny.
    return [...groups.entries()].sort(([a], [b]) => {
      if (a === cs.posta.psani.ostatni) return 1;
      if (b === cs.posta.psani.ostatni) return -1;
      return a.localeCompare(b, "cs");
    });
  }, [filteredSuggestions]);

  const searchHitsFiltered = useMemo(
    () =>
      searchHits.filter(
        (h) =>
          !existing.has(normEmail(h.email)) &&
          !filteredSuggestions.some((s) => normEmail(s.email) === normEmail(h.email)),
      ),
    [searchHits, existing, filteredSuggestions],
  );

  const showDropdown =
    open && (groupedSuggestions.length > 0 || searchHitsFiltered.length > 0 || query.trim() !== "");

  return (
    <Popover open={showDropdown} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <div
          ref={containerRef}
          className={cn(
            "flex min-h-8 w-full flex-wrap items-center gap-1 rounded-md border border-input bg-background px-2 py-1 text-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
            className,
          )}
          onClick={() => inputRef.current?.focus()}
        >
          {value.map((email) => (
            <span
              key={email}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs text-foreground"
            >
              <span className="truncate">{email}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeEmail(email);
                }}
                className="text-muted-foreground transition-colors hover:text-destructive"
                aria-label={`${cs.posta.psani.odebratAdresata}: ${email}`}
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <input
            ref={inputRef}
            value={query}
            autoFocus={autoFocus}
            name="recipient-search"
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
            spellCheck={false}
            data-lpignore="true"
            data-1p-ignore="true"
            data-form-type="other"
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onBlur={() => {
              if (query.trim()) addEmail(query);
            }}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={value.length === 0 ? placeholder : ""}
            className="h-6 min-w-[120px] flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
          />
        </div>
      </PopoverAnchor>
      <PopoverContent
        className="w-[var(--radix-popover-trigger-width)] p-0"
        align="start"
        onOpenAutoFocus={(e) => e.preventDefault()}
        onPointerDownOutside={(e) => {
          if (containerRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
        onFocusOutside={(e) => {
          if (containerRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
        onInteractOutside={(e) => {
          if (containerRef.current?.contains(e.target as Node)) e.preventDefault();
        }}
      >
        <Command shouldFilter={false}>
          <CommandList>
            <CommandEmpty>
              {query.trim() && isValidEmail(query)
                ? cs.posta.psani.enterProPridani
                : cs.posta.psani.zadneVysledky}
            </CommandEmpty>
            {groupedSuggestions.map(([group, items], gi) => (
              <div key={group}>
                {gi > 0 && <CommandSeparator />}
                <CommandGroup heading={group}>
                  {items.map((s) => (
                    <CommandItem
                      key={`sug-${s.email}`}
                      value={`sug-${s.email}`}
                      onSelect={() => addEmail(s.email)}
                    >
                      <User className="mr-2 h-3.5 w-3.5 opacity-60" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{s.label}</span>
                        <span className="truncate text-xs text-muted-foreground">{s.email}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </div>
            ))}
            {searchHitsFiltered.length > 0 && (
              <>
                {groupedSuggestions.length > 0 && <CommandSeparator />}
                <CommandGroup>
                  {searchHitsFiltered.map((h) => (
                    <CommandItem
                      key={`hit-${h.email}`}
                      value={`hit-${h.email}`}
                      onSelect={() => addEmail(h.email)}
                    >
                      <User className="mr-2 h-3.5 w-3.5 opacity-60" />
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate">{h.label}</span>
                        <span className="truncate text-xs text-muted-foreground">{h.email}</span>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

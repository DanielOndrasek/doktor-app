import { Search } from "lucide-react";

import { cs } from "@/lib/i18n/cs";
import { contactDisplayName, type ContactListItem } from "@/lib/contacts";
import { cn } from "@/lib/utils";
import { initialsOf } from "./DetailPrimitives";

interface ContactListProps {
  items: ContactListItem[];
  loading: boolean;
  search: string;
  onSearch: (value: string) => void;
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Levý sloupec adresáře: hledání a seznam s iniciálami, jménem, organizací
 * a hlavní adresou. Tvar podle `PeopleTab` z CRM (vividbooks, `831f9ae6`),
 * bez tabulky se sloupci, filtrů a hromadných akcí — pro jednoho lékaře
 * stačí seznam.
 */
export function ContactList({ items, loading, search, onSearch, selectedId, onSelect }: ContactListProps) {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="shrink-0 space-y-2 px-3 pb-2 pt-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" aria-hidden />
          <input
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder={cs.kontakty.hledat}
            aria-label={cs.kontakty.hledat}
            className="h-8 w-full rounded-md border border-input bg-background pl-8 pr-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {!loading ? <div className="px-0.5 text-[11px] text-muted-foreground">{cs.kontakty.pocet(items.length)}</div> : null}
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {loading
          ? [0, 1, 2, 3, 4, 5].map((i) => <li key={i} className="mx-3 my-1.5 h-12 animate-pulse rounded-lg bg-card/70" />)
          : items.map((c) => {
              const name = contactDisplayName(c);
              const active = c.id === selectedId;
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => onSelect(c.id)}
                    aria-current={active ? "true" : undefined}
                    className={cn(
                      "flex w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-muted/50",
                      active && "bg-secondary/10 hover:bg-secondary/15",
                    )}
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-[11px] font-semibold text-secondary">{initialsOf(name)}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium leading-5">{name}</span>
                      <span className="block truncate text-[11.5px] leading-4 text-muted-foreground">{[c.organization, c.primaryEmail].filter(Boolean).join(" · ")}</span>
                    </span>
                  </button>
                </li>
              );
            })}
        {!loading && !items.length ? <li className="px-4 py-8 text-center text-xs text-muted-foreground">{search.trim() ? cs.kontakty.zadne : cs.kontakty.prazdne}</li> : null}
      </ul>
    </div>
  );
}

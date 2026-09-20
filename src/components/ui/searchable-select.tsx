import { useState } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useKeyboardInset } from "@/hooks/use-keyboard-inset";
import { useIsMobile } from "@/hooks/use-mobile";
import { cs } from "@/lib/i18n/cs";

export interface SearchableSelectOption {
  value: string;
  label: string;
  /** Volitelný typový štítek vpravo (např. „Obchod" / „Nájem"). */
  hint?: string;
}

/** Na mobilu se napovídá až od tolika znaků (ať se seznam neplní hned celý). */
const MOBILE_MIN_QUERY_CHARS = 2;

/**
 * Vyhledávací combobox (Popover + Command) nad lokálním seznamem možností.
 * Nahrazuje obyčejný Select tam, kde je možností hodně a uživatel je
 * potřebuje rychle vyfiltrovat psaním. Filtrování zajišťuje cmdk.
 */
export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder,
  searchPlaceholder,
  emptyText,
  loading,
  triggerClassName,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  options: SearchableSelectOption[];
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  loading?: boolean;
  triggerClassName?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.value === value);
  const { viewportHeight } = useKeyboardInset();
  const isMobile = useIsMobile();

  /* Na mobilu nezačínáme napovídat hned — až když uživatel napíše pár znaků.
   * Na desktopu ukazujeme rovnou celý seznam (myš si s ním poradí). */
  const trimmed = query.trim();
  const ready = !isMobile || trimmed.length >= MOBILE_MIN_QUERY_CHARS;

  const handleSelect = (v: string) => {
    onChange(v);
    setQuery("");
    setOpen(false);
  };

  const handleOpenChange = (v: boolean) => {
    if (!v) setQuery("");
    setOpen(v);
  };

  const trigger = (
    <Button
      type="button"
      variant="outline"
      role="combobox"
      aria-expanded={open}
      disabled={loading || disabled}
      onClick={isMobile ? () => setOpen(true) : undefined}
      className={cn(
        "min-w-0 w-full justify-between overflow-hidden font-normal",
        !selected && "text-muted-foreground",
        triggerClassName,
      )}
    >
      <span className="min-w-0 flex-1 truncate text-left">
        {loading ? cs.ui.nacitani : selected ? selected.label : placeholder}
      </span>
      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
    </Button>
  );

  const listContent = !ready ? (
    <div className="py-8 text-center text-sm text-muted-foreground">
      {cs.ui.zacniPsat}
    </div>
  ) : (
    <>
      <CommandEmpty>{emptyText}</CommandEmpty>
      <CommandGroup>
        {options.map((o) => (
          <CommandItem
            key={o.value}
            value={`${o.label} ${o.hint ?? ""} ${o.value}`}
            onSelect={() => handleSelect(o.value)}
            className="flex items-start gap-2"
          >
            <Check className={cn("mt-0.5 h-4 w-4 shrink-0", value === o.value ? "opacity-100" : "opacity-0")} />
            <span className="min-w-0 flex-1 break-words">{o.label}</span>
            {o.hint && (
              <span className="mt-0.5 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {o.hint}
              </span>
            )}
          </CommandItem>
        ))}
      </CommandGroup>
    </>
  );

  /* MOBIL: celoplošný vyhledávací panel ukotvený k REÁLNÉMU vrchu obrazovky
   * (top: 0), aby nemohl „utéct" nad stavový řádek (dřívější ukotvení podle
   * visualViewport.offsetTop ho posouvalo pod systémový panel a překrývalo
   * křížek). Hlavička respektuje safe-area (notch) a má vlastní tlačítko
   * Hotovo. Výška je omezená na viditelnou oblast nad klávesnicí, takže seznam
   * vždy zůstane nad klávesnicí a normálně se scrolluje. */
  if (isMobile) {
    const vh = viewportHeight || window.innerHeight;
    return (
      <>
        {trigger}
        <Dialog open={open} onOpenChange={handleOpenChange}>
          <DialogContent
            /* Skryjeme vestavěný křížek (`[data-dialog-close]`) — máme vlastní
             * tlačítko v hlavičce, které se nepřekrývá se stavovým řádkem. */
            className="left-0 top-0 flex w-full max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none rounded-b-2xl border-x-0 border-t-0 p-0 [&>[data-dialog-close]]:hidden"
            style={{ height: `${vh}px` }}
          >
            <DialogTitle className="sr-only">{searchPlaceholder}</DialogTitle>
            <Command shouldFilter className="flex min-h-0 flex-1 flex-col">
              <div className="flex items-center gap-1 pt-[max(0.5rem,env(safe-area-inset-top))]">
                <div className="min-w-0 flex-1">
                  <CommandInput
                    autoFocus
                    placeholder={searchPlaceholder}
                    value={query}
                    onValueChange={setQuery}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => handleOpenChange(false)}
                  className="mr-2 shrink-0 rounded-md px-3 py-1.5 text-sm font-medium text-primary"
                >
                  Hotovo
                </button>
              </div>
              <CommandList className="max-h-none min-h-0 flex-1 overflow-y-auto overscroll-contain pb-[env(safe-area-inset-bottom)]">
                {listContent}
              </CommandList>
            </Command>
          </DialogContent>
        </Dialog>
      </>
    );
  }

  /* DESKTOP: popover přes Portal — jinak se seznam ořízne v rodičích s
   * `overflow-hidden` (např. tabulka fotek v inzerátu) a Floating UI / fokus
   * při positionování nebo fokusu posune stránku nahoru. */
  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        side="bottom"
        sideOffset={4}
        collisionPadding={8}
        avoidCollisions
        style={{ maxHeight: "var(--radix-popover-content-available-height)" }}
        /* Nevolat výchozí scroll-into-view při autofokusu / návratu fokusu —
         * na dlouhé stránce by to vypadalo jako skok nahoru. Vyhledávání
         * zaměříme sami s `preventScroll`. */
        onOpenAutoFocus={(e) => {
          e.preventDefault();
          const root = e.currentTarget instanceof HTMLElement ? e.currentTarget : null;
          window.requestAnimationFrame(() => {
            const input = root?.querySelector<HTMLInputElement>("[cmdk-input]");
            input?.focus({ preventScroll: true });
          });
        }}
        onCloseAutoFocus={(e) => e.preventDefault()}
        className={cn(
          "flex flex-col overflow-hidden p-0",
          "w-[var(--radix-popover-trigger-width)] min-w-[320px]",
        )}
      >
        <Command className="flex max-h-full min-h-0 flex-col">
          <CommandInput placeholder={searchPlaceholder} value={query} onValueChange={setQuery} />
          <CommandList className="max-h-none min-h-0 flex-1 overflow-y-auto overscroll-contain">
            {listContent}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

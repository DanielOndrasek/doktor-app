import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Stavební kameny karty (kontaktu): karta sekce, titulek, skupina polí,
 * pole, přehled údajů, přepínač Upravit, čip, řádek s ikonou, prázdný stav.
 *
 * Převzato z `components/vividbooks/EntityDetailShell.tsx` (vividbooks CRM,
 * `831f9ae6`) — jen tyhle primitiva; `EntityDetailShell` sám (záložky,
 * `ResizableDetailPanels`, `DealChip`, `SchoolRowCard`, `PersonChip`) se
 * nepřebírá. Plochy a rámečky braly `--deal-*` tokeny → `card` / `border`;
 * barvy čipů z palety → tokeny (`success`, `warning`, `secondary`,
 * `destructive`). Texty chodí propsy z `cs`.
 */

export function DetailCard({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("home-surface-plain min-w-0 rounded-[14px] border border-border/60 bg-card px-[22px] pb-[18px] pt-[18px]", className)}>{children}</div>;
}

export function SectionTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between gap-2 text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted-foreground">
      <span>{children}</span>
      {aside}
    </div>
  );
}

export function Group({ title, children, cols = 2 }: { title: string; children: ReactNode; cols?: 1 | 2 }) {
  return (
    <div className="pt-2.5 first:pt-0">
      <div className="mb-1.5 text-[10.5px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">{title}</div>
      <div className={cn("grid gap-x-2.5 gap-y-2", cols === 2 ? "grid-cols-2" : "grid-cols-1")}>{children}</div>
    </div>
  );
}

export function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={cn("min-w-0 space-y-0.5", wide && "col-span-2")}>
      <div className="text-[10.5px] text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

export function Placeholder({ icon: Icon, title, text }: { icon: LucideIcon; title: string; text?: string }) {
  return (
    <div className="rounded-xl border border-dashed bg-card/50 p-8 text-center">
      <Icon className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
      <p className="text-sm font-medium">{title}</p>
      {text ? <p className="mt-1 text-xs text-muted-foreground">{text}</p> : null}
    </div>
  );
}

/** Kompaktní přehled údajů (jen vyplněné hodnoty, dva sloupce); plný formulář se otevírá tlačítkem Upravit. */
export function FactGrid({ facts, empty }: { facts: [string, ReactNode, boolean?][]; empty: string }) {
  const shown = facts.filter(([, v]) => v !== null && v !== undefined && v !== "" && v !== false);
  if (!shown.length) return <div className="text-xs text-muted-foreground">{empty}</div>;
  return (
    <dl className="grid grid-cols-2 gap-x-3 gap-y-1.5">
      {shown.map(([label, value, wide]) => (
        <div key={label} className={cn("min-w-0", wide && "col-span-2")}>
          <dt className="text-[10.5px] leading-tight text-muted-foreground">{label}</dt>
          <dd className="truncate text-[13px] font-medium leading-snug" title={typeof value === "string" ? value : undefined}>
            {value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export function EditToggle({ edit, onToggle, labels }: { edit: boolean; onToggle: () => void; labels: { edit: string; done: string } }) {
  return (
    <button type="button" onClick={onToggle} className="rounded-md px-1.5 py-0.5 text-[11px] font-medium normal-case tracking-normal text-muted-foreground hover:bg-muted hover:text-foreground">
      {edit ? labels.done : labels.edit}
    </button>
  );
}

export type ChipTone = "neutral" | "green" | "amber" | "blue" | "red";
const CHIP_TONE: Record<ChipTone, string> = {
  neutral: "bg-muted text-muted-foreground",
  green: "bg-success/10 text-success",
  amber: "bg-warning/15 text-warning",
  blue: "bg-secondary/10 text-secondary",
  red: "bg-destructive/10 text-destructive",
};

export function Chip({ tone = "neutral", children, className, title }: { tone?: ChipTone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={cn("inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium leading-4", CHIP_TONE[tone], className)}>
      {children}
    </span>
  );
}

/** Řádek s ikonou: `icon · hodnota ……… aside`. Prázdné hodnoty se nevykreslí. */
export function InfoRow({ icon: Icon, children, aside, title, mono }: { icon: LucideIcon; children: ReactNode; aside?: ReactNode; title?: string; mono?: boolean }) {
  if (children === null || children === undefined || children === "" || children === false) return null;
  return (
    <div className="flex min-w-0 items-center gap-2.5 py-[3px]" title={title}>
      <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground/70" strokeWidth={2} />
      <span className={cn("min-w-0 flex-1 truncate text-[13px] font-medium leading-5", mono && "font-mono text-[12.5px]")}>{children}</span>
      {aside ? <span className="shrink-0 text-[11px] text-muted-foreground">{aside}</span> : null}
    </div>
  );
}

/** Iniciály pro avatar bez fotky. */
export function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase())
      .join("") || "?"
  );
}

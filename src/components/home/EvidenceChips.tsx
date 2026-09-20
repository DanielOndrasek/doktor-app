import { cn } from "@/lib/utils";

/**
 * Důkazy signálu jako krátké štítky místo věty s tečkami: každý údaj zvlášť,
 * termíny a prodlení oranžově. Dlouhé údaje zůstávají jako text pod štítky.
 *
 * Převzato z `components/home/EvidenceChips.tsx` (vividbooks CRM, `831f9ae6`).
 * Zelený tón pro „tisk / promítnutí / webinář" (silné prodejní signály) se
 * nepřebral — v Doktorovi nemá co zvýrazňovat.
 */
export function EvidenceChips({ items }: { items: string[] }) {
  const parts = items
    .flatMap((e) => e.split(" · "))
    .map((x) => x.trim())
    .filter(Boolean);
  const long = parts.filter((x) => x.length > 34);
  const chips = parts.filter((x) => !long.includes(x));
  const tone = (x: string) =>
    /končí|po termínu|nikdo|žádný|čeká/i.test(x) ? "bg-warning/15 text-warning" : "bg-muted text-foreground/80";
  return (
    <div className="mt-2">
      <div className="flex flex-wrap gap-1">
        {chips.map((x, i) => (
          <span key={i} className={cn("rounded-full px-2 py-0.5 text-[11.5px] leading-4", tone(x))}>
            {x}
          </span>
        ))}
      </div>
      {long.length ? <div className="mt-1 text-[12px] leading-snug text-muted-foreground">{long.join(" · ")}</div> : null}
    </div>
  );
}

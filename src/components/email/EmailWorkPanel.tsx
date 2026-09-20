import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { ChevronDown, Reply } from "lucide-react";

import { cn } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";

/** Zpráva, na kterou uživatel dluží odpověď. */
export interface WaitingItem {
  id: string;
  subject: string | null;
  from: string;
  /** ISO čas poslední zprávy ve vlákně. */
  lastMessageAt: string;
}

const days = (d: string) => Math.max(0, Math.floor((Date.now() - new Date(d).getTime()) / 864e5));

const OPEN_STORAGE_KEY = "doktor:email-work-open";

interface EmailWorkPanelProps {
  waiting: WaitingItem[];
  /** Obalí řádek odkazem na položku nebo kontakt; bez něj je řádek prostý text. */
  renderLink?: (item: WaitingItem, children: ReactNode) => ReactNode;
}

/**
 * Pracovní přehled nad schránkou: co čeká na mou odpověď. Převzato
 * z vividbooks CRM (`831f9ae6`) jako rozbalovací pruh nad seznamem.
 *
 * Z původních tří sloupců zůstal jeden. „Odesláno a neotevřeno" stálo na
 * sledovacím pixelu (`crm.email_tracking`) a „Naplánováno k odeslání" na
 * frontě `crm.scheduled_emails` — obojí schéma `crm`, a to druhé navíc
 * naráží na pravidlo 8 (nic se neodesílá samo). Odkud se `waiting` bere,
 * rozhodne obrazovka Dnes (K3.5) — sem přichází hotové propsem.
 */
export function EmailWorkPanel({ waiting, renderLink }: EmailWorkPanelProps) {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return localStorage.getItem(OPEN_STORAGE_KEY) !== "0";
    } catch {
      return true;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(OPEN_STORAGE_KEY, open ? "1" : "0");
    } catch {
      /* nevadí */
    }
  }, [open]);

  if (!waiting.length) return null;

  const wrap = (item: WaitingItem, children: ReactNode) => (renderLink ? renderLink(item, children) : children);

  return (
    <section className="border-b bg-muted/30 px-3 py-2.5 sm:px-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 text-left text-[12.5px] font-semibold"
      >
        {cs.posta.prace.nazev}
        <span className="font-normal text-muted-foreground">
          {cs.posta.prace.cekaNaOdpoved.toLowerCase()} {waiting.length}
        </span>
        <ChevronDown
          className={cn("ml-auto h-4 w-4 text-muted-foreground transition-transform duration-150", open && "rotate-180")}
        />
      </button>
      {open ? (
        <div className="mt-2 min-w-0 rounded-xl bg-card px-3 py-2.5 ring-1 ring-border/70">
          <div className="mb-1.5 flex items-center gap-1.5 text-[12px] font-semibold">
            <Reply className="h-3.5 w-3.5 text-secondary" />
            {cs.posta.prace.cekaNaOdpoved}
            <span className="font-normal tabular-nums text-muted-foreground">{waiting.length}</span>
          </div>
          <ul className="space-y-1">
            {waiting.slice(0, 6).map((m) => (
              <li key={m.id} className="flex items-baseline gap-2 text-[12.5px]">
                {wrap(
                  m,
                  <span className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{m.from}</span>
                    <span className="text-muted-foreground"> · {m.subject || cs.posta.prace.bezPredmetu}</span>
                  </span>,
                )}
                <span
                  className={cn(
                    "shrink-0 tabular-nums",
                    days(m.lastMessageAt) >= 5 ? "font-semibold text-destructive" : "text-muted-foreground",
                  )}
                  title={m.lastMessageAt}
                >
                  {days(m.lastMessageAt)} {cs.posta.prace.dnu}
                </span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

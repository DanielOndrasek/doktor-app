import type { MouseEvent } from "react";
import { format } from "date-fns";
import { cs as csLocale } from "date-fns/locale";
import { MailOpen } from "lucide-react";

import { cn } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";
import { avatarColorClass, emailInitials, parseEmailFromHeader } from "@/lib/email/html";

interface EmailListItemProps {
  id: string;
  from: string;
  subject: string;
  snippet: string;
  date: string;
  internalDate: string;
  isUnread: boolean;
  isSelected: boolean;
  onClick: () => void;
  onMarkUnread?: (e: MouseEvent) => void;
}

function formatEmailDate(internalDate: string): string {
  const d = new Date(Number(internalDate));
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  if (d.toDateString() === now.toDateString()) {
    return format(d, "HH:mm");
  }
  if (d.getFullYear() === now.getFullYear()) {
    return format(d, "d. MMM", { locale: csLocale });
  }
  return format(d, "d. M. yyyy", { locale: csLocale });
}

/**
 * Řádek seznamu zpráv. Převzato z vividbooks CRM (`831f9ae6`).
 *
 * Odstřižená akce „Smazat": `trashMessage` se nevystavuje ani v UI (pravidlo 3
 * v `CLAUDE.md`). Avatar bere barvu z palety v `lib/email/html.ts`, ne
 * z náhodného odstínu HSL.
 */
export function EmailListItem({
  from,
  subject,
  snippet,
  internalDate,
  isUnread,
  isSelected,
  onClick,
  onMarkUnread,
}: EmailListItemProps) {
  const { displayName, email } = parseEmailFromHeader(from);
  const absoluteDate = (() => {
    const d = new Date(Number(internalDate));
    return Number.isNaN(d.getTime()) ? undefined : format(d, "d. MMMM yyyy, HH:mm", { locale: csLocale });
  })();

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex w-full min-w-0 items-start gap-3 overflow-hidden border-b border-border px-4 py-3 text-left transition-colors",
        isSelected ? "bg-accent" : "hover:bg-accent/50",
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full text-xs font-semibold",
          avatarColorClass(email || displayName),
        )}
      >
        {emailInitials(displayName, email)}
      </div>

      <div className="min-w-0 flex-1 overflow-hidden">
        <div className="mb-0.5 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            {isUnread && <span className="h-2 w-2 flex-shrink-0 rounded-full bg-secondary" />}
            <span
              className={cn(
                "truncate text-sm",
                isUnread ? "font-semibold text-foreground" : "text-muted-foreground",
              )}
            >
              {displayName}
            </span>
          </div>
          <span
            className="flex-shrink-0 whitespace-nowrap text-xs text-muted-foreground"
            title={absoluteDate}
          >
            {formatEmailDate(internalDate)}
          </span>
        </div>
        <div
          className={cn(
            "truncate text-sm",
            isUnread ? "font-medium text-foreground" : "text-foreground/80",
          )}
        >
          {subject || cs.posta.seznam.bezPredmetu}
        </div>
        <div className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{snippet}</div>
      </div>

      {/* Plovoucí akce vpravo — zobrazí se až na hover. Jsou absolutně
       * pozicované, takže nezasahují do layoutu řádku (datum/jméno se nehýbe). */}
      {onMarkUnread && !isUnread && (
        <div className="pointer-events-none absolute right-2 top-1/2 flex -translate-y-1/2 items-center gap-0.5 rounded-md border border-border bg-background/95 px-0.5 py-0.5 opacity-0 shadow-sm transition-opacity group-hover:pointer-events-auto group-hover:opacity-100">
          <span
            role="button"
            tabIndex={-1}
            onClick={(e) => {
              e.stopPropagation();
              onMarkUnread(e);
            }}
            className="flex h-7 w-7 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            title={cs.posta.seznam.oznacitNeprectene}
          >
            <MailOpen className="h-4 w-4" />
          </span>
        </div>
      )}
    </button>
  );
}

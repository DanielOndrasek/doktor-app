import { Flag } from "lucide-react";

import { cs } from "@/lib/i18n/cs";
import { cn } from "@/lib/utils";

export const TASK_PRIORITIES = ["P1", "P2", "P3"] as const;
export type TaskPriority = (typeof TASK_PRIORITIES)[number];

/** Barva vlaječky podle naléhavosti: P1 červená, P2 oranžová, P3 modrozelená (klidná). */
const FLAG_CLASS: Record<TaskPriority, string> = {
  P1: "text-destructive",
  P2: "text-warning",
  P3: "text-secondary",
};

const PILL_CLASS: Record<TaskPriority, string> = {
  P1: "bg-destructive/10 text-destructive",
  P2: "bg-warning/15 text-warning",
  P3: "bg-secondary/10 text-secondary",
};

export function isTaskPriority(value: string | null | undefined): value is TaskPriority {
  return value === "P1" || value === "P2" || value === "P3";
}

export function priorityFlagClass(priority: string | null | undefined): string {
  return isTaskPriority(priority) ? FLAG_CLASS[priority] : "text-muted-foreground";
}

/** Vyplněná vlaječka v barvě priority; `null` když priorita není. */
export function PriorityFlag({ priority, className }: { priority: string | null | undefined; className?: string }) {
  if (!isTaskPriority(priority)) return null;
  return <Flag className={cn("h-3.5 w-3.5 shrink-0 fill-current", FLAG_CLASS[priority], className)} aria-hidden />;
}

/**
 * Štítek priority do seznamu a na kartu: vlaječka + text (P1 · P2 · P3),
 * `long` = celý popis („P1 – urgentní"). Barva podle naléhavosti, text zůstává —
 * vlaječka sama by nestačila (barvoslepost, tisk).
 */
export function PriorityBadge({ priority, long, className }: { priority: string | null | undefined; long?: boolean; className?: string }) {
  if (!isTaskPriority(priority)) return null;
  return (
    <span
      className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-px text-[10.5px] font-semibold leading-[16px]", PILL_CLASS[priority], className)}
      title={cs.ukoly.detail.priority[priority]}
    >
      <Flag className="h-3 w-3 fill-current" aria-hidden />
      {long ? cs.ukoly.detail.priority[priority] : priority}
    </span>
  );
}

import { addDays, endOfWeek, format } from "date-fns";

import type { KanbanCardData } from "@/components/kanban";

/**
 * Rozřazení úkolů po termínech — z `VbTasksPage.tsx` (vividbooks CRM,
 * `831f9ae6`): `bucketOf` a `iso` beze změny, jen `is_completed` je
 * `stav = hotovo` a termín se čte z karty (`due` = `termin` nebo
 * `termin` + `T` + `cas`).
 */

export type TaskBucket = "overdue" | "today" | "tomorrow" | "week" | "later" | "nodate" | "done";

export const OPEN_BUCKETS: TaskBucket[] = ["overdue", "today", "tomorrow", "week", "later", "nodate"];

export const iso = (d: Date): string => format(d, "yyyy-MM-dd");

/** `due` karty → datum „YYYY-MM-DD" a čas „HH:MM" (prázdné = celodenní). */
export function splitDue(due: string | null | undefined): { date: string; time: string } {
  if (!due) return { date: "", time: "" };
  return { date: due.slice(0, 10), time: due.length > 10 ? due.slice(11, 16) : "" };
}

export function bucketOf(card: KanbanCardData, today: string): TaskBucket {
  if (card.state === "hotovo") return "done";
  const { date } = splitDue(card.due);
  if (!date) return "nodate";
  if (date < today) return "overdue";
  if (date === today) return "today";
  if (date === iso(addDays(new Date(today), 1))) return "tomorrow";
  if (date <= iso(endOfWeek(new Date(today), { weekStartsOn: 1 }))) return "week";
  return "later";
}

export function isOverdue(card: KanbanCardData, today: string): boolean {
  const { date } = splitDue(card.due);
  return card.state !== "hotovo" && !!date && date < today;
}

/** Kolik dní je termín za dneškem (kalendářně). */
export function daysOverdue(card: KanbanCardData, today: string): number {
  const { date } = splitDue(card.due);
  return Math.round((new Date(today).getTime() - new Date(date).getTime()) / 864e5);
}

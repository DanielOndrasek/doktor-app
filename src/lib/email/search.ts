import type { MailSearchFilter } from "@/lib/email/types";

/** Počet vyplněných polí filtru „Hledat" (K0.4) — do odznaku na tlačítku a k rozhodnutí, zda se hledá ve všech složkách. */
export function activeFilterCount(f: MailSearchFilter): number {
  return [f.from?.trim(), f.to?.trim(), f.dateFrom, f.dateTo, f.direction, f.hasAttachment ? "1" : ""].filter(Boolean).length;
}

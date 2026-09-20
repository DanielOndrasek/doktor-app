import { Inbox, Star, AlertCircle, Send, FileText, ShieldAlert, Trash2, Archive } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cs } from "@/lib/i18n/cs";

/**
 * Popisky a pořadí standardních složek schránky.
 *
 * Které složky se zobrazí, určuje schránka: Gmail má všechny, IMAP server
 * nabídne jen ty, které na serveru opravdu existují (koncepty ani spam nemá
 * každý). Pořadí je pevné, aby se navigace při přepnutí schránky nepřeskládala.
 *
 * Převzato z vividbooks CRM (`831f9ae6`); popisky přesunuty do
 * `src/lib/i18n/cs.ts`.
 */

export interface EmailFolder {
  id: string;
  label: string;
  icon: LucideIcon;
}

const FOLDER_LABELS: Record<string, { label: string; icon: LucideIcon }> = {
  inbox: { label: cs.posta.slozky.inbox, icon: Inbox },
  starred: { label: cs.posta.slozky.starred, icon: Star },
  important: { label: cs.posta.slozky.important, icon: AlertCircle },
  sent: { label: cs.posta.slozky.sent, icon: Send },
  drafts: { label: cs.posta.slozky.drafts, icon: FileText },
  archive: { label: cs.posta.slozky.archive, icon: Archive },
  spam: { label: cs.posta.slozky.spam, icon: ShieldAlert },
  trash: { label: cs.posta.slozky.trash, icon: Trash2 },
};

const FOLDER_ORDER = ["inbox", "starred", "important", "sent", "drafts", "archive", "spam", "trash"];

export function emailFoldersFor(availableIds: readonly string[]): EmailFolder[] {
  const available = new Set(availableIds);
  return FOLDER_ORDER.filter((id) => available.has(id)).map((id) => ({
    id,
    label: FOLDER_LABELS[id].label,
    icon: FOLDER_LABELS[id].icon,
  }));
}

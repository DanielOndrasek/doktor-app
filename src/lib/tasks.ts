import type { KanbanCardData, KanbanState } from "@/components/kanban";

/**
 * Zdroj úkolů pro obrazovku Úkoly (K3.6). Karta je projekce řádku `ukoly`
 * (oddíl 3 plánu); kdo řádky čte a kdo je na kartu mapuje, rozhodne K2 —
 * sem chodí hotové.
 *
 * `move` zapisuje nový `stav` **a `stav_zdroj = klik`** (pravidlo 4
 * v `CLAUDE.md`): stav se odvozuje ze schránky, ne jen z kliknutí, a proto
 * musí být vidět, odkud změna přišla.
 */
export interface TaskSource {
  load: () => Promise<KanbanCardData[]>;
  move: (card: KanbanCardData, to: KanbanState) => Promise<void>;
}

/** Dokud není K2, tabule je prázdná. */
export const EMPTY_TASK_SOURCE: TaskSource = {
  load: async () => [],
  move: async () => {},
};

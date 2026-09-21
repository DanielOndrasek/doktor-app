import { cs } from "@/lib/i18n/cs";

/**
 * Stavy úkolu jsou přesně tyhle (`CLAUDE.md`, Konvence). `zruseno` sloupec
 * nemá — zrušený úkol na tabuli nepatří.
 */
export const TASK_STATES = ["todo", "probiha", "ceka", "hotovo", "odlozeno", "zruseno"] as const;
export type TaskState = (typeof TASK_STATES)[number];

export type KanbanState = Exclude<TaskState, "zruseno">;

export interface KanbanColumnConfig {
  value: KanbanState;
  label: string;
  /** Tailwind třída horního proužku sloupce — z tokenů Doktora, ne z palety CRM. */
  accentBarClass: string;
}

/**
 * Sloupce kanbanu: TODO · V procesu · Čekám · Hotovo · Odloženo.
 *
 * Nahrazuje `DEAL_STAGES` (fáze obchodu Lead → Předání) z CRM. Barvy
 * proužků jsou významové: práce = akcent, čekání = varování, hotovo = úspěch,
 * odloženo a fronta = ztlumené.
 */
export const KANBAN_COLUMNS: readonly KanbanColumnConfig[] = [
  { value: "todo", label: cs.ukoly.stavy.todo, accentBarClass: "bg-muted-foreground/40" },
  { value: "probiha", label: cs.ukoly.stavy.probiha, accentBarClass: "bg-secondary" },
  { value: "ceka", label: cs.ukoly.stavy.ceka, accentBarClass: "bg-warning" },
  { value: "hotovo", label: cs.ukoly.stavy.hotovo, accentBarClass: "bg-success" },
  { value: "odlozeno", label: cs.ukoly.stavy.odlozeno, accentBarClass: "bg-muted-foreground/25" },
];

/**
 * Karta na tabuli. Je to projekce řádku `ukoly` (oddíl 3 plánu), ne řádek
 * sám — typy tabulek přijdou generované z Supabase (K2) a kanban na nich
 * nemá záviset. Kdo tabuli kreslí, řádek na kartu přemapuje.
 */
export interface KanbanCard {
  id: string;
  /** `ukoly.nazev` */
  title: string;
  /** `ukoly.popis` — kanban ho neukazuje, seznam ano (dva řádky). */
  description?: string | null;
  /** `ukoly.stav` */
  state: KanbanState;
  /** `ukoly.termin` — ISO datum nebo čas. */
  due?: string | null;
  /** `ukoly.priorita` — zobrazí se jako malý štítek, hodnoty neinterpretuje. */
  priority?: string | null;
  /** `ukoly.oblast` */
  area?: string | null;
  /** Kontakt, ke kterému úkol patří (jméno; `kontakt_id` si drží volající). */
  contactLabel?: string | null;
  /** Od kdy je úkol v aktuálním stavu — pro „X dní ve sloupci". */
  stateEnteredAt?: string | null;
  /** Odkaz na detail úkolu (pro otevření v nové kartě / středním tlačítkem). */
  href?: string;
}

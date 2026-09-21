import type { TaskState } from "@/components/kanban";
import { supabase } from "@/lib/supabase/client";

/**
 * „Rozpracováno v Claude" (Dnes): projekty, na kterých se pracuje.
 * Projekt = hodnota `ukoly.claude_projekt` (plán, oddíl 3); do přehledu jdou
 * jen otevřené úkoly (ne hotovo / zruseno). K tomu počet požadavků ve
 * `fronta_claude` ve stavu ceka / bezi. Nic se tu nevolá na model —
 * je to jen pohled na data, která Claude a běhy zapsaly.
 */

export interface ClaudeProjectTask {
  id: string;
  title: string;
  state: TaskState;
  dueDate: string | null;
  updatedAt: string;
}

export interface ClaudeProject {
  name: string;
  open: number;
  inProgress: number;
  waiting: number;
  overdue: number;
  /** Poslední změna kteréhokoli úkolu v projektu. */
  lastActivity: string;
  /** Nejvýš tři poslední rozpracované úkoly. */
  tasks: ClaudeProjectTask[];
}

export interface ClaudeWork {
  projects: ClaudeProject[];
  /** Požadavky ve frontě pro Clauda (ceka + bezi). */
  queued: number;
}

export interface ClaudeWorkSource {
  load: () => Promise<ClaudeWork>;
}

export const EMPTY_CLAUDE_WORK_SOURCE: ClaudeWorkSource = {
  load: async () => ({ projects: [], queued: 0 }),
};

const STATE_ORDER: Record<string, number> = { probiha: 0, todo: 1, ceka: 2, odlozeno: 3 };

export function createSupabaseClaudeWorkSource(client: typeof supabase = supabase): ClaudeWorkSource {
  return {
    async load() {
      const today = new Date().toISOString().slice(0, 10);
      const [tasksRes, queueRes] = await Promise.all([
        client
          .from("ukoly")
          .select("id, nazev, stav, termin, claude_projekt, upraveno")
          .not("claude_projekt", "is", null)
          .not("stav", "in", "(hotovo,zruseno)")
          .order("upraveno", { ascending: false })
          .limit(500),
        client.from("fronta_claude").select("id", { count: "exact", head: true }).in("stav", ["ceka", "bezi"]),
      ]);
      if (tasksRes.error) throw new Error(tasksRes.error.message);
      if (queueRes.error) throw new Error(queueRes.error.message);

      const byProject = new Map<string, ClaudeProject>();
      for (const row of tasksRes.data) {
        const name = row.claude_projekt?.trim();
        if (!name) continue;
        const project = byProject.get(name) ?? { name, open: 0, inProgress: 0, waiting: 0, overdue: 0, lastActivity: row.upraveno, tasks: [] };
        project.open += 1;
        if (row.stav === "probiha") project.inProgress += 1;
        if (row.stav === "ceka") project.waiting += 1;
        if (row.termin && row.termin < today) project.overdue += 1;
        if (row.upraveno > project.lastActivity) project.lastActivity = row.upraveno;
        project.tasks.push({ id: row.id, title: row.nazev, state: row.stav as TaskState, dueDate: row.termin, updatedAt: row.upraveno });
        byProject.set(name, project);
      }
      const projects = [...byProject.values()]
        .map((p) => ({
          ...p,
          tasks: [...p.tasks].sort((a, b) => (STATE_ORDER[a.state] ?? 9) - (STATE_ORDER[b.state] ?? 9) || b.updatedAt.localeCompare(a.updatedAt)).slice(0, 3),
        }))
        .sort((a, b) => b.lastActivity.localeCompare(a.lastActivity));

      return { projects, queued: queueRes.count ?? 0 };
    },
  };
}

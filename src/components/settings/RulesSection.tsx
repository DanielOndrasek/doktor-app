import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { BookOpenCheck, Loader2, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import type { Rule, RuleSource, RuleState } from "@/lib/rules";
import { cn } from "@/lib/utils";

const GROUPS: RuleState[] = ["navrh", "schvaleno", "zamitnuto"];

const STATE_TONE: Record<RuleState, string> = {
  navrh: "bg-warning/15 text-warning",
  schvaleno: "bg-success/15 text-success",
  zamitnuto: "bg-muted text-muted-foreground",
};

/**
 * Nastavení → Pravidla pro Clauda (`pouceni`): návrhy z běhů ke schválení,
 * schválená a zamítnutá pravidla, vlastní pravidlo. Nic se nemaže.
 */
export function RulesSection({ source }: { source: RuleSource }) {
  const t = cs.nastaveni.pravidla;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: rules = [], isLoading, error } = useQuery({ queryKey: ["pouceni"], queryFn: () => source.list() });
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; text: string } | null>(null);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["pouceni"] });
  const failed = (err: unknown) => toast({ title: t.ulozeniSelhalo, description: err instanceof Error ? err.message : undefined, variant: "destructive" });

  const add = async () => {
    if (!draft.trim()) {
      toast({ title: t.chybiText, variant: "destructive" });
      return;
    }
    setAdding(true);
    try {
      await source.create(draft);
      setDraft("");
      await refresh();
      toast({ title: t.ulozeno });
    } catch (err) {
      failed(err);
    } finally {
      setAdding(false);
    }
  };

  const setState = async (rule: Rule, state: RuleState) => {
    setBusyId(rule.id);
    try {
      await source.setState(rule.id, state);
      await refresh();
    } catch (err) {
      failed(err);
    } finally {
      setBusyId(null);
    }
  };

  const saveText = async () => {
    if (!editing) return;
    setBusyId(editing.id);
    try {
      await source.updateText(editing.id, editing.text);
      setEditing(null);
      await refresh();
      toast({ title: t.ulozeno });
    } catch (err) {
      failed(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="rounded-lg border border-border bg-card">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        <BookOpenCheck className="h-4 w-4 text-muted-foreground" aria-hidden />
        <h2 className="text-sm font-semibold text-foreground">{t.nadpis}</h2>
      </div>
      <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">{t.napoveda}</p>

      <div className="space-y-2 border-b border-border p-4">
        <Textarea value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={t.novePlaceholder} rows={2} aria-label={t.nove} />
        <div className="flex justify-end">
          <Button size="sm" onClick={() => void add()} disabled={adding || !draft.trim()}>
            {adding ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
            {t.pridat}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-10 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
        </div>
      ) : error ? (
        <p className="px-4 py-6 text-sm text-destructive">{t.nacteniSelhalo}</p>
      ) : rules.length === 0 ? (
        <p className="px-4 py-6 text-sm text-muted-foreground">{t.zadna}</p>
      ) : (
        <div className="divide-y divide-border">
          {GROUPS.map((group) => {
            const list = rules.filter((r) => r.state === group);
            if (!list.length) return null;
            return (
              <div key={group} className="px-4 py-3">
                <div className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {t.skupiny[group]} <span className="font-normal tabular-nums">{list.length}</span>
                </div>
                <ul className="space-y-2">
                  {list.map((rule) => {
                    const busy = busyId === rule.id;
                    const isEditing = editing?.id === rule.id;
                    return (
                      <li key={rule.id} className={cn("rounded-md border border-border px-3 py-2 text-sm", rule.state === "zamitnuto" && "opacity-70")}>
                        {isEditing ? (
                          <div className="space-y-2">
                            <Textarea value={editing.text} onChange={(e) => setEditing({ id: rule.id, text: e.target.value })} rows={3} autoFocus />
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
                                {t.zrusit}
                              </Button>
                              <Button size="sm" onClick={() => void saveText()} disabled={busy || !editing.text.trim()}>
                                {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                                {t.ulozit}
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <p className="whitespace-pre-wrap break-words text-foreground">{rule.text}</p>
                            <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs">
                              <span className={cn("rounded px-1.5 py-0.5 font-medium", STATE_TONE[rule.state])}>{t.stav[rule.state]}</span>
                              {rule.sourceCorrections.length ? <span className="text-muted-foreground">{t.zOprav(rule.sourceCorrections.length)}</span> : null}
                              <span className="ml-auto flex gap-1">
                                {rule.state !== "schvaleno" && (
                                  <Button size="sm" variant="outline" className="h-7" onClick={() => void setState(rule, "schvaleno")} disabled={busy}>
                                    {t.schvalit}
                                  </Button>
                                )}
                                {rule.state !== "zamitnuto" && (
                                  <Button size="sm" variant="ghost" className="h-7" onClick={() => void setState(rule, "zamitnuto")} disabled={busy}>
                                    {t.zamitnout}
                                  </Button>
                                )}
                                <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditing({ id: rule.id, text: rule.text })} disabled={busy}>
                                  {t.upravit}
                                </Button>
                              </span>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

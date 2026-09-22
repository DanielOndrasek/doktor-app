import { useEffect, useState } from "react";
import { addDays, format, isValid, parseISO } from "date-fns";
import { cs as csLocale } from "date-fns/locale";
import { CalendarPlus, Loader2, Mail } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TASK_STATES, type TaskState } from "@/components/kanban";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import { draftOf, emptyTaskDraft, type TaskDetail, type TaskDraft, type TaskSource } from "@/lib/tasks";
import { cn } from "@/lib/utils";
import { TaskDeadlinePicker } from "./TaskDeadlinePicker";
import {
  TaskDescriptionTextarea,
  TaskDialogBody,
  TaskDialogBodyLayout,
  TaskDialogFooterBar,
  TaskDialogHeader,
  TaskDialogMetaRow,
  TaskDialogMetaSection,
  TaskFieldLabel,
  preventTaskDialogAutoFocusOnMobile,
  taskDialogContentClassName,
} from "./TaskDialogChrome";

const PRIORITIES = ["P1", "P2", "P3"] as const;
const NONE = "__none__";
const QUICK_DATES: [keyof typeof cs.ukoly.detail.rychle, number][] = [
  ["dnes", 0],
  ["zitra", 1],
  ["za3dny", 3],
  ["zaTyden", 7],
];

function formatDateTime(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, "d. M. yyyy HH:mm", { locale: csLocale }) : iso;
}

export type TaskDialogTarget = { mode: "new"; state: TaskState; dueDate?: string; contactId?: string } | { mode: "edit"; id: string };

interface TaskDialogProps {
  target: TaskDialogTarget | null;
  source: TaskSource;
  onClose: () => void;
  onSaved: (task: TaskDetail) => void;
}

/**
 * Detail a zakládání úkolu nad `ukoly`.
 *
 * Převzato z `components/vividbooks/ActivityDialog.tsx` (vividbooks CRM,
 * `831f9ae6`): kostra dialogu, název jako první pole, termín s rychlými
 * volbami Dnes · Zítra · Za 3 dny · Za týden, poznámka a patička Zrušit /
 * Uložit. Vzhled hlavičky, těla a patičky je z `TaskDetailDialogChrome`.
 *
 * Odstřižené, protože jde o zeď obchodu a Google (nepřebírá se): druhy
 * aktivit (hovor, schůzka, videohovor, školení), délka, „Komu", místo,
 * Google Meet, hosté a pozvánky, našeptávač škol a obchodů, zápis do
 * `db_deal_wall_posts` a `google-calendar-sync-task`. Místo toho: stav
 * úkolu (šest hodnot z `CLAUDE.md`), priorita P1–P3, oblast a druh jako
 * text, a kontext vpravo (kontakt, zdroj, zpráva). Data chodí přes
 * `TaskSource`, ne přes klienta Supabase v komponentě.
 */
export function TaskDialog({ target, source, onClose, onSaved }: TaskDialogProps) {
  const t = cs.ukoly.detail;
  const { toast } = useToast();
  const [task, setTask] = useState<TaskDetail | null>(null);
  const [draft, setDraft] = useState<TaskDraft>(emptyTaskDraft());
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [addingToCalendar, setAddingToCalendar] = useState(false);

  const open = target !== null;
  const editing = target?.mode === "edit";

  useEffect(() => {
    if (!target) return;
    if (target.mode === "new") {
      setTask(null);
      setDraft({ ...emptyTaskDraft(target.state), dueDate: target.dueDate ?? "" });
      return;
    }
    let cancelled = false;
    setLoading(true);
    setTask(null);
    void source
      .get(target.id)
      .then((detail) => {
        if (cancelled) return;
        if (!detail) {
          toast({ title: t.nenalezen, variant: "destructive" });
          onClose();
          return;
        }
        setTask(detail);
        setDraft(draftOf(detail));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        toast({ title: t.nacteniSelhalo, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
        onClose();
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // `toast`, `onClose` a `source` jsou stabilní; znovu se načítá jen při změně cíle.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const set = (patch: Partial<TaskDraft>) => setDraft((d) => ({ ...d, ...patch }));

  const save = async () => {
    if (!draft.title.trim()) {
      toast({ title: t.chybiNazev, variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const saved = task ? await source.update(task, draft) : await source.create({ ...draft, contactId: target?.mode === "new" ? (target.contactId ?? null) : null });
      toast({ title: task ? t.ulozen : t.zalozen });
      onSaved(saved);
      onClose();
    } catch (err) {
      toast({ title: t.ulozeniSelhalo, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  // Úkol → iCloud (K3.6): jen z kliknutí, jen u uloženého úkolu s termínem, jen když je engine.
  const addToCalendar = async () => {
    if (!task || !source.addToCalendar) return;
    if (!task.dueDate || task.dueDate !== draft.dueDate) {
      toast({ title: t.kalendarBezTerminu, variant: "destructive" });
      return;
    }
    setAddingToCalendar(true);
    try {
      const { calUid } = await source.addToCalendar(task);
      const updated = { ...task, calUid };
      setTask(updated);
      onSaved(updated);
      toast({ title: t.vKalendariZapsano });
    } catch (err) {
      toast({ title: t.kalendarSelhal, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setAddingToCalendar(false);
    }
  };

  const context = task ? (
    <TaskDialogMetaSection title={t.kontext}>
      {task.contactLabel ? <TaskDialogMetaRow label={t.kontakt}>{task.contactLabel}</TaskDialogMetaRow> : null}
      <TaskDialogMetaRow label={t.zdroj}>{t.zdroje[task.source]}</TaskDialogMetaRow>
      {task.itemHref ? (
        <TaskDialogMetaRow label={t.zprava}>
          <a href={task.itemHref} className="inline-flex items-center gap-1 text-secondary hover:underline">
            <Mail className="h-3.5 w-3.5" aria-hidden />
            {t.otevritZpravu}
          </a>
        </TaskDialogMetaRow>
      ) : null}
      <TaskDialogMetaRow label={t.zalozeno}>{formatDateTime(task.createdAt)}</TaskDialogMetaRow>
      <TaskDialogMetaRow label={t.veStavuOd}>{formatDateTime(task.stateEnteredAt)}</TaskDialogMetaRow>
      {task.calUid ? (
        <TaskDialogMetaRow label={t.vKalendari}>✓</TaskDialogMetaRow>
      ) : source.addToCalendar ? (
        <TaskDialogMetaRow label={t.vKalendari}>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="h-7 px-2 text-xs"
            onClick={() => void addToCalendar()}
            disabled={addingToCalendar || saving || !task.dueDate}
            title={task.dueDate ? undefined : t.kalendarBezTerminu}
          >
            {addingToCalendar ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" aria-hidden /> : <CalendarPlus className="mr-1 h-3.5 w-3.5" aria-hidden />}
            {addingToCalendar ? t.zapisujiDoKalendare : t.doKalendare}
          </Button>
        </TaskDialogMetaRow>
      ) : null}
    </TaskDialogMetaSection>
  ) : undefined;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !saving) onClose();
      }}
    >
      <DialogContent className={taskDialogContentClassName} onOpenAutoFocus={preventTaskDialogAutoFocusOnMobile}>
        <TaskDialogHeader
          title={editing ? t.detailUkolu : t.novyUkol}
          stateLabel={t.stav}
          stateBadge={task ? cs.ukoly.stavy[task.state] : undefined}
          done={task?.state === "hotovo"}
        />
        <DialogDescription className="sr-only">{editing ? t.detailUkolu : t.novyUkol}</DialogDescription>
        <TaskDialogBody>
          {loading ? (
            <div className="flex items-center justify-center py-10 text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
            </div>
          ) : (
            <TaskDialogBodyLayout
              context={context}
              main={
                <>
                  <div className="space-y-1.5">
                    <TaskFieldLabel htmlFor="ukol-nazev">{t.coSeMaUdelat}</TaskFieldLabel>
                    <Input
                      id="ukol-nazev"
                      autoFocus
                      value={draft.title}
                      onChange={(e) => set({ title: e.target.value })}
                      className="text-[15px] font-medium"
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void save();
                        }
                      }}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <TaskFieldLabel htmlFor="ukol-termin">{t.termin}</TaskFieldLabel>
                    <TaskDeadlinePicker
                      id="ukol-termin"
                      size="sm"
                      date={draft.dueDate}
                      time={draft.dueTime}
                      onChange={({ date, time }) => set({ dueDate: date, dueTime: time })}
                    />
                    <div className="flex flex-wrap gap-1 text-[11.5px]">
                      {QUICK_DATES.map(([key, days]) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => set({ dueDate: format(addDays(new Date(), days), "yyyy-MM-dd") })}
                          className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground hover:text-foreground"
                        >
                          {t.rychle[key]}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <TaskFieldLabel htmlFor="ukol-stav">{t.stav}</TaskFieldLabel>
                      <Select value={draft.state} onValueChange={(v) => set({ state: v as TaskState })}>
                        <SelectTrigger id="ukol-stav" className="h-8 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_STATES.map((s) => (
                            <SelectItem key={s} value={s}>
                              {cs.ukoly.stavy[s]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <TaskFieldLabel htmlFor="ukol-priorita">{t.priorita}</TaskFieldLabel>
                      <Select value={draft.priority || NONE} onValueChange={(v) => set({ priority: v === NONE ? "" : v })}>
                        <SelectTrigger id="ukol-priorita" className={cn("h-8 text-sm", !draft.priority && "text-muted-foreground")}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={NONE}>{t.bezPriority}</SelectItem>
                          {PRIORITIES.map((p) => (
                            <SelectItem key={p} value={p}>
                              {t.priority[p]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1.5">
                      <TaskFieldLabel htmlFor="ukol-oblast">{t.oblast}</TaskFieldLabel>
                      <Input id="ukol-oblast" className="h-8 text-sm" placeholder={t.oblastPlaceholder} value={draft.area} onChange={(e) => set({ area: e.target.value })} />
                    </div>
                    <div className="space-y-1.5">
                      <TaskFieldLabel htmlFor="ukol-druh">{t.druh}</TaskFieldLabel>
                      <Input id="ukol-druh" className="h-8 text-sm" placeholder={t.druhPlaceholder} value={draft.kind} onChange={(e) => set({ kind: e.target.value })} />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <TaskFieldLabel htmlFor="ukol-popis">{t.popis}</TaskFieldLabel>
                    <TaskDescriptionTextarea id="ukol-popis" value={draft.description} onChange={(v) => set({ description: v })} placeholder={t.popisPlaceholder} />
                  </div>
                </>
              }
            />
          )}
        </TaskDialogBody>
        <TaskDialogFooterBar>
          <div className="flex items-center justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              {t.zrusit}
            </Button>
            <Button type="button" onClick={() => void save()} disabled={saving || loading}>
              {saving ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" aria-hidden /> : null}
              {saving ? t.ukladam : editing ? t.ulozit : t.pridat}
            </Button>
          </div>
        </TaskDialogFooterBar>
      </DialogContent>
    </Dialog>
  );
}

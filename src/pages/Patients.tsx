import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { cs as csLocale } from "date-fns/locale";
import { Loader2, Mail, Plus, Stethoscope } from "lucide-react";

import { CONTACTS_PATH, MAIL_PATH } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import type { CaseDraft, CaseSource, CaseState, PatientCase } from "@/lib/cases";
import { cn } from "@/lib/utils";

const STATES: CaseState[] = ["navrh", "schvaleno", "zamitnuto"];

function relative(iso: string | null): { label: string; title: string } | null {
  if (!iso) return null;
  const d = parseISO(iso);
  if (!isValid(d)) return null;
  return { label: formatDistanceToNowStrict(d, { locale: csLocale, addSuffix: true }), title: format(d, "d. M. yyyy HH:mm", { locale: csLocale }) };
}

/**
 * Pacienti (O2 změněno 22. 9. 2026): karty pacientů nad `pripady`. Běh třídění
 * je navrhuje z vláken pošty, lékař je tady schválí nebo zamítne a může upravit
 * jméno a shrnutí. Tvar stránky je z Událostí (přepínač stavů, karty). Nic se
 * nemaže; rodné číslo se nikam nepíše.
 */
export default function Patients({ source }: { source: CaseSource }) {
  const t = cs.pacienti;
  const { toast } = useToast();
  const [cases, setCases] = useState<PatientCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<CaseState>("navrh");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<{ id: string; draft: CaseDraft } | null>(null);
  const [creating, setCreating] = useState(false);
  const [newDraft, setNewDraft] = useState<CaseDraft>({ name: "", summary: "" });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCases(await source.list());
    } catch (err) {
      toast({ title: t.nacteniSelhalo, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [source, toast, t.nacteniSelhalo]);

  useEffect(() => {
    void load();
  }, [load]);

  const counts = useMemo(
    () =>
      cases.reduce<Record<CaseState, number>>(
        (m, c) => {
          m[c.state] += 1;
          return m;
        },
        { navrh: 0, schvaleno: 0, zamitnuto: 0 },
      ),
    [cases],
  );
  const list = cases.filter((c) => c.state === state);

  const failed = (err: unknown) => toast({ title: t.ulozeniSelhalo, description: err instanceof Error ? err.message : undefined, variant: "destructive" });

  const changeState = async (c: PatientCase, next: CaseState) => {
    setBusyId(c.id);
    try {
      await source.setState(c.id, next);
      setCases((prev) => prev.map((x) => (x.id === c.id ? { ...x, state: next, stateSource: "klik" } : x)));
      toast({ title: next === "schvaleno" ? t.schvaleno : t.zamitnuto });
    } catch (err) {
      failed(err);
    } finally {
      setBusyId(null);
    }
  };

  const saveEdit = async () => {
    if (!editing) return;
    setBusyId(editing.id);
    try {
      await source.update(editing.id, editing.draft);
      setCases((prev) => prev.map((x) => (x.id === editing.id ? { ...x, name: editing.draft.name.trim(), summary: editing.draft.summary.trim() || null } : x)));
      setEditing(null);
      toast({ title: t.ulozeno });
    } catch (err) {
      failed(err);
    } finally {
      setBusyId(null);
    }
  };

  const create = async () => {
    setBusyId("new");
    try {
      const created = await source.create(newDraft);
      setCases((prev) => [created, ...prev]);
      setCreating(false);
      setNewDraft({ name: "", summary: "" });
      setState("schvaleno");
      toast({ title: t.ulozeno });
    } catch (err) {
      failed(err);
    } finally {
      setBusyId(null);
    }
  };

  return (
    <main className="container mx-auto px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-6 md:pb-8">
      <div className="mx-auto max-w-4xl space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{t.titulek}</h1>
          <ToggleGroup
            type="single"
            size="sm"
            value={state}
            onValueChange={(v) => {
              if (STATES.includes(v as CaseState)) setState(v as CaseState);
            }}
            className="rounded-lg bg-muted p-0.5"
          >
            {STATES.map((s) => (
              <ToggleGroupItem key={s} value={s} className="h-7 gap-1.5 rounded-md px-2.5 text-xs data-[state=on]:bg-background data-[state=on]:shadow-sm">
                {t.stav[s]}
                <span className="tabular-nums text-muted-foreground">{counts[s]}</span>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
          <Button size="sm" className="ml-auto h-8" onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
            {t.nova}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground">{t.popis}</p>

        {loading ? (
          <ul className="space-y-3">
            {[0, 1, 2].map((i) => (
              <li key={i} className="h-24 animate-pulse rounded-2xl bg-card/60" />
            ))}
          </ul>
        ) : list.length === 0 ? (
          <div className="home-surface-plain rounded-2xl bg-card px-4 py-6 text-center text-sm text-muted-foreground">{t.zadne[state]}</div>
        ) : (
          <ul className="space-y-3">
            {list.map((c) => {
              const busy = busyId === c.id;
              const isEditing = editing?.id === c.id;
              const last = relative(c.lastMessageAt);
              return (
                <li key={c.id} className={cn("home-surface-plain relative overflow-hidden rounded-2xl bg-card px-4 py-3", c.state === "zamitnuto" && "opacity-60")}>
                  <span aria-hidden className={cn("absolute inset-y-0 left-0 w-1", c.state === "schvaleno" ? "bg-success" : c.state === "navrh" ? "bg-warning" : "bg-muted")} />
                  {isEditing ? (
                    <div className="space-y-2">
                      <div className="space-y-1">
                        <Label htmlFor={`karta-jmeno-${c.id}`}>{t.jmeno}</Label>
                        <Input id={`karta-jmeno-${c.id}`} value={editing.draft.name} onChange={(e) => setEditing({ id: c.id, draft: { ...editing.draft, name: e.target.value } })} />
                      </div>
                      <div className="space-y-1">
                        <Label htmlFor={`karta-shrnuti-${c.id}`}>{t.shrnuti}</Label>
                        <Textarea id={`karta-shrnuti-${c.id}`} rows={3} value={editing.draft.summary} onChange={(e) => setEditing({ id: c.id, draft: { ...editing.draft, summary: e.target.value } })} placeholder={t.shrnutiPlaceholder} />
                      </div>
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="ghost" onClick={() => setEditing(null)} disabled={busy}>
                          {t.zrusit}
                        </Button>
                        <Button size="sm" onClick={() => void saveEdit()} disabled={busy || !editing.draft.name.trim()}>
                          {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                          {t.ulozit}
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-start gap-3">
                        <span className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-secondary/10 text-secondary">
                          <Stethoscope className="h-4 w-4" aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="text-[15px] font-semibold leading-tight">{c.name}</div>
                          <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[12px] text-muted-foreground">
                            {c.doctorId ? (
                              <Link to={`${CONTACTS_PATH}?kontakt=${c.doctorId}`} className="hover:underline">
                                {t.lekar}: {c.doctorName ?? "—"}
                              </Link>
                            ) : (
                              <span>{t.bezLekare}</span>
                            )}
                            {last ? (
                              <>
                                <span>·</span>
                                <span title={last.title}>
                                  {t.posledniZprava} {last.label}
                                </span>
                              </>
                            ) : null}
                            {c.stateSource === "beh" ? (
                              <>
                                <span>·</span>
                                <span>{t.navrhlBeh}</span>
                              </>
                            ) : null}
                          </div>
                          <p className={cn("mt-2 whitespace-pre-wrap break-words text-sm", c.summary ? "text-foreground" : "text-muted-foreground")}>{c.summary ?? t.bezShrnuti}</p>
                          <div className="mt-2 text-[12px]">
                            <div className="font-medium text-muted-foreground">{t.zpravy}</div>
                            {c.messages.length ? (
                              <ul className="mt-1 space-y-0.5">
                                {c.messages.map((m) => {
                                  const when = relative(m.date);
                                  return (
                                    <li key={m.id} className="flex items-center gap-2">
                                      <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                                      <Link to={`${MAIL_PATH}?polozka=${m.id}`} className="min-w-0 flex-1 truncate hover:underline" title={m.subject ?? undefined}>
                                        {m.subject || cs.posta.seznam.bezPredmetu}
                                        {m.from ? <span className="text-muted-foreground"> — {m.from}</span> : null}
                                      </Link>
                                      {when ? (
                                        <span className="shrink-0 text-muted-foreground" title={when.title}>
                                          {when.label}
                                        </span>
                                      ) : null}
                                    </li>
                                  );
                                })}
                              </ul>
                            ) : (
                              <p className="mt-1 text-muted-foreground">{t.bezZprav}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        {c.state !== "schvaleno" && (
                          <Button size="sm" onClick={() => void changeState(c, "schvaleno")} disabled={busy}>
                            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                            {t.schvalit}
                          </Button>
                        )}
                        {c.state !== "zamitnuto" && (
                          <Button size="sm" variant="outline" onClick={() => void changeState(c, "zamitnuto")} disabled={busy}>
                            {t.zamitnout}
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => setEditing({ id: c.id, draft: { name: c.name, summary: c.summary ?? "" } })} disabled={busy}>
                          {t.upravit}
                        </Button>
                      </div>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t.nova}</DialogTitle>
            <DialogDescription>{t.popis}</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="nova-karta-jmeno">{t.jmeno}</Label>
              <Input id="nova-karta-jmeno" value={newDraft.name} onChange={(e) => setNewDraft((d) => ({ ...d, name: e.target.value }))} placeholder={t.jmenoPlaceholder} autoFocus />
            </div>
            <div className="space-y-1">
              <Label htmlFor="nova-karta-shrnuti">{t.shrnuti}</Label>
              <Textarea id="nova-karta-shrnuti" rows={3} value={newDraft.summary} onChange={(e) => setNewDraft((d) => ({ ...d, summary: e.target.value }))} placeholder={t.shrnutiPlaceholder} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreating(false)} disabled={busyId === "new"}>
              {t.zrusit}
            </Button>
            <Button onClick={() => void create()} disabled={busyId === "new" || !newDraft.name.trim()}>
              {busyId === "new" ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
              {t.vytvorit}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

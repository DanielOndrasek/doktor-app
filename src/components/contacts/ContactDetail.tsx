import { useEffect, useState } from "react";
import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { cs as csLocale } from "date-fns/locale";
import { ArrowLeft, Building2, CheckCircle, Clock, Loader2, Mail, MessageSquare, Phone, Plus } from "lucide-react";

import type { KanbanCardData } from "@/components/kanban";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import { contactDisplayName, draftOfContact, type ContactDetail as ContactDetailData, type ContactDraft, type ContactNote, type ContactSource } from "@/lib/contacts";
import { splitDue } from "@/lib/taskDue";
import { Chip, DetailCard, EditToggle, FactGrid, Field, Group, InfoRow, SectionTitle, initialsOf } from "./DetailPrimitives";

interface ContactDetailProps {
  contactId: string;
  source: ContactSource;
  onBack: () => void;
  onOpenTask: (taskId: string) => void;
  onAddTask: (contactId: string) => void;
  /** Roste při uložení úkolu z dialogu — karta si znovu načte otevřené úkoly. */
  tasksVersion: number;
}

const INPUT = "h-8 w-full text-sm";

function absolute(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? format(d, "d. M. yyyy HH:mm", { locale: csLocale }) : iso;
}

function relative(iso: string): string {
  const d = parseISO(iso);
  return isValid(d) ? formatDistanceToNowStrict(d, { locale: csLocale, addSuffix: true }) : iso;
}

/**
 * Karta kontaktu: údaje (přehled / formulář), e-maily a telefony, štítky,
 * otevřené úkoly, poznámky a zápisy. E-maily s kontaktem přijdou z enginu
 * (K2.3) — zatím jen text. Tvar levého sloupce je z `VbPersonDetailPage`
 * (vividbooks CRM, `831f9ae6`) přes primitiva v `DetailPrimitives.tsx`;
 * `ActivityPanel` / `ActivityTimeline` (obchody, webináře, mailing) se
 * nepřebírají — timeline tady jsou `poznamky`.
 */
export function ContactDetail({ contactId, source, onBack, onOpenTask, onAddTask, tasksVersion }: ContactDetailProps) {
  const t = cs.kontakty.detail;
  const { toast } = useToast();
  const [contact, setContact] = useState<ContactDetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [edit, setEdit] = useState(false);
  const [draft, setDraft] = useState<ContactDraft | null>(null);
  const [saving, setSaving] = useState(false);
  const [tasks, setTasks] = useState<KanbanCardData[]>([]);
  const [notes, setNotes] = useState<ContactNote[]>([]);
  const [noteText, setNoteText] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [newPhone, setNewPhone] = useState("");

  const fail = (title: string, err: unknown) => toast({ title, description: err instanceof Error ? err.message : undefined, variant: "destructive" });

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setEdit(false);
    Promise.all([source.get(contactId), source.notes(contactId)])
      .then(([c, n]) => {
        if (cancelled) return;
        setContact(c);
        setDraft(c ? draftOfContact(c) : null);
        setNotes(n);
      })
      .catch((err: unknown) => {
        if (!cancelled) fail(t.nacteniSelhalo, err);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, source]);

  useEffect(() => {
    let cancelled = false;
    source
      .openTasks(contactId)
      .then((list) => {
        if (!cancelled) setTasks(list);
      })
      .catch((err: unknown) => {
        if (!cancelled) fail(cs.ukoly.nacteniSelhalo, err);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contactId, source, tasksVersion]);

  const reload = async () => {
    const c = await source.get(contactId);
    setContact(c);
    if (c) setDraft(draftOfContact(c));
  };

  const save = async () => {
    if (!contact || !draft) return;
    setSaving(true);
    try {
      const saved = await source.update(contact, draft);
      setContact(saved);
      setDraft(draftOfContact(saved));
      setEdit(false);
      toast({ title: t.ulozen });
    } catch (err) {
      fail(t.ulozeniSelhalo, err);
    } finally {
      setSaving(false);
    }
  };

  const addEmail = async () => {
    const v = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
      toast({ title: t.neplatnyEmail, variant: "destructive" });
      return;
    }
    try {
      await source.addAddress(contactId, v);
      setNewEmail("");
      await reload();
    } catch (err) {
      fail(t.ulozeniSelhalo, err);
    }
  };

  const addPhone = async () => {
    const v = newPhone.trim();
    if (!v) return;
    try {
      await source.addPhone(contactId, v);
      setNewPhone("");
      await reload();
    } catch (err) {
      fail(t.ulozeniSelhalo, err);
    }
  };

  const addNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    setSavingNote(true);
    try {
      const note = await source.addNote(contactId, text);
      setNotes((prev) => [note, ...prev]);
      setNoteText("");
    } catch (err) {
      fail(t.ulozeniSelhalo, err);
    } finally {
      setSavingNote(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
      </div>
    );
  }
  if (!contact || !draft) {
    return <div className="p-6 text-sm text-muted-foreground">{t.nenalezen}</div>;
  }

  const name = contactDisplayName(contact);
  const set = (patch: Partial<ContactDraft>) => setDraft((d) => (d ? { ...d, ...patch } : d));

  return (
    <div className="mx-auto max-w-4xl space-y-4 px-4 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-4 md:pb-8">
      <div className="flex items-start gap-3">
        <button type="button" onClick={onBack} className="mt-1 rounded-md p-1 text-muted-foreground hover:bg-muted hover:text-foreground md:hidden" aria-label={t.zpet}>
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary/10 text-sm font-semibold text-secondary">{initialsOf(name)}</span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-bold tracking-tight">{name}</h1>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-muted-foreground">
            {contact.titles ? <span>{contact.titles}</span> : null}
            {contact.organization ? (
              <span className="inline-flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {contact.organization}
              </span>
            ) : null}
            {contact.role ? <span>{contact.role}</span> : null}
            {contact.tags.map((tag) => (
              <Chip key={tag} tone="blue">
                {tag}
              </Chip>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <DetailCard>
            <SectionTitle aside={<EditToggle edit={edit} onToggle={() => (edit ? void save() : setEdit(true))} labels={{ edit: t.upravit, done: saving ? cs.ukoly.detail.ukladam : t.ulozit }} />}>
              {t.udaje}
            </SectionTitle>
            {edit ? (
              <div className="space-y-2">
                <Group title={t.udaje}>
                  <Field label={t.jmeno}>
                    <Input className={INPUT} value={draft.firstName} onChange={(e) => set({ firstName: e.target.value })} />
                  </Field>
                  <Field label={t.prijmeni}>
                    <Input className={INPUT} value={draft.lastName} onChange={(e) => set({ lastName: e.target.value })} />
                  </Field>
                  <Field label={t.tituly}>
                    <Input className={INPUT} value={draft.titles} onChange={(e) => set({ titles: e.target.value })} />
                  </Field>
                  <Field label={t.role}>
                    <Input className={INPUT} value={draft.role} onChange={(e) => set({ role: e.target.value })} />
                  </Field>
                  <Field label={t.organizace} wide>
                    <Input className={INPUT} placeholder={t.organizacePlaceholder} value={draft.organizationName} onChange={(e) => set({ organizationName: e.target.value })} />
                  </Field>
                  <Field label={t.poznamka} wide>
                    <Textarea rows={3} className="text-sm" placeholder={t.poznamkaPlaceholder} value={draft.note} onChange={(e) => set({ note: e.target.value })} />
                  </Field>
                </Group>
                <div className="flex justify-end gap-2 pt-1">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setDraft(draftOfContact(contact));
                      setEdit(false);
                    }}
                  >
                    {t.zrusit}
                  </Button>
                  <Button type="button" size="sm" onClick={() => void save()} disabled={saving}>
                    {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
                    {t.ulozit}
                  </Button>
                </div>
              </div>
            ) : (
              <FactGrid
                empty={t.upravit}
                facts={[
                  [t.tituly, contact.titles],
                  [t.role, contact.role],
                  [t.organizace, contact.organization],
                  [t.zdroj, contact.source ? (t.zdroje[contact.source] ?? contact.source) : null],
                  [t.poznamka, contact.note, true],
                ]}
              />
            )}
          </DetailCard>

          <DetailCard>
            <SectionTitle>{t.adresy}</SectionTitle>
            {contact.addresses.map((a) => (
              <InfoRow key={a.id} icon={Mail} aside={a.primary ? t.primarni : undefined} mono>
                <a href={`mailto:${a.value}`} className="hover:underline">
                  {a.value}
                </a>
              </InfoRow>
            ))}
            <form
              className="mt-2 flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void addEmail();
              }}
            >
              <Input type="email" className={INPUT} placeholder={t.pridatAdresu} value={newEmail} onChange={(e) => setNewEmail(e.target.value)} aria-label={t.pridatAdresu} />
              <Button type="submit" size="sm" variant="outline" className="h-8 shrink-0" disabled={!newEmail.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </form>
            <SectionTitle>
              <span className="mt-4 inline-block">{t.telefony}</span>
            </SectionTitle>
            {contact.phones.map((p) => (
              <InfoRow key={p.id} icon={Phone} aside={p.primary ? t.primarni : undefined} mono>
                <a href={`tel:${p.value}`} className="hover:underline">
                  {p.value}
                </a>
              </InfoRow>
            ))}
            <form
              className="mt-2 flex gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void addPhone();
              }}
            >
              <Input type="tel" className={INPUT} placeholder={t.pridatTelefon} value={newPhone} onChange={(e) => setNewPhone(e.target.value)} aria-label={t.pridatTelefon} />
              <Button type="submit" size="sm" variant="outline" className="h-8 shrink-0" disabled={!newPhone.trim()}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </form>
          </DetailCard>

          <DetailCard>
            <SectionTitle>{t.emaily}</SectionTitle>
            <p className="text-xs text-muted-foreground">{t.emailyZEnginu}</p>
          </DetailCard>
        </div>

        <div className="space-y-4">
          <DetailCard>
            <SectionTitle
              aside={
                <button type="button" onClick={() => onAddTask(contact.id)} className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium normal-case tracking-normal text-secondary hover:bg-secondary/10">
                  <Plus className="h-3 w-3" />
                  {t.pridatUkol}
                </button>
              }
            >
              {t.ukoly}
            </SectionTitle>
            {tasks.length ? (
              <ul className="divide-y divide-border/60">
                {tasks.map((task) => {
                  const { date, time } = splitDue(task.due);
                  return (
                    <li key={task.id}>
                      <button type="button" onClick={() => onOpenTask(task.id)} className="flex w-full items-start gap-2 py-2 text-left hover:text-secondary">
                        <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground/70" />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] font-medium leading-5">{task.title}</span>
                          <span className="block text-[11px] text-muted-foreground">
                            {cs.ukoly.stavy[task.state]}
                            {date ? ` · ${format(parseISO(date), "d. M.", { locale: csLocale })}${time ? ` ${time}` : ""}` : ""}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p className="text-xs text-muted-foreground">{t.zadneUkoly}</p>
            )}
          </DetailCard>

          <DetailCard>
            <SectionTitle>{t.poznamky}</SectionTitle>
            <form
              className="space-y-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                void addNote();
              }}
            >
              <Textarea rows={2} className="text-sm" placeholder={t.novaPoznamka} value={noteText} onChange={(e) => setNoteText(e.target.value)} />
              <div className="flex justify-end">
                <Button type="submit" size="sm" variant="secondary" className="h-7 text-xs" disabled={!noteText.trim() || savingNote}>
                  {savingNote ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : <MessageSquare className="mr-1 h-3 w-3" />}
                  {t.ulozitPoznamku}
                </Button>
              </div>
            </form>
            {notes.length ? (
              <ul className="mt-3 space-y-2">
                {notes.map((n) => (
                  <li key={n.id} className="rounded-lg bg-muted/40 px-3 py-2">
                    <div className="mb-0.5 flex items-center gap-2 text-[11px] text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span title={absolute(n.createdAt)}>{relative(n.createdAt)}</span>
                      <span>·</span>
                      <span>{t.druhy[n.kind]}</span>
                      {n.source !== "rucne" ? <Chip tone={n.source === "claude" ? "blue" : "amber"}>{n.source}</Chip> : null}
                    </div>
                    <p className="whitespace-pre-wrap text-[13px] leading-snug">{n.text}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-xs text-muted-foreground">{t.zadnePoznamky}</p>
            )}
          </DetailCard>

          <p className="px-1 text-[11px] text-muted-foreground">
            {t.zalozeno} {absolute(contact.createdAt)} · {t.upraveno} {absolute(contact.updatedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}

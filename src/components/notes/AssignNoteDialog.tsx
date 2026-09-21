import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DatePicker } from "@/components/ui/date-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";
import type { ContactCandidate, NoteAssignment, NoteIntake } from "@/lib/notes";

interface AssignNoteDialogProps {
  note: NoteIntake;
  onClose: () => void;
  onAssign: (note: NoteIntake, assignment: NoteAssignment) => Promise<void>;
  onDismiss: (note: NoteIntake) => Promise<void>;
  /** Hledání v kontaktech (od tří znaků, s odstupem 250 ms). */
  onSearchContacts?: (query: string) => Promise<ContactCandidate[]>;
}

/**
 * Zařazení zápisu: výběr kontaktu (kandidáti + hledání), úprava shrnutí,
 * úkoly z hovoru s termínem, celý přepis na vyžádání.
 *
 * Převzato z `AssignDialog` v `components/vividbooks/CallRecordingsInbox.tsx`
 * (vividbooks CRM, `831f9ae6`). Škola → kontakt, výběr obchodu odpadl
 * (případy jsou O2), RPC `call_recording_assign` a `update status` → propsy
 * `onAssign` / `onDismiss`, hledání ve `v_school_list` → `onSearchContacts`,
 * nativní `confirm()` → `AlertDialog`, nativní pole → primitiva z kitu.
 */
export function AssignNoteDialog({ note, onClose, onAssign, onDismiss, onSearchContacts }: AssignNoteDialogProps) {
  const { toast } = useToast();
  const [contact, setContact] = useState<ContactCandidate | null>(note.candidates[0] ?? null);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<ContactCandidate[]>([]);
  const [summary, setSummary] = useState(note.summary ?? "");
  const [tasks, setTasks] = useState(() => note.tasks.map((t) => ({ ...t, on: true })));
  const [showTranscript, setShowTranscript] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDismiss, setConfirmDismiss] = useState(false);

  useEffect(() => {
    if (!onSearchContacts || query.trim().length < 3) {
      setHits([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(() => {
      onSearchContacts(query.trim())
        .then((found) => {
          if (!cancelled) setHits(found);
        })
        .catch(() => {
          if (!cancelled) setHits([]);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query, onSearchContacts]);

  const candidates = [
    ...note.candidates,
    ...(contact && !note.candidates.some((c) => c.id === contact.id) ? [contact] : []),
  ];

  const assign = async () => {
    if (!contact) return;
    setBusy(true);
    try {
      await onAssign(note, {
        contactId: contact.id,
        summary,
        tasks: tasks.filter((t) => t.on && t.text.trim()).map((t) => ({ text: t.text.trim(), due: t.due })),
      });
      toast({ title: cs.zapisy.zapsano });
    } catch (err) {
      toast({
        title: cs.zapisy.chybaZapisu,
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  const dismiss = async () => {
    setConfirmDismiss(false);
    try {
      await onDismiss(note);
    } catch (err) {
      toast({
        title: cs.zapisy.chybaNezarazeni,
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const sectionLabel = "mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground";

  return (
    <>
      <Dialog
        open
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
      >
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{note.title ?? cs.zapisy.hovor}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className={sectionLabel}>
                {cs.zapisy.kontakt}
                {note.contactHint ? (
                  <span className="ml-1 font-normal normal-case tracking-normal">{cs.zapisy.vHovoruZaznelo(note.contactHint)}</span>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {candidates.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setContact(c)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-xs",
                      contact?.id === c.id
                        ? "border-primary bg-primary/10 font-semibold text-primary"
                        : "bg-background text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {c.name}
                    {c.detail ? ` · ${c.detail}` : ""}
                  </button>
                ))}
              </div>
              {onSearchContacts ? (
                <div className="relative mt-2">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={cs.zapisy.hledatKontakt}
                    className="h-8 pl-8 text-sm"
                  />
                  {hits.length ? (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md">
                      {hits.map((h) => (
                        <button
                          key={h.id}
                          type="button"
                          onClick={() => {
                            setContact(h);
                            setQuery("");
                            setHits([]);
                          }}
                          className="block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          {h.name}
                          {h.detail ? ` · ${h.detail}` : ""}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>

            <div>
              <div className={sectionLabel}>{cs.zapisy.zapis}</div>
              <Textarea
                value={summary}
                onChange={(e) => setSummary(e.target.value)}
                rows={10}
                className="leading-relaxed"
                placeholder={cs.zapisy.zapisPlaceholder}
              />
            </div>

            {tasks.length ? (
              <div>
                <div className={sectionLabel}>{cs.zapisy.ukolyZHovoru}</div>
                <div className="space-y-1.5">
                  {tasks.map((t, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <Checkbox
                        checked={t.on}
                        onCheckedChange={(v) => setTasks((p) => p.map((x, k) => (k === i ? { ...x, on: v === true } : x)))}
                      />
                      <Input
                        value={t.text}
                        onChange={(e) => setTasks((p) => p.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))}
                        className={cn("h-8 text-sm", !t.on && "opacity-50")}
                      />
                      <DatePicker
                        size="sm"
                        value={t.due ?? ""}
                        onChange={(next) => setTasks((p) => p.map((x, k) => (k === i ? { ...x, due: next || null } : x)))}
                        className="w-40"
                      />
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            <div>
              <button
                type="button"
                onClick={() => setShowTranscript((v) => !v)}
                className="text-xs font-medium text-muted-foreground underline"
              >
                {showTranscript ? cs.zapisy.skrytPrepis : cs.zapisy.zobrazitPrepis}
              </button>
              {showTranscript ? (
                <pre className="mt-2 max-h-72 overflow-auto whitespace-pre-wrap rounded-lg border bg-muted/30 p-3 text-[12px] leading-relaxed">
                  {note.transcript}
                </pre>
              ) : null}
            </div>

            <div className="flex items-center justify-between">
              <Button variant="ghost" size="sm" className="text-muted-foreground" onClick={() => setConfirmDismiss(true)}>
                {cs.zapisy.nezaradit}
              </Button>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose}>
                  {cs.zapisy.zavrit}
                </Button>
                <Button onClick={() => void assign()} disabled={busy || !contact}>
                  {busy ? <Loader2 className="mr-1.5 h-4 w-4 animate-spin" /> : null}
                  {cs.zapisy.zapsatKeKontaktu}
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDismiss} onOpenChange={setConfirmDismiss}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{cs.zapisy.nezaraditOtazka}</AlertDialogTitle>
            <AlertDialogDescription>{cs.zapisy.nezaraditPopis}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{cs.zapisy.zavrit}</AlertDialogCancel>
            <AlertDialogAction onClick={() => void dismiss()}>{cs.zapisy.nezaradit}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useState } from "react";
import { format, formatDistanceToNowStrict, isValid, parseISO } from "date-fns";
import { cs as csLocale } from "date-fns/locale";
import { Mic } from "lucide-react";

import { cs } from "@/lib/i18n/cs";
import type { ContactCandidate, NoteAssignment, NoteIntake } from "@/lib/notes";
import { AssignNoteDialog } from "./AssignNoteDialog";

interface NotesInboxProps {
  notes: NoteIntake[];
  onAssign: (note: NoteIntake, assignment: NoteAssignment) => Promise<void>;
  onDismiss: (note: NoteIntake) => Promise<void>;
  onSearchContacts?: (query: string) => Promise<ContactCandidate[]>;
}

/** Relativně („před 2 hodinami") s absolutním časem v `title` — konvence z CLAUDE.md. */
function when(iso: string): { label: string; title: string } | null {
  const d = parseISO(iso);
  if (!isValid(d)) return null;
  return {
    label: formatDistanceToNowStrict(d, { addSuffix: true, locale: csLocale }),
    title: format(d, "EEEE d. MMMM yyyy, HH:mm", { locale: csLocale }),
  };
}

/**
 * Zápisy z hovorů čekající na zařazení ke kontaktu. Sekce se ukáže jen,
 * když nějaké jsou.
 *
 * Převzato z `components/vividbooks/CallRecordingsInbox.tsx` (vividbooks
 * CRM, `831f9ae6`). Čtení z `call_recordings` → prop `notes`; škola →
 * kontakt; fialová značka Plaudu → akcent; `formatRelativeTimeCs` →
 * date-fns s `cs`.
 */
export function NotesInbox({ notes, onAssign, onDismiss, onSearchContacts }: NotesInboxProps) {
  const [open, setOpen] = useState<NoteIntake | null>(null);

  if (!notes.length) return null;

  return (
    <section className="animate-fade-in-up">
      <div className="mb-2 flex items-center gap-2 px-1">
        <h2 className="text-[12px] font-bold uppercase tracking-[0.06em] text-muted-foreground">{cs.zapisy.nazev}</h2>
        <span className="rounded-full bg-secondary/15 px-2 py-0.5 text-[11.5px] font-bold text-secondary">{notes.length}</span>
      </div>
      <ul className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        {notes.map((n) => {
          const time = when(n.recordedAt ?? n.createdAt);
          const who = n.candidates[0] ? cs.zapisy.nejspis(n.candidates[0].name) : n.contactHint || cs.zapisy.kontaktNerozpoznan;
          return (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => setOpen(n)}
                className="home-surface-plain flex w-full items-center gap-3 rounded-[18px] bg-card px-4 py-3 text-left transition-all hover:-translate-y-0.5"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-secondary/10 text-secondary">
                  <Mic className="h-5 w-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{n.title ?? cs.zapisy.hovor}</span>
                  <span className="block truncate text-[12px] text-muted-foreground">
                    {who}
                    {time ? (
                      <>
                        {" · "}
                        <span title={time.title}>{time.label}</span>
                      </>
                    ) : null}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-semibold text-primary">{cs.zapisy.zaradit}</span>
              </button>
            </li>
          );
        })}
      </ul>
      {open ? (
        <AssignNoteDialog
          note={open}
          onClose={() => setOpen(null)}
          onAssign={async (note, assignment) => {
            await onAssign(note, assignment);
            setOpen(null);
          }}
          onDismiss={async (note) => {
            await onDismiss(note);
            setOpen(null);
          }}
          onSearchContacts={onSearchContacts}
        />
      ) : null}
    </section>
  );
}

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Plus, Users } from "lucide-react";

import { ContactDetail } from "@/components/contacts/ContactDetail";
import { ContactDialog } from "@/components/contacts/ContactDialog";
import { ContactList } from "@/components/contacts/ContactList";
import { Placeholder } from "@/components/contacts/DetailPrimitives";
import { TaskDialog, type TaskDialogTarget } from "@/components/tasks";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import type { ContactListItem, ContactSource } from "@/lib/contacts";
import type { TaskSource } from "@/lib/tasks";
import { cn } from "@/lib/utils";

/** `?kontakt=<id>` otevře kartu — stejný odkaz dá Pošta i Dnes. */
const CONTACT_PARAM = "kontakt";

/**
 * Kontakty (K4.1, přitaženo do K3): adresář vlevo, karta vpravo; na mobilu
 * jedno nebo druhé. Hledání jde na server (jméno, tituly, adresa),
 * s odstupem 250 ms jako v `ActivityDialog` z CRM.
 */
export default function Contacts({ source, taskSource }: { source: ContactSource; taskSource: TaskSource }) {
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const [items, setItems] = useState<ContactListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [taskTarget, setTaskTarget] = useState<TaskDialogTarget | null>(null);
  const [tasksVersion, setTasksVersion] = useState(0);

  const selectedId = searchParams.get(CONTACT_PARAM);

  const setParam = useCallback(
    (id: string | null) =>
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (id) next.set(CONTACT_PARAM, id);
          else next.delete(CONTACT_PARAM);
          return next;
        },
        { replace: true },
      ),
    [setSearchParams],
  );

  const load = useCallback(
    async (q: string) => {
      setLoading(true);
      try {
        setItems(await source.list(q));
      } catch (err) {
        toast({ title: cs.kontakty.nacteniSelhalo, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [source, toast],
  );

  useEffect(() => {
    const timer = setTimeout(() => void load(search), search ? 250 : 0);
    return () => clearTimeout(timer);
  }, [search, load]);

  const selected = useMemo(() => items.find((c) => c.id === selectedId) ?? null, [items, selectedId]);

  return (
    <div className="flex h-full min-h-0">
      <aside className={cn("w-full shrink-0 border-r border-border/70 bg-background md:flex md:w-80 md:flex-col", selectedId ? "hidden" : "flex flex-col")}>
        <div className="flex shrink-0 items-center gap-2 px-3 pt-4">
          <h1 className="text-2xl font-bold tracking-tight">{cs.kontakty.titulek}</h1>
          <Button size="sm" className="ml-auto h-8" onClick={() => setCreating(true)}>
            <Plus className="mr-1 h-3.5 w-3.5" aria-hidden />
            {cs.kontakty.novyKontakt}
          </Button>
        </div>
        <div className="min-h-0 flex-1">
          <ContactList items={items} loading={loading} search={search} onSearch={setSearch} selectedId={selectedId} onSelect={(id) => setParam(id)} />
        </div>
      </aside>

      <section className={cn("min-h-0 min-w-0 flex-1 overflow-auto", selectedId ? "block" : "hidden md:block")}>
        {selectedId ? (
          <ContactDetail
            key={selectedId}
            contactId={selectedId}
            source={source}
            onBack={() => setParam(null)}
            onOpenTask={(taskId) => setTaskTarget({ mode: "edit", id: taskId })}
            onAddTask={(contactId) => setTaskTarget({ mode: "new", state: "todo", contactId })}
            tasksVersion={tasksVersion}
          />
        ) : (
          <div className="flex h-full items-center justify-center p-8">
            <div className="w-full max-w-sm">
              <Placeholder icon={Users} title={cs.kontakty.vybertKontakt} text={selected ? undefined : undefined} />
            </div>
          </div>
        )}
      </section>

      <ContactDialog
        open={creating}
        source={source}
        onClose={() => setCreating(false)}
        onCreated={(c) => {
          void load(search);
          setParam(c.id);
        }}
      />
      <TaskDialog
        target={taskTarget}
        source={taskSource}
        onClose={() => setTaskTarget(null)}
        onSaved={() => setTasksVersion((v) => v + 1)}
      />
    </div>
  );
}

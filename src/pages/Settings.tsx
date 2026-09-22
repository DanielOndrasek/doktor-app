import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, PenLine, Plus } from "lucide-react";

import { SignatureEditor } from "@/components/email/SignatureEditor";
import { RulesSection } from "@/components/settings/RulesSection";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import { loadMailboxes } from "@/lib/mailboxes";
import type { RuleSource } from "@/lib/rules";
import { signatureHtmlToText, type Signature, type SignatureSource } from "@/lib/signatures";
import { cn } from "@/lib/utils";

const NONE = "__none__";
const LANGUAGES = ["cs", "en"] as const;

/**
 * Nastavení (K3.3): podpisy e-mailu. Seznam vlevo, vpravo údaje (název, jazyk,
 * výchozí pro schránku) a editor podpisu převzatý z CRM. Nic se nemaže.
 * Pod tím pravidla pro Clauda (`pouceni`, kontrolní seznam „pravidla").
 * Oddíl schránek přijde, až bude co nastavovat.
 */
export default function Settings({ signatures: source, rules }: { signatures: SignatureSource; rules: RuleSource }) {
  const t = cs.nastaveni;
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data: signatures = [], isLoading, error } = useQuery({ queryKey: ["podpisy"], queryFn: () => source.list() });
  const { data: mailboxes = [] } = useQuery({ queryKey: ["schranky"], queryFn: () => loadMailboxes() });

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected: Signature | null = signatures.find((s) => s.id === selectedId) ?? signatures[0] ?? null;

  const [name, setName] = useState("");
  const [language, setLanguage] = useState("");
  const [mailboxId, setMailboxId] = useState("");
  const [saving, setSaving] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    setName(selected?.name ?? "");
    setLanguage(selected?.language ?? "");
    setMailboxId(selected?.defaultForMailboxId ?? "");
    // Formulář se plní při změně vybraného podpisu, ne při každém překreslení.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.id]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["podpisy"] });

  const failed = (err: unknown) =>
    toast({ title: t.podpisy.ulozeniSelhalo, description: err instanceof Error ? err.message : undefined, variant: "destructive" });

  const saveMeta = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await source.update(selected.id, { name, language: language || null, defaultForMailboxId: mailboxId || null });
      await refresh();
      toast({ title: t.podpisy.ulozeno });
    } catch (err) {
      failed(err);
    } finally {
      setSaving(false);
    }
  };

  const saveHtml = async (html: string) => {
    if (!selected) return;
    try {
      await source.update(selected.id, { html, text: signatureHtmlToText(html) });
      await refresh();
      toast({ title: t.podpisy.ulozeno });
    } catch (err) {
      failed(err);
      throw err;
    }
  };

  const create = async () => {
    setCreating(true);
    try {
      const created = await source.create(t.podpisy.novyNazev);
      await refresh();
      setSelectedId(created.id);
    } catch (err) {
      failed(err);
    } finally {
      setCreating(false);
    }
  };

  const metaDirty = !!selected && (name !== selected.name || (language || "") !== (selected.language ?? "") || (mailboxId || "") !== (selected.defaultForMailboxId ?? ""));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 p-4 md:p-6">
      <h1 className="text-xl font-semibold text-foreground">{t.nadpis}</h1>

      <section className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-2 border-b border-border px-4 py-3">
          <PenLine className="h-4 w-4 text-muted-foreground" aria-hidden />
          <h2 className="text-sm font-semibold text-foreground">{t.podpisy.nadpis}</h2>
          <Button size="sm" variant="outline" className="ml-auto h-7" onClick={() => void create()} disabled={creating}>
            {creating ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />}
            {t.podpisy.novy}
          </Button>
        </div>
        <p className="border-b border-border px-4 py-2 text-xs text-muted-foreground">{t.podpisy.napoveda}</p>

        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          </div>
        ) : error ? (
          <p className="px-4 py-6 text-sm text-destructive">{t.podpisy.nacteniSelhalo}</p>
        ) : signatures.length === 0 ? (
          <p className="px-4 py-6 text-sm text-muted-foreground">{t.podpisy.zadne}</p>
        ) : (
          <div className="grid md:grid-cols-[220px_1fr]">
            <ul className="border-b border-border md:border-b-0 md:border-r">
              {signatures.map((s) => {
                const box = mailboxes.find((m) => m.id === s.defaultForMailboxId);
                return (
                  <li key={s.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(s.id)}
                      aria-current={selected?.id === s.id ? "true" : undefined}
                      className={cn(
                        "flex w-full flex-col items-start px-4 py-2.5 text-left text-sm transition-colors hover:bg-muted/60",
                        selected?.id === s.id && "bg-muted",
                      )}
                    >
                      <span className="font-medium text-foreground">{s.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {box ? `${t.podpisy.vychoziPro} ${cs.posta.schranky[box.typ]}` : t.podpisy.beySchranky}
                        {s.language ? ` · ${t.podpisy.jazyky[s.language as (typeof LANGUAGES)[number]] ?? s.language}` : ""}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>

            {selected && (
              <div className="space-y-4 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="podpis-nazev">{t.podpisy.nazev}</Label>
                    <Input id="podpis-nazev" className="h-8 text-sm" value={name} onChange={(e) => setName(e.target.value)} placeholder={t.podpisy.nazevPlaceholder} />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="podpis-jazyk">{t.podpisy.jazyk}</Label>
                    <Select value={language || NONE} onValueChange={(v) => setLanguage(v === NONE ? "" : v)}>
                      <SelectTrigger id="podpis-jazyk" className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t.podpisy.bezJazyka}</SelectItem>
                        {LANGUAGES.map((l) => (
                          <SelectItem key={l} value={l}>
                            {t.podpisy.jazyky[l]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="podpis-schranka">{t.podpisy.vychoziPro}</Label>
                    <Select value={mailboxId || NONE} onValueChange={(v) => setMailboxId(v === NONE ? "" : v)}>
                      <SelectTrigger id="podpis-schranka" className="h-8 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NONE}>{t.podpisy.zadnaSchranka}</SelectItem>
                        {mailboxes.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {cs.posta.schranky[m.typ]} · {m.adresa}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex justify-end">
                  <Button size="sm" onClick={() => void saveMeta()} disabled={!metaDirty || saving}>
                    {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                    {t.podpisy.ulozitUdaje}
                  </Button>
                </div>

                <SignatureEditor key={selected.id} value={selected.html ?? ""} onSave={saveHtml} placeholder={cs.posta.podpis.placeholder} />
              </div>
            )}
          </div>
        )}
      </section>

      <RulesSection source={rules} />
    </div>
  );
}

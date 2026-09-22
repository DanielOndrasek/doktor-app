import { useState } from "react";
import { Loader2, MessageCircleQuestion, SlidersHorizontal } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import { activeFilterCount } from "@/lib/email/search";
import type { MailSearchFilter } from "@/lib/email/types";

interface EmailSearchFilterProps {
  value: MailSearchFilter;
  onApply: (filter: MailSearchFilter) => void;
  onClear: () => void;
  /** Klíčové slovo z pole hledání — předvyplní dotaz pro Clauda. */
  query: string;
  /**
   * „Zeptat se" (kontrolní seznam plánu): dotaz jde do `fronta_claude`, ne na
   * žádný model z aplikace. Bez propu se tlačítko neukáže.
   */
  onAsk?: (question: string) => Promise<void>;
}

/**
 * „Hledat" bez AI (plán K0.4): osoba, adresát, období, směr, příloha — přímý
 * dotaz do indexu enginu přes `MailListParams.filter`. Vedle něj „Zeptat se
 * Clauda": otázka s kontextem hledání do fronty, odpověď se ukáže na Dnes.
 * Vlastní komponenta nad primitivy kitu (Popover, Dialog, Select, Checkbox).
 */
export function EmailSearchFilter({ value, onApply, onClear, query, onAsk }: EmailSearchFilterProps) {
  const t = cs.posta.hledani;
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<MailSearchFilter>(value);
  const [askOpen, setAskOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [asking, setAsking] = useState(false);
  const active = activeFilterCount(value);

  const openPopover = (next: boolean) => {
    if (next) setDraft(value);
    setOpen(next);
  };

  const apply = () => {
    onApply(draft);
    setOpen(false);
  };

  const openAsk = () => {
    setQuestion(query.trim());
    setOpen(false);
    setAskOpen(true);
  };

  const submitAsk = async () => {
    if (!onAsk) return;
    if (!question.trim()) {
      toast({ title: t.chybiOtazka, variant: "destructive" });
      return;
    }
    setAsking(true);
    try {
      await onAsk(question.trim());
      toast({ title: t.dotazPredan });
      setAskOpen(false);
      setQuestion("");
    } catch (err) {
      toast({ title: t.dotazSelhal, description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setAsking(false);
    }
  };

  return (
    <>
      <Popover open={open} onOpenChange={openPopover}>
        <PopoverTrigger asChild>
          <Button variant={active ? "default" : "ghost"} size="icon" className="relative flex-shrink-0" title={t.rozsirene} aria-label={t.rozsirene}>
            <SlidersHorizontal className="h-4 w-4" />
            {active ? (
              <span className="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-secondary px-1 text-[10px] font-semibold text-secondary-foreground">
                {active}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(22rem,calc(100vw-2rem))] space-y-3 p-3">
          <div className="text-sm font-semibold">{t.rozsirene}</div>
          <div className="space-y-2 text-xs">
            <div className="space-y-1">
              <Label htmlFor="hledani-od" className="text-xs">
                {t.od}
              </Label>
              <Input
                id="hledani-od"
                value={draft.from ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, from: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && apply()}
                placeholder={t.odPlaceholder}
                className="h-8 text-sm"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="hledani-komu" className="text-xs">
                {t.komu}
              </Label>
              <Input
                id="hledani-komu"
                value={draft.to ?? ""}
                onChange={(e) => setDraft((d) => ({ ...d, to: e.target.value }))}
                onKeyDown={(e) => e.key === "Enter" && apply()}
                placeholder={t.komuPlaceholder}
                className="h-8 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="hledani-od-data" className="text-xs">
                  {t.obdobiOd}
                </Label>
                <Input
                  id="hledani-od-data"
                  type="date"
                  value={draft.dateFrom ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, dateFrom: e.target.value || undefined }))}
                  className="h-8 text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="hledani-do-data" className="text-xs">
                  {t.obdobiDo}
                </Label>
                <Input
                  id="hledani-do-data"
                  type="date"
                  value={draft.dateTo ?? ""}
                  onChange={(e) => setDraft((d) => ({ ...d, dateTo: e.target.value || undefined }))}
                  className="h-8 text-sm"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{t.smer}</Label>
              <Select
                value={draft.direction ?? "all"}
                onValueChange={(v) => setDraft((d) => ({ ...d, direction: v === "sent" || v === "received" ? v : undefined }))}
              >
                <SelectTrigger className="h-8 text-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t.smerVse}</SelectItem>
                  <SelectItem value="received">{t.smerPrijate}</SelectItem>
                  <SelectItem value="sent">{t.smerOdeslane}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <label className="flex cursor-pointer items-center gap-2 pt-1">
              <Checkbox checked={Boolean(draft.hasAttachment)} onCheckedChange={(c) => setDraft((d) => ({ ...d, hasAttachment: c === true }))} />
              <span>{t.jenSPrilohou}</span>
            </label>
            <p className="text-[11px] text-muted-foreground">{t.vsechnySlozky}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={apply}>
              {t.hledat}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                onClear();
                setDraft({});
                setOpen(false);
              }}
              disabled={!active && !activeFilterCount(draft)}
            >
              {t.zrusit}
            </Button>
            {onAsk && (
              <Button size="sm" variant="outline" className="ml-auto" onClick={openAsk}>
                <MessageCircleQuestion className="mr-1.5 h-3.5 w-3.5" />
                {t.zeptatSe}
              </Button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      {onAsk && (
        <Dialog open={askOpen} onOpenChange={setAskOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>{t.zeptatSe}</DialogTitle>
              <DialogDescription>{t.zeptatSePopis}</DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="dotaz-claude">{t.otazka}</Label>
              <Textarea
                id="dotaz-claude"
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder={t.otazkaPlaceholder}
                rows={4}
                autoFocus
              />
              {query.trim() || active ? <p className="text-xs text-muted-foreground">{t.kontextHledani}</p> : null}
            </div>
            <DialogFooter>
              <Button variant="ghost" onClick={() => setAskOpen(false)} disabled={asking}>
                {cs.ui.zavrit}
              </Button>
              <Button onClick={() => void submitAsk()} disabled={asking}>
                {asking ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <MessageCircleQuestion className="mr-1.5 h-3.5 w-3.5" />}
                {t.predatClaudovi}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

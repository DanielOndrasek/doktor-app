import * as React from "react";
import { ListTodo } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

/**
 * Vzhled dialogu úkolu: hlavička s ikonou a stavem, tělo na dva sloupce
 * (formulář vlevo, kontext vpravo), patička s tlačítky.
 *
 * Převzato z `components/tasks/TaskDetailDialogChrome.tsx` (vividbooks CRM,
 * `831f9ae6`). Plochy hlavičky a patičky tam braly `--deal-*` tokeny zdi
 * obchodu (nepřebírají se) — tady jsou z tokenů Doktora (`muted`,
 * `secondary`). Texty chodí propsy z `cs`, komponenta žádné nemá.
 */
export const taskDialogContentClassName = cn(
  "flex max-h-[min(92dvh,880px)] flex-col gap-0 overflow-hidden p-0 sm:max-w-[min(100vw-2rem,680px)] border-border/70 shadow-xl sm:rounded-xl",
  "max-sm:top-[max(2.75rem,env(safe-area-inset-top))] max-sm:translate-y-0 max-sm:max-h-[calc(100dvh-3.5rem)]",
);

const fieldLabelClass = "text-xs font-medium text-muted-foreground";

/**
 * Na mobilu nechceme, aby se dialog otevřel s aktivním textovým polem —
 * Radix jinak zafokusuje první input a vyskočí klávesnice. Předává se do
 * `DialogContent.onOpenAutoFocus`.
 */
export function preventTaskDialogAutoFocusOnMobile(event: Event) {
  if (typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches) {
    event.preventDefault();
  }
}

export function TaskDialogHeader({
  title,
  stateLabel,
  stateBadge,
  done,
}: {
  title: string;
  stateLabel: string;
  stateBadge?: string;
  done?: boolean;
}) {
  return (
    <DialogHeader className="shrink-0 space-y-0 border-b border-border/80 bg-muted/40 px-5 pb-3 pt-4 text-left sm:px-6 sm:pb-3.5 sm:pt-5">
      <div className="flex items-start gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-secondary/10 shadow-sm"
          aria-hidden
        >
          <ListTodo className="h-5 w-5 text-secondary" />
        </div>
        <div className="min-w-0 flex-1 space-y-1 pr-8">
          <DialogTitle className="text-base font-semibold leading-tight tracking-tight text-foreground sm:text-lg">{title}</DialogTitle>
          {stateBadge ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className={fieldLabelClass}>{stateLabel}</span>
              <Badge variant={done ? "secondary" : "outline"} className="text-[10px] font-semibold uppercase tracking-wide">
                {stateBadge}
              </Badge>
            </div>
          ) : null}
        </div>
      </div>
    </DialogHeader>
  );
}

/** Dvousloupec na sm+: formulář vlevo, kontext vpravo; na mobilu pod sebou. */
export function TaskDialogBodyLayout({ main, context }: { main: React.ReactNode; context?: React.ReactNode }) {
  return (
    <div
      className={cn(
        "grid min-h-0 min-w-0 gap-4",
        context ? "grid-cols-1 sm:grid-cols-[minmax(0,1fr)_min(260px,38%)] sm:items-start sm:gap-x-4" : "grid-cols-1",
      )}
    >
      <div className="min-h-0 min-w-0 space-y-3">{main}</div>
      {context ? <div className="min-h-0 min-w-0">{context}</div> : null}
    </div>
  );
}

export function TaskDialogBody({ className, children }: React.PropsWithChildren<{ className?: string }>) {
  return <div className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 sm:px-6 sm:py-4", className)}>{children}</div>;
}

/**
 * Popis úkolu. Na mobilu roste s obsahem (do 240 px), na desktopu je
 * klasická vyšší textarea s ručním resize.
 */
export function TaskDescriptionTextarea({
  id,
  value,
  onChange,
  placeholder,
}: {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  const isMobile = useIsMobile();
  const ref = React.useRef<HTMLTextAreaElement>(null);

  React.useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (!isMobile) {
      el.style.height = "";
      return;
    }
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 240)}px`;
  }, [value, isMobile]);

  return (
    <Textarea
      id={id}
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      rows={isMobile ? 1 : 5}
      className={cn("max-h-[240px] py-2 text-sm leading-relaxed", isMobile ? "min-h-0 resize-none overflow-y-auto" : "min-h-[120px] resize-y overflow-y-auto")}
      placeholder={placeholder}
    />
  );
}

export function TaskFieldLabel({ htmlFor, children, className }: { htmlFor?: string; children: React.ReactNode; className?: string }) {
  return (
    <Label htmlFor={htmlFor} className={cn(fieldLabelClass, className)}>
      {children}
    </Label>
  );
}

export function TaskDialogMetaSection({ title, children }: React.PropsWithChildren<{ title: string }>) {
  return (
    <div className="space-y-2">
      <TaskFieldLabel>{title}</TaskFieldLabel>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

export function TaskDialogMetaRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="shrink-0 pt-0.5 text-muted-foreground">{label}</span>
      <div className="min-w-0 text-right font-medium leading-snug text-foreground">{children}</div>
    </div>
  );
}

export function TaskDialogFooterBar({ children }: React.PropsWithChildren) {
  return <div className="shrink-0 border-t border-border/80 bg-muted/40 px-4 py-3 sm:px-6 sm:py-3.5">{children}</div>;
}

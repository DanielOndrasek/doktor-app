import type { ReactNode } from "react";

import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { cs } from "@/lib/i18n/cs";

interface AuthShellProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Řádek pod kartou (odkaz zpět, odhlášení). */
  footer?: ReactNode;
}

/**
 * Společný obal přihlašovacích obrazovek: karta uprostřed na klidném pozadí.
 *
 * Vytažené z `pages/ClientAuth.tsx` (vividbooks CRM, `831f9ae6`) — CRM mělo
 * čtyři přihlašovací stránky, každou s vlastním obalem. Nepřebrala se aurora,
 * logo Vividbooks, znělka po přihlášení, přepínač jazyka ani odkazy na
 * obchodní podmínky.
 */
export function AuthShell({ title, subtitle, children, footer }: AuthShellProps) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-primary/5 via-background to-secondary/5 p-4">
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-secondary/10 blur-3xl" aria-hidden />
      <div className="absolute -bottom-32 -right-32 h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl" aria-hidden />

      <div className="relative z-10 w-full max-w-md">
        <Card className="border-border/50 bg-card/80 shadow-xl backdrop-blur-sm">
          <CardHeader className="space-y-3 pb-4 text-center">
            <div className="text-sm font-semibold uppercase tracking-[0.2em] text-secondary">
              {cs.prihlaseni.nazevAplikace}
            </div>
            <div className="space-y-1">
              <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          </CardHeader>
          <CardContent>{children}</CardContent>
        </Card>
        {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
      </div>
    </div>
  );
}

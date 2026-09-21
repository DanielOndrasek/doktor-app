import type { ReactNode } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

import { LOGIN_PATH } from "@/components/auth/MfaGate";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";
import { supabase } from "@/lib/supabase/client";

export const TODAY_PATH = "/";
export const MAIL_PATH = "/posta";
export const TASKS_PATH = "/ukoly";

const NAV: { to: string; label: string }[] = [
  { to: TODAY_PATH, label: cs.nav.dnes },
  { to: MAIL_PATH, label: cs.nav.posta },
  { to: TASKS_PATH, label: cs.nav.ukoly },
];

/**
 * Obal přihlášené části: horní lišta s navigací a odhlášením, pod ní obsah
 * přes celou výšku. Úkoly, Události, Kontakty a Nastavení se sem přidají,
 * až budou jejich obrazovky.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate(LOGIN_PATH, { replace: true });
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 flex-shrink-0 items-center gap-1 border-b border-border px-3">
        <span className="mr-3 text-sm font-semibold uppercase tracking-[0.2em] text-secondary">
          {cs.prihlaseni.nazevAplikace}
        </span>
        <nav className="flex items-center gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === TODAY_PATH}
              className={({ isActive }) =>
                cn(
                  "rounded-md px-3 py-1.5 text-sm transition-colors",
                  isActive
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <Button variant="ghost" size="sm" className="ml-auto text-muted-foreground" onClick={() => void signOut()}>
          <LogOut className="mr-1.5 h-4 w-4" />
          {cs.nav.odhlasit}
        </Button>
      </header>
      <div className="min-h-0 flex-1 overflow-auto">{children}</div>
    </div>
  );
}

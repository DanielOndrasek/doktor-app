import { useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { CalendarDays, CheckCircle, Home, LogOut, Mail, Menu, Moon, Settings, Stethoscope, Sun, Users, type LucideIcon } from "lucide-react";

import { LOGIN_PATH } from "@/components/auth/MfaGate";
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { cs } from "@/lib/i18n/cs";
import { supabase } from "@/lib/supabase/client";
import { applyTheme, readThemePreference, resolveTheme, writeThemePreference } from "@/lib/theme";

export const TODAY_PATH = "/";
export const MAIL_PATH = "/posta";
export const TASKS_PATH = "/ukoly";
export const EVENTS_PATH = "/udalosti";
export const CONTACTS_PATH = "/kontakty";
export const PATIENTS_PATH = "/pacienti";
export const SETTINGS_PATH = "/nastaveni";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

const NAV: NavItem[] = [
  { to: TODAY_PATH, label: cs.nav.dnes, icon: Home },
  { to: MAIL_PATH, label: cs.nav.posta, icon: Mail },
  { to: TASKS_PATH, label: cs.nav.ukoly, icon: CheckCircle },
  { to: EVENTS_PATH, label: cs.nav.udalosti, icon: CalendarDays },
  { to: CONTACTS_PATH, label: cs.nav.kontakty, icon: Users },
  { to: PATIENTS_PATH, label: cs.nav.pacienti, icon: Stethoscope },
];

const RAIL_BUTTON =
  "relative flex h-12 w-12 items-center justify-center rounded-lg outline-none transition-all duration-200 focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar md:h-10 md:w-10";

/**
 * Obal přihlášené části: úzká postranní lišta s ikonami vlevo (na mobilu
 * tlačítko vlevo dole a vysouvací panel), obsah vpravo přes celou výšku.
 *
 * Převzato z `components/AdminLayout.tsx` (vividbooks CRM, `831f9ae6`):
 * rail `w-14` v barvách `sidebar`, ikony 24 px s tooltipem, aktivní položka
 * s prosvětleným pozadím, patička s přepínačem motivu, mobilní FAB + Sheet.
 * Odstřižené: role a licence, banner trialu, webináře, PWA výzva, nepřečtené
 * u E-mailu (přijde s enginem), flyout „Nástroje", avatar `UserMenu`
 * (uživatel je jeden — místo něj tlačítko Odhlásit), `animate-glow-pulse`.
 * Značka je podpis „Suchánek" (`font-signature`), v railu jen iniciála.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">(() => resolveTheme(readThemePreference()));

  const isActive = (to: string) => (to === TODAY_PATH ? location.pathname === "/" : location.pathname.startsWith(to));

  const go = (to: string) => {
    navigate(to);
    setSheetOpen(false);
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    writeThemePreference(next);
    applyTheme(next);
    setTheme(next);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate(LOGIN_PATH, { replace: true });
  };

  const railButton = (label: string, onClick: () => void, Icon: LucideIcon, active = false) => (
    <Tooltip key={label}>
      <TooltipTrigger asChild>
        <button
          type="button"
          onClick={onClick}
          onMouseLeave={(e) => e.currentTarget.blur()}
          aria-label={label}
          aria-current={active ? "page" : undefined}
          className={cn(
            RAIL_BUTTON,
            active
              ? "bg-white/10 text-sidebar-primary backdrop-blur-sm"
              : "text-sidebar-foreground/70 hover:scale-105 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
          )}
        >
          <Icon className="h-6 w-6 [shape-rendering:geometricPrecision]" strokeWidth={active ? 1.75 : 1.5} />
        </button>
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );

  const sidebarContent = (
    <>
      {/* Značka: iniciála podpisu; celý podpis je na přihlášení. Klik = Dnes. */}
      <button
        type="button"
        onClick={() => go(TODAY_PATH)}
        title={cs.prihlaseni.nazevAplikace}
        aria-label={cs.prihlaseni.nazevAplikace}
        className="flex h-14 w-full items-center justify-center font-signature text-3xl font-bold leading-none text-sidebar-primary"
      >
        {cs.prihlaseni.nazevAplikace.charAt(0)}
      </button>

      <nav className="flex flex-1 flex-col items-center justify-center gap-1.5">
        {NAV.map((item) => railButton(item.label, () => go(item.to), item.icon, isActive(item.to)))}
      </nav>

      <div className="flex flex-col items-center gap-1.5 py-2">
        {railButton(cs.nav.nastaveni, () => go(SETTINGS_PATH), Settings, isActive(SETTINGS_PATH))}
        {railButton(cs.nav.prepnoutMotiv, toggleTheme, theme === "dark" ? Sun : Moon)}
        {railButton(cs.nav.odhlasit, () => void signOut(), LogOut)}
      </div>
    </>
  );

  return (
    <div className="flex h-screen w-full bg-background">
      <aside className="fixed inset-y-0 left-0 z-[45] hidden w-14 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground md:flex">
        {sidebarContent}
      </aside>

      {isMobile ? (
        <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              aria-label={cs.nav.otevritMenu}
              className="fixed bottom-4 left-4 z-[45] flex h-12 w-12 items-center justify-center rounded-full border border-transparent bg-sidebar text-sidebar-foreground shadow-lg ring-2 ring-background transition-transform hover:scale-105 dark:border-white/30 sm:bottom-5 md:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent
            side="left"
            className="flex w-20 flex-col border-r-0 bg-sidebar p-0 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] text-sidebar-foreground [&>button]:hidden"
          >
            <SheetTitle className="sr-only">{cs.nav.navigace}</SheetTitle>
            {sidebarContent}
          </SheetContent>
        </Sheet>
      ) : null}

      <div className="h-screen min-w-0 flex-1 overflow-auto pt-[env(safe-area-inset-top)] md:ml-14">{children}</div>
    </div>
  );
}

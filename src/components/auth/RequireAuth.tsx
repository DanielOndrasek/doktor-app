import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { supabase } from "@/lib/supabase/client";
import MfaGate, { LOGIN_PATH } from "./MfaGate";

/**
 * Strážce chráněných rout: bez session přesměruje na přihlášení, se session
 * vynutí MFA (`MfaGate`) a teprve pak pustí obsah. Reaguje i na odhlášení
 * v jiné kartě (`onAuthStateChange`).
 *
 * Převzato z `components/SysAdminGuard.tsx` (vividbooks CRM, `831f9ae6`)
 * bez kontroly `profiles.is_sysadmin` — role jsou v `crm`, Doktor má jednoho
 * uživatele a skutečná ochrana je RLS (viz „Čeho se vyvarovat" v CLAUDE.md).
 */
export default function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [state, setState] = useState<"checking" | "in" | "out">("checking");

  useEffect(() => {
    let cancelled = false;
    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (!cancelled) setState(session ? "in" : "out");
    });
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) setState(session ? "in" : "out");
    });
    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  if (state === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (state === "out") {
    return <Navigate to={LOGIN_PATH} replace state={{ from: location.pathname }} />;
  }

  return <MfaGate>{children}</MfaGate>;
}

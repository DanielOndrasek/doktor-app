import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, CheckCircle, Loader2 } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import { supabase } from "@/lib/supabase/client";
import { getSupabaseEnv } from "@/lib/supabase/env";
import {
  isNetworkFetchError,
  LOGIN_ASYNC_TIMEOUT_MESSAGE,
  NETWORK_ERROR_MESSAGE,
  SUPABASE_SIGNIN_TIMEOUT_MS,
  withAsyncTimeout,
} from "@/lib/supabase/timeouts";

export const RESET_PASSWORD_PATH = "/reset-hesla";

/**
 * Přihlášení e-mailem a heslem, s odkazem na obnovu hesla. Po přihlášení
 * pustí dál `RequireAuth`, který vynutí MFA.
 *
 * Převzato z `pages/AdminAuth.tsx` a `pages/ClientAuth.tsx` (vividbooks CRM,
 * `831f9ae6`) — CRM mělo čtyři přihlašovací stránky podle role
 * (makléř, klient, sysadmin, whitelabel). Zůstal formulář, kontrola
 * konfigurace, časový limit a překlad chyb GoTrue. Nepřebráno: role
 * a přesměrování podle nich (`fetchEffectiveAppRoles`, `rolesIncludeCrmStaff`,
 * `resolveClientEntry`), `must_change_password` z `profiles`, znělka
 * po přihlášení, přepínač jazyka, whitelabel. Obnova hesla jde přes
 * `supabase.auth.resetPasswordForEmail`, ne přes edge funkci
 * `send-password-reset-email` (ta posílala přes Resend a logovala do `crm`).
 */
export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  const [mode, setMode] = useState<"login" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  // Dokud nedoběhne první `getSession()`, nevíme, jestli má být uživatel hned
  // přesměrován. Bez toho formulář krátce problikne.
  const [checkingSession, setCheckingSession] = useState(true);

  const from = (location.state as { from?: string } | null)?.from ?? "/";

  useEffect(() => {
    let cancelled = false;
    void supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (cancelled) return;
        if (session) navigate(from, { replace: true });
        else setCheckingSession(false);
      })
      .catch((err: unknown) => {
        // Neshazujeme stránku — uživatel se může pokusit přihlásit.
        console.warn("Login: getSession selhal", err);
        if (!cancelled) setCheckingSession(false);
      });
    return () => {
      cancelled = true;
    };
  }, [navigate, from]);

  const configured = () => {
    if (getSupabaseEnv().isConfigured) return true;
    toast({
      title: cs.prihlaseni.chybiKonfiguraceTitulek,
      description: cs.prihlaseni.chybiKonfigurace,
      variant: "destructive",
    });
    return false;
  };

  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    if (!configured()) return;
    setIsLoading(true);
    try {
      const { data, error } = await withAsyncTimeout(
        supabase.auth.signInWithPassword({ email, password }),
        SUPABASE_SIGNIN_TIMEOUT_MS,
        LOGIN_ASYNC_TIMEOUT_MESSAGE,
      );
      if (error) {
        let message: string = cs.prihlaseni.neocekavanaChyba;
        if (error.message.includes("Invalid login credentials")) message = cs.prihlaseni.spatneUdaje;
        else if (error.message.includes("Email not confirmed")) message = cs.prihlaseni.emailNepotvrzen;
        toast({ title: cs.prihlaseni.prihlaseniSelhalo, description: message, variant: "destructive" });
        return;
      }
      if (!data.user) {
        // Nikdy nelogovat celou odpověď — obsahuje tokeny session.
        console.error("Login: signIn bez uživatele", { hasSession: !!data.session });
        toast({ title: cs.prihlaseni.prihlaseniSelhalo, description: cs.prihlaseni.neocekavanaChyba, variant: "destructive" });
        return;
      }
      navigate(from, { replace: true });
    } catch (err) {
      console.error("Login: výjimka při přihlášení", err);
      const isTimeout = err instanceof Error && err.message === LOGIN_ASYNC_TIMEOUT_MESSAGE;
      const description = isTimeout
        ? LOGIN_ASYNC_TIMEOUT_MESSAGE
        : isNetworkFetchError(err)
          ? NETWORK_ERROR_MESSAGE
          : cs.prihlaseni.neocekavanaChyba;
      toast({ title: cs.prihlaseni.prihlaseniSelhalo, description, variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: FormEvent) => {
    e.preventDefault();
    if (!configured()) return;
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}${RESET_PASSWORD_PATH}`,
      });
      if (error) {
        toast({ title: cs.prihlaseni.odkazNeodeslan, description: error.message, variant: "destructive" });
        return;
      }
      setForgotSent(true);
    } finally {
      setIsLoading(false);
    }
  };

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const backToLogin = (
    <button
      type="button"
      className="flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      onClick={() => {
        setMode("login");
        setForgotSent(false);
      }}
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      {cs.prihlaseni.zpetNaPrihlaseni}
    </button>
  );

  if (mode === "forgot") {
    return (
      <AuthShell title={cs.prihlaseni.obnovaTitulek} subtitle={cs.prihlaseni.obnovaPodtitulek}>
        {forgotSent ? (
          <div className="space-y-4">
            <div className="flex items-start gap-3 rounded-lg border border-border bg-muted p-4">
              <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-secondary" />
              <div>
                <p className="text-sm font-medium text-foreground">{cs.prihlaseni.odkazOdeslan}</p>
                <p className="mt-0.5 text-sm text-muted-foreground">{cs.prihlaseni.odkazOdeslanPopis}</p>
              </div>
            </div>
            {backToLogin}
          </div>
        ) : (
          <form onSubmit={handleForgotPassword} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="forgot-email">{cs.prihlaseni.email}</Label>
              <Input
                id="forgot-email"
                type="email"
                autoComplete="email"
                placeholder={cs.prihlaseni.emailPlaceholder}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
              />
            </div>
            <Button type="submit" variant="secondary" className="w-full font-medium" disabled={isLoading}>
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {cs.prihlaseni.odesilam}
                </>
              ) : (
                cs.prihlaseni.odeslatOdkaz
              )}
            </Button>
            {backToLogin}
          </form>
        )}
      </AuthShell>
    );
  }

  return (
    <AuthShell title={cs.prihlaseni.titulek} subtitle={cs.prihlaseni.podtitulek}>
      <form onSubmit={handleLogin} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="email">{cs.prihlaseni.email}</Label>
          <Input
            id="email"
            type="email"
            autoComplete="email"
            placeholder={cs.prihlaseni.emailPlaceholder}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">{cs.prihlaseni.heslo}</Label>
            <button
              type="button"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground hover:underline"
              onClick={() => setMode("forgot")}
            >
              {cs.prihlaseni.zapomenuteHeslo}
            </button>
          </div>
          <Input
            id="password"
            type="password"
            autoComplete="current-password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>
        <Button type="submit" variant="secondary" className="w-full font-medium" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {cs.prihlaseni.prihlasuji}
            </>
          ) : (
            cs.prihlaseni.prihlasit
          )}
        </Button>
      </form>
    </AuthShell>
  );
}

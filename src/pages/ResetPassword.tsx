import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";

import { AuthShell } from "@/components/auth/AuthShell";
import { LOGIN_PATH } from "@/components/auth/MfaGate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import { supabase } from "@/lib/supabase/client";
import { MIN_PASSWORD_LENGTH, PASSWORD_TOO_SHORT_MESSAGE } from "@/lib/supabase/passwordPolicy";

/**
 * Nastavení nového hesla z odkazu v e-mailu.
 *
 * Převzato z `pages/ResetPassword.tsx` (vividbooks CRM, `831f9ae6`) včetně
 * obou variant recovery flow (PKCE `?code=` i implicit `#access_token`).
 * Nepřebráno: nulování `profiles.must_change_password` (schéma `crm`),
 * aurora, logo, odkazy na obchodní podmínky.
 */
export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;

    /* Supabase recovery flow má dvě varianty podle nastavení projektu:
     *
     *  1) Implicit (legacy) — odkaz v e-mailu má `#access_token=...&type=recovery`
     *     v hash fragmentu. Klient si ho při init parsne sám a vyvolá
     *     `PASSWORD_RECOVERY` přes `onAuthStateChange`.
     *
     *  2) PKCE (výchozí v supabase-js v2.40+) — odkaz má `?code=...` v query
     *     stringu. Klient ho automaticky NEparsuje — musíme zavolat
     *     `exchangeCodeForSession(code)` ručně. Bez toho session nevznikne
     *     a PASSWORD_RECOVERY nikdy nepřijde.
     *
     * Dodatečná pojistka: pokud getSession() vrátí session (např.
     * onAuthStateChange už proběhl před připojením listeneru, nebo uživatel
     * přišel s aktivní session z jiné karty), bereme to taky jako
     * „připraveno nastavit nové heslo". */
    const init = async () => {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (cancelled) return;
          if (error) {
            console.warn("[ResetPassword] exchangeCodeForSession selhal:", error);
            // Nevracíme se hned — možná je platná stará hash session.
          } else {
            // Uklidíme `?code=` z URL, aby F5 nezpůsobil opakovanou výměnu
            // (token už byl spotřebovaný a vrátil by 400).
            url.searchParams.delete("code");
            window.history.replaceState({}, "", url.toString());
            setIsRecovery(true);
            setIsChecking(false);
            return;
          }
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (cancelled) return;
        if (session) {
          setIsRecovery(true);
          setIsChecking(false);
        }
      } catch (e) {
        console.warn("[ResetPassword] init selhal:", e);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (event === "SIGNED_IN" && session)) {
        setIsRecovery(true);
        setIsChecking(false);
      }
    });

    void init();

    /* Bezpečnostní pojistka — kdyby init zatuhl na síti, nikdy bychom
     * neopustili „Ověřování odkazu…". 5 s je víc než dost. */
    const timer = setTimeout(() => {
      if (!cancelled) setIsChecking(false);
    }, 5000);

    return () => {
      cancelled = true;
      subscription.unsubscribe();
      clearTimeout(timer);
    };
  }, []);

  const handleReset = async (e: FormEvent) => {
    e.preventDefault();

    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      toast({ title: cs.prihlaseni.hesloKratkeTitulek, description: PASSWORD_TOO_SHORT_MESSAGE, variant: "destructive" });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: cs.prihlaseni.heslaSeNeshoduji, description: cs.prihlaseni.heslaSeNeshodujiPopis, variant: "destructive" });
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) {
        toast({ title: cs.prihlaseni.hesloNezmeneno, variant: "destructive" });
        return;
      }
      toast({ title: cs.prihlaseni.hesloZmeneno, description: cs.prihlaseni.hesloZmenenoPopis });
      navigate("/", { replace: true });
    } finally {
      setIsLoading(false);
    }
  };

  if (isChecking) {
    return (
      <AuthShell title={cs.prihlaseni.noveHesloTitulek}>
        <div className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">{cs.prihlaseni.overujiOdkaz}</p>
        </div>
      </AuthShell>
    );
  }

  if (!isRecovery) {
    return (
      <AuthShell title={cs.prihlaseni.neplatnyOdkaz} subtitle={cs.prihlaseni.neplatnyOdkazPopis}>
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
            <p className="text-sm text-destructive">{cs.prihlaseni.neplatnyOdkazRada}</p>
          </div>
          <Button variant="secondary" className="w-full" onClick={() => navigate(LOGIN_PATH)}>
            {cs.prihlaseni.zpetNaPrihlaseni}
          </Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title={cs.prihlaseni.noveHesloTitulek} subtitle={cs.prihlaseni.noveHesloPodtitulek}>
      <form onSubmit={handleReset} className="space-y-5">
        <div className="space-y-2">
          <Label htmlFor="new-password">{cs.prihlaseni.noveHeslo}</Label>
          <Input
            id="new-password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
            autoFocus
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm-password">{cs.prihlaseni.potvrditHeslo}</Label>
          <Input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={MIN_PASSWORD_LENGTH}
          />
        </div>
        <Button type="submit" variant="secondary" className="w-full font-medium" disabled={isLoading}>
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {cs.prihlaseni.ukladam}
            </>
          ) : (
            cs.prihlaseni.nastavitHeslo
          )}
        </Button>
      </form>
    </AuthShell>
  );
}

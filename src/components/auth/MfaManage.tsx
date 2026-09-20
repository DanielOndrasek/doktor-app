import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cs } from "@/lib/i18n/cs";
import {
  enrollTotp,
  loadMfaStatus,
  removeUnverifiedTotpFactors,
  unenrollTotp,
  verifyTotp,
  type MfaStatus,
  type TotpEnrollment,
} from "@/lib/supabase/mfa";

interface MfaManageProps {
  /** Popisek faktoru (uloží se do účtu). */
  friendlyName?: string;
  /**
   * `true` tam, kde je MFA povinné — skryje možnost zrušení a zvýrazní,
   * že bez faktoru není přístup. V Doktorovi je povinné všude (plán, oddíl 9).
   */
  required?: boolean;
  /** Zavolá se po úspěšném ověření prvního faktoru (session → aal2). */
  onEnrolled?: () => void;
}

const CODE_LENGTH = 6;

/**
 * Správa TOTP faktoru pro aktuálního uživatele: stav, založení (QR + ověření)
 * a (u nepovinného režimu) zrušení. Sdílené mezi nastavením a branou MFA.
 *
 * Převzato z `components/mfa/MfaManage.tsx` (vividbooks CRM, `831f9ae6`);
 * `sonner` → `useToast`, texty přes `src/lib/i18n/cs.ts`, barvy ikon z tokenů.
 */
export default function MfaManage({
  friendlyName = cs.prihlaseni.mfa.nazevFaktoru,
  required = false,
  onEnrolled,
}: MfaManageProps) {
  const { toast } = useToast();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [enrollment, setEnrollment] = useState<TotpEnrollment | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setLoadError(false);
      setStatus(await loadMfaStatus());
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const startEnrollment = async () => {
    setBusy(true);
    setVerifyError(null);
    try {
      setEnrollment(await enrollTotp(friendlyName));
    } catch (err) {
      // Supabase auth chyby mají bezpečné, akční `message` (např. „MFA enroll
      // is disabled for TOTP") — bez něj je závada nediagnostikovatelná.
      const detail = err instanceof Error && err.message ? err.message : undefined;
      toast({ title: cs.prihlaseni.mfa.zahajeniSelhalo, description: detail, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  const cancelEnrollment = async () => {
    setBusy(true);
    try {
      await removeUnverifiedTotpFactors();
    } catch {
      // Neblokující — neověřený faktor uklidí i příští založení.
    } finally {
      setEnrollment(null);
      setCode("");
      setVerifyError(null);
      setBusy(false);
    }
  };

  const confirmEnrollment = async (e: FormEvent) => {
    e.preventDefault();
    if (!enrollment || code.length !== CODE_LENGTH) return;
    setBusy(true);
    setVerifyError(null);
    try {
      await verifyTotp(enrollment.factorId, code);
      setEnrollment(null);
      setCode("");
      await refresh();
      toast({ title: cs.prihlaseni.mfa.aktivniToast });
      onEnrolled?.();
    } catch {
      setVerifyError(cs.prihlaseni.mfa.kodNeoverenCas);
      setCode("");
    } finally {
      setBusy(false);
    }
  };

  const disable = async () => {
    if (!status?.verifiedFactorId) return;
    setBusy(true);
    try {
      await unenrollTotp(status.verifiedFactorId);
      await refresh();
      toast({ title: cs.prihlaseni.mfa.vypnutoToast });
    } catch {
      toast({ title: cs.prihlaseni.mfa.vypnoutSelhalo, variant: "destructive" });
    } finally {
      setBusy(false);
    }
  };

  if (status === null && !loadError) {
    return (
      <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {cs.prihlaseni.mfa.nacitaniStavu}
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="space-y-3">
        <p className="text-sm text-destructive">{cs.prihlaseni.mfa.stavNenacten}</p>
        <Button variant="outline" size="sm" onClick={() => void refresh()}>
          {cs.prihlaseni.mfa.zkusitZnovu}
        </Button>
      </div>
    );
  }

  // Probíhá založení faktoru (QR + ověření).
  if (enrollment) {
    return (
      <form onSubmit={confirmEnrollment} className="space-y-4">
        <p className="text-sm text-muted-foreground">{cs.prihlaseni.mfa.naskenujte}</p>
        <div className="flex flex-col items-start gap-4 sm:flex-row">
          <img
            src={enrollment.qrCode}
            alt={cs.prihlaseni.mfa.qrAlt}
            className="h-40 w-40 rounded-lg border border-border bg-white p-2"
          />
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">{cs.prihlaseni.mfa.neboRucne}</Label>
            <code className="block break-all rounded bg-muted px-2 py-1 text-xs">{enrollment.secret}</code>
          </div>
        </div>
        <div className="max-w-xs space-y-1.5">
          <Label htmlFor="mfa-enroll-code">{cs.prihlaseni.mfa.kod}</Label>
          <Input
            id="mfa-enroll-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={CODE_LENGTH}
            placeholder={cs.prihlaseni.mfa.kodPlaceholder}
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
            aria-invalid={verifyError != null}
          />
          {verifyError && (
            <p className="text-sm text-destructive" role="alert">
              {verifyError}
            </p>
          )}
        </div>
        <div className="flex gap-2">
          <Button type="submit" disabled={busy || code.length !== CODE_LENGTH}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {cs.prihlaseni.mfa.aktivovat}
          </Button>
          <Button type="button" variant="ghost" onClick={() => void cancelEnrollment()} disabled={busy}>
            {cs.prihlaseni.mfa.zrusit}
          </Button>
        </div>
      </form>
    );
  }

  // Faktor aktivní.
  if (status?.hasVerifiedTotp) {
    return (
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-success" />
          <span className="text-sm font-medium">{cs.prihlaseni.mfa.aktivni}</span>
          <Badge variant="secondary">TOTP</Badge>
        </div>
        {!required && (
          <Button variant="outline" size="sm" onClick={() => void disable()} disabled={busy}>
            {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {cs.prihlaseni.mfa.vypnout}
          </Button>
        )}
        {required && <p className="text-xs text-muted-foreground">{cs.prihlaseni.mfa.povinne}</p>}
      </div>
    );
  }

  // Bez faktoru.
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <ShieldAlert className={required ? "h-5 w-5 text-warning" : "h-5 w-5 text-muted-foreground"} />
        <span className="text-sm">{required ? cs.prihlaseni.mfa.nutnoZapnout : cs.prihlaseni.mfa.neniZapnute}</span>
      </div>
      <Button
        onClick={() => void startEnrollment()}
        disabled={busy}
        variant={required ? "default" : "outline"}
        size="sm"
      >
        {busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
        {cs.prihlaseni.mfa.zapnout}
      </Button>
    </div>
  );
}

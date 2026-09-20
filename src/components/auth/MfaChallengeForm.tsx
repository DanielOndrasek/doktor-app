import { useState } from "react";
import type { FormEvent } from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cs } from "@/lib/i18n/cs";
import { verifyTotp } from "@/lib/supabase/mfa";

interface MfaChallengeFormProps {
  factorId: string;
  /** Zavolá se po úspěšném ověření (session je povýšena na aal2). */
  onVerified: () => void;
  /** Volitelné zrušení (např. odhlášení a návrat na přihlášení). */
  onCancel?: () => void;
}

const CODE_LENGTH = 6;

/**
 * Ověření existujícího TOTP faktoru — 6místný kód z autentifikátoru.
 * Převzato z `components/mfa/MfaChallengeForm.tsx` (vividbooks CRM,
 * `831f9ae6`); texty přes `src/lib/i18n/cs.ts`.
 */
export default function MfaChallengeForm({ factorId, onVerified, onCancel }: MfaChallengeFormProps) {
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) return;
    setVerifying(true);
    setError(null);
    try {
      await verifyTotp(factorId, code);
      onVerified();
    } catch {
      setError(cs.prihlaseni.mfa.kodNeoveren);
      setCode("");
    } finally {
      setVerifying(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <div className="space-y-1.5">
        <Label htmlFor="mfa-code">{cs.prihlaseni.mfa.kod}</Label>
        <Input
          id="mfa-code"
          inputMode="numeric"
          autoComplete="one-time-code"
          autoFocus
          maxLength={CODE_LENGTH}
          placeholder={cs.prihlaseni.mfa.kodPlaceholder}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
          aria-invalid={error != null}
          aria-describedby={error ? "mfa-code-error" : undefined}
        />
        <p className="text-xs text-muted-foreground">{cs.prihlaseni.mfa.kodNapoveda}</p>
        {error && (
          <p id="mfa-code-error" className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={verifying || code.length !== CODE_LENGTH} className="flex-1">
          {verifying ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          {cs.prihlaseni.mfa.overit}
        </Button>
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel} disabled={verifying}>
            {cs.prihlaseni.mfa.zrusit}
          </Button>
        )}
      </div>
    </form>
  );
}

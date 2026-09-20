import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

import { cs } from "@/lib/i18n/cs";
import { supabase } from "@/lib/supabase/client";
import { loadMfaStatus, needsMfaChallenge, type MfaStatus } from "@/lib/supabase/mfa";
import { AuthShell } from "./AuthShell";
import MfaChallengeForm from "./MfaChallengeForm";
import MfaManage from "./MfaManage";

export const LOGIN_PATH = "/prihlaseni";

/**
 * Vynucení MFA pro celou aplikaci. Sedí uvnitř `RequireAuth` (po ověření
 * session):
 *  - session bez aal2, ale s ověřeným faktorem → ověření kódem,
 *  - žádný faktor → povinné založení (MFA je v Doktorovi povinné, plán oddíl 9),
 *  - aal2 → propustí dál.
 *
 * Převzato z `components/mfa/SysAdminMfaGate.tsx` (vividbooks CRM,
 * `831f9ae6`). Tam to platilo jen pro sysadmin panel a mělo vlastní tmavý
 * obal v zinc barvách; tady jde přes `AuthShell` a tokeny.
 */
export default function MfaGate({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<MfaStatus | null>(null);
  const [error, setError] = useState(false);

  const refresh = useCallback(async () => {
    try {
      setError(false);
      setStatus(await loadMfaStatus());
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate(LOGIN_PATH, { replace: true });
  };

  if (status === null && !error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <AuthShell title={cs.prihlaseni.mfa.titulek}>
        <div className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground">{cs.prihlaseni.mfa.zabezpeceniNeovereno}</p>
          <button type="button" onClick={() => void refresh()} className="text-sm underline hover:text-foreground">
            {cs.prihlaseni.mfa.zkusitZnovu}
          </button>
        </div>
      </AuthShell>
    );
  }

  const s = status as MfaStatus;

  if (s.currentLevel === "aal2") {
    return <>{children}</>;
  }

  const signOutLink = (
    <button type="button" onClick={() => void signOut()} className="hover:text-foreground hover:underline">
      {cs.prihlaseni.odhlasit}
    </button>
  );

  if (needsMfaChallenge(s) && s.verifiedFactorId) {
    return (
      <AuthShell title={cs.prihlaseni.mfa.titulek} subtitle={cs.prihlaseni.mfa.podtitulek} footer={signOutLink}>
        <MfaChallengeForm factorId={s.verifiedFactorId} onVerified={() => void refresh()} onCancel={() => void signOut()} />
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={cs.prihlaseni.mfa.nastavitTitulek}
      subtitle={cs.prihlaseni.mfa.nastavitPodtitulek}
      footer={signOutLink}
    >
      <MfaManage required onEnrolled={() => void refresh()} />
    </AuthShell>
  );
}

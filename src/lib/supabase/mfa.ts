import { supabase } from "@/lib/supabase/client";

/**
 * Tenká typovaná vrstva nad `supabase.auth.mfa.*` (TOTP). Drží na jednom místě
 * kontrolu chyb (`{ data, error }`) a odvození stavu MFA, aby komponenty
 * (nastavení, brána MFA, ověření při přihlášení) nesahaly na auth klienta přímo.
 *
 * Převzato z `crm/src/lib/mfa.ts` (vividbooks CRM, `831f9ae6`) beze změny
 * chování — jen cesta ke klientovi.
 */

export type AalLevel = "aal1" | "aal2";

export interface MfaStatus {
  /** Uživatel má aspoň jeden ověřený TOTP faktor. */
  hasVerifiedTotp: boolean;
  /** Úroveň zabezpečení aktuální session. */
  currentLevel: AalLevel | null;
  /** Nejvyšší úroveň, kterou uživatel se svými faktory může dosáhnout. */
  nextLevel: AalLevel | null;
  /** ID prvního ověřeného TOTP faktoru (pro challenge / unenroll). */
  verifiedFactorId: string | null;
}

function asAal(level: string | null | undefined): AalLevel | null {
  return level === "aal1" || level === "aal2" ? level : null;
}

/** Načte stav MFA: ověřené faktory + úroveň zabezpečení session. */
export async function loadMfaStatus(): Promise<MfaStatus> {
  const [aalRes, factorsRes] = await Promise.all([
    supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    supabase.auth.mfa.listFactors(),
  ]);
  if (aalRes.error) throw aalRes.error;
  if (factorsRes.error) throw factorsRes.error;

  const verified = factorsRes.data.all.find(
    (f) => f.factor_type === "totp" && f.status === "verified",
  );

  return {
    hasVerifiedTotp: Boolean(verified),
    currentLevel: asAal(aalRes.data.currentLevel),
    nextLevel: asAal(aalRes.data.nextLevel),
    verifiedFactorId: verified?.id ?? null,
  };
}

/**
 * Session je jen `aal1`, ale uživatel má ověřený faktor (`nextLevel === aal2`)
 * — tedy musí projít TOTP challenge, aby dostal `aal2`.
 */
export function needsMfaChallenge(status: MfaStatus): boolean {
  return status.hasVerifiedTotp && status.currentLevel === "aal1";
}

export interface TotpEnrollment {
  factorId: string;
  /** SVG QR kód jako data URI — přímo do `<img src>`. */
  qrCode: string;
  /** Textové tajemství pro ruční zadání do autentifikátoru. */
  secret: string;
}

/**
 * Odebere rozpracované (neověřené) TOTP faktory. `enroll` by jinak u druhého
 * pokusu selhal na duplicitě a v účtu by se hromadily mrtvé faktory.
 */
export async function removeUnverifiedTotpFactors(): Promise<void> {
  const { data, error } = await supabase.auth.mfa.listFactors();
  if (error) throw error;
  const stale = data.all.filter(
    (f) => f.factor_type === "totp" && f.status === "unverified",
  );
  for (const f of stale) {
    const { error: unErr } = await supabase.auth.mfa.unenroll({ factorId: f.id });
    if (unErr) throw unErr;
  }
}

/** Založí nový (neověřený) TOTP faktor a vrátí QR kód + tajemství. */
export async function enrollTotp(friendlyName: string): Promise<TotpEnrollment> {
  await removeUnverifiedTotpFactors();
  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName,
  });
  if (error) throw error;
  return { factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret };
}

/**
 * Ověří kód z autentifikátoru. Po úspěchu se session povýší na `aal2`.
 * Používá se jak pro dokončení enrollmentu, tak pro login challenge.
 */
export async function verifyTotp(factorId: string, code: string): Promise<void> {
  const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId, code });
  if (error) throw error;
}

/** Zruší (ověřený i neověřený) TOTP faktor. */
export async function unenrollTotp(factorId: string): Promise<void> {
  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) throw error;
}

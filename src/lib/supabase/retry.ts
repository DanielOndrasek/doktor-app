/**
 * Opakování čtení při přechodné chybě tokenu.
 *
 * Po obnově session (`/auth/v1/token?grant_type=refresh_token`) vydá Auth nový
 * JWT s `iat` podle svých hodin. Když jsou hodiny PostgREST o pár sekund pozadu,
 * první dotaz s novým tokenem skončí `401 JWT issued at future` (viděno 28. 9.
 * 2026: obnova 14:02:55, odmítnutí 14:03:10). Za chvíli se to srovná — stránky
 * přes TanStack Query dotaz zopakují samy, ruční `source.load()` na Dnes,
 * v Úkolech a Událostech ne. Tohle je pro ně: jen u chyb, které vypadají na
 * posun hodin, a jen pár pokusů. Ostatní chyby (RLS, síť, 500) jdou dál hned.
 */

const JWT_SKEW_PATTERNS = [/jwt issued at future/i, /jwt expired/i, /jwt.*not yet valid/i];

export const JWT_RETRY_DELAYS_MS = [1_500, 4_000, 8_000];

export function isJwtClockSkewError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  return JWT_SKEW_PATTERNS.some((re) => re.test(message));
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Zavolá `fn`; při chybě posunu hodin počká a zkusí znovu (`delays` udává
 * počet a rozestupy pokusů). Poslední chyba se vrací beze změny.
 */
export async function withJwtRetry<T>(fn: () => Promise<T>, delays: readonly number[] = JWT_RETRY_DELAYS_MS): Promise<T> {
  let attempt = 0;
  for (;;) {
    try {
      return await fn();
    } catch (err) {
      if (!isJwtClockSkewError(err) || attempt >= delays.length) throw err;
      await sleep(delays[attempt]);
      attempt += 1;
    }
  }
}

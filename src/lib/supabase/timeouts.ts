import { cs } from "@/lib/i18n/cs";

/**
 * Převzato z `crm/src/lib/withAsyncTimeout.ts` a `networkErrors.ts`
 * (vividbooks CRM, `831f9ae6`). Anglická varianta hlášky se nepřebrala —
 * UI Doktora je česky.
 */

/** Max. čekání na GoTrue (auth) — často visí při špatném URL / síti / blokaci. */
export const SUPABASE_SIGNIN_TIMEOUT_MS = 32_000;

export const LOGIN_ASYNC_TIMEOUT_MESSAGE = cs.prihlaseni.vyprselCas;

/**
 * Zahodí visící Promise po `ms` a vrátí odmítnutí s `timeoutMessage`.
 * Použití u přihlášení, aby kolečko na tlačítku neměřilo minuty.
 */
export async function withAsyncTimeout<T>(promise: Promise<T>, ms: number, timeoutMessage: string): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error(timeoutMessage)), ms);
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

/**
 * Detekce selhání síťového požadavku (typicky `TypeError: Failed to fetch`).
 *
 * V prohlížeči se `fetch` zamítne s `TypeError` ve třech hlavních případech:
 *   1) CORS — odpověď nemá `Access-Control-Allow-Origin` hlavičku,
 *   2) síť — DNS/firewall/VPN/proxy požadavek vůbec nepustí k cíli,
 *   3) rozšíření prohlížeče (ad-blocker, privacy) blokuje doménu Supabase.
 *
 * Uživatel by jinak viděl „Failed to fetch", což mu nic neřekne.
 */
export function isNetworkFetchError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error) {
    const msg = err.message?.toLowerCase() ?? "";
    return (
      msg.includes("failed to fetch") ||
      msg.includes("networkerror") ||
      msg.includes("load failed") ||
      msg.includes("network request failed")
    );
  }
  return false;
}

export const NETWORK_ERROR_MESSAGE = cs.prihlaseni.chybaSite;

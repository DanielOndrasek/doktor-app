import { useEffect, useRef } from "react";

/** Po návratu do okna nejdřív po této době od posledního obnovení (ms). */
const MIN_GAP = 15_000;

/**
 * Tiché obnovení dat obrazovky, která zůstává otevřená celý den (Dnes, Úkoly,
 * Události). Běhy třídění zapisují v 7, 13 a 17 h — bez obnovení by se nové
 * položky ukázaly až po přepnutí obrazovky.
 *
 * Volá `refresh` při návratu do okna (focus, viditelnost) a každých `interval` ms,
 * dokud je okno vidět. Skrytý panel prohlížeče se neobnovuje.
 * `enabled=false` obnovování pozastaví (např. při otevřeném dialogu).
 */
export function useAutoRefresh(refresh: () => void, { interval = 120_000, enabled = true } = {}): void {
  const refreshRef = useRef(refresh);
  const lastRef = useRef(Date.now());

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled) return;
    const run = (force: boolean) => {
      if (document.visibilityState !== "visible") return;
      if (!force && Date.now() - lastRef.current < MIN_GAP) return;
      lastRef.current = Date.now();
      refreshRef.current();
    };
    const onReturn = () => run(false);
    const tick = window.setInterval(() => run(true), interval);
    window.addEventListener("focus", onReturn);
    document.addEventListener("visibilitychange", onReturn);
    return () => {
      window.clearInterval(tick);
      window.removeEventListener("focus", onReturn);
      document.removeEventListener("visibilitychange", onReturn);
    };
  }, [enabled, interval]);
}

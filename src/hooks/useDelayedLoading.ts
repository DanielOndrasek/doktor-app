import { useEffect, useRef, useState } from "react";

interface Options {
  /**
   * Doba v ms, po kterou se loading state ignoruje. Pokud data dorazí dříve,
   * uživatel skeleton vůbec neuvidí — eliminuje "flash" při rychlých requestech.
   */
  delay?: number;
  /**
   * Pokud už se skeleton zobrazil, drží se minimálně tuhle dobu (ms), aby
   * nezmizel za 30 ms a nepůsobil jako bug. Měří se od momentu, kdy se
   * skutečně objevil (po `delay`), ne od startu loadingu.
   */
  minShow?: number;
}

/**
 * Vrací `true` pouze tehdy, kdy má smysl ukázat skeleton/loading indikátor.
 *
 * Logika:
 *   1. `loading=true` → spustí se timer na `delay` ms. Když mezitím loading
 *      skončí, hook nevrátí `true` ani jednou (eliminuje flash při <200 ms requestech).
 *   2. `loading=true` → po `delay` ms vrátí `true` a zapamatuje si čas.
 *   3. `loading=false` → pokud byl skeleton zobrazen méně než `minShow`,
 *      drží `true` ještě zbylý čas (žádný "blesk").
 *
 * Default 200 / 400 ms odpovídá NN/g doporučení: pod 100 ms = okamžité,
 * 100–300 ms = bez indikátoru, 300+ ms = potřeba zpětné vazby.
 */
export function useDelayedLoading(loading: boolean, options: Options = {}): boolean {
  const { delay = 200, minShow = 400 } = options;
  const [visible, setVisible] = useState(false);
  const shownAtRef = useRef<number | null>(null);

  useEffect(() => {
    let showTimer: number | undefined;
    let hideTimer: number | undefined;

    if (loading) {
      if (!visible && shownAtRef.current === null) {
        showTimer = window.setTimeout(() => {
          shownAtRef.current = performance.now();
          setVisible(true);
        }, delay);
      }
    } else if (visible && shownAtRef.current !== null) {
      const elapsed = performance.now() - shownAtRef.current;
      const remaining = Math.max(0, minShow - elapsed);
      hideTimer = window.setTimeout(() => {
        setVisible(false);
        shownAtRef.current = null;
      }, remaining);
    } else if (!loading && !visible) {
      shownAtRef.current = null;
    }

    return () => {
      if (showTimer !== undefined) window.clearTimeout(showTimer);
      if (hideTimer !== undefined) window.clearTimeout(hideTimer);
    };
  }, [loading, delay, minShow, visible]);

  return visible;
}

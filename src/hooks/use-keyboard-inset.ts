import { useEffect, useState } from "react";

/**
 * Sleduje, jak velkou část spodku obrazovky překrývá softwarová klávesnice
 * (na mobilech / tabletech) přes `window.visualViewport`.
 *
 * Vrací:
 *  - `keyboardInset` — výška překryté oblasti v px (0 = klávesnice zavřená),
 *  - `viewportHeight` — aktuálně viditelná výška (visual viewport),
 *  - `offsetTop` — posun horního okraje viditelné oblasti (iOS při fokusu
 *    inputu posouvá stránku; podle toho lze plovoucí prvek dorovnat).
 *
 * Použití: plovoucí prvky kotvené `position: fixed` k dolnímu okraji (chat
 * panely, sticky inputy) se jinak schovají za klávesnici a uživatel nevidí,
 * co píše. Posunutím o `keyboardInset` zůstane vstup nad klávesnicí.
 */
export function useKeyboardInset() {
  const [state, setState] = useState<{ keyboardInset: number; viewportHeight: number; offsetTop: number }>(() => ({
    keyboardInset: 0,
    viewportHeight: typeof window !== "undefined" ? window.innerHeight : 0,
    offsetTop: 0,
  }));

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const update = () => {
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setState({
        keyboardInset: Math.round(inset),
        viewportHeight: Math.round(vv.height),
        offsetTop: Math.round(vv.offsetTop),
      });
    };

    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  return state;
}

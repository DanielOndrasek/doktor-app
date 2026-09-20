/**
 * Všechny uživatelsky viditelné texty aplikace. Do komponent se nepíše
 * natvrdo nic, co uživatel uvidí nebo co přečte odečítač obrazovky — viz
 * `CLAUDE.md`, oddíl Konvence.
 *
 * Řazení podle oblasti. Uvnitř oblasti podle toho, jak texty na obrazovce
 * jdou za sebou, ne podle abecedy.
 */
export const cs = {
  /** Texty zabudované v převzatém UI kitu (shadcn). Uživatel je většinou
   *  nevidí — jsou to popisky pro odečítače obrazovky a výchozí hodnoty. */
  ui: {
    zavrit: "Zavřít",
    dalsi: "Další",
    vic: "Více",
    vicStranek: "Další stránky",
    predchoziStranka: "Předchozí stránka",
    dalsiStranka: "Následující stránka",
    strankovani: "Stránkování",
    drobenka: "Cesta na stránce",
    prepnoutPanel: "Přepnout postranní panel",
    nacitani: "Načítání…",
    zacniPsat: "Začněte psát pro vyhledávání…",
  },

  /** Výběr data (`ui/date-picker.tsx`). */
  datum: {
    vybratDatum: "Vybrat datum",
    popisek: "Datum",
    smazatDatum: "Smazat datum",
  },

  /** Přepínač světlého a tmavého režimu (`components/ThemeHost.tsx`). */
  tema: {
    svetle: "Světlý režim",
    tmave: "Tmavý režim",
    podleSystemu: "Podle systému",
  },
} as const;

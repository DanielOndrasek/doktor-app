/**
 * Světlý a tmavý režim. Jediný vlastník pravidel: co se ukládá, jak se to
 * čte a která třída sedí na `<html>`.
 *
 * Musí sedět se skriptem v `index.html`, který třídu nastaví ještě před
 * prvním paintem — jinak dostane stránka barvy z OS a po načtení bundlu se
 * přepne na uložené nastavení (viditelný záblesk).
 *
 * Whitelabel branding per organizaci, který na tomhle místě mělo CRM, se
 * nepřebírá: stojí na schématu `crm` (`organizations.whitelabel`) a Doktor
 * má jednoho uživatele a jeden vzhled. Viz `docs/prevzeti-z-vividbooks.md`.
 */
export const THEME_STORAGE_KEY = "doktor:theme";

export type ThemePreference = "light" | "dark" | "system";

function isPreference(value: unknown): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

/** Uložená volba uživatele; `system` když nic uloženo není. */
export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isPreference(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

export function writeThemePreference(preference: ThemePreference): void {
  if (typeof window === "undefined") return;
  try {
    if (preference === "system") window.localStorage.removeItem(THEME_STORAGE_KEY);
    else window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // storage nedostupný (anonymní okno) — volba jen nepřežije reload
  }
}

/** Režim, který se má právě vykreslit. */
export function resolveTheme(preference: ThemePreference): "light" | "dark" {
  if (preference !== "system") return preference;
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Zapíše režim na `<html>`. Idempotentní. */
export function applyTheme(theme: "light" | "dark"): void {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.classList.remove("light", "dark");
  root.classList.add(theme);
}

import { useEffect } from "react";

import { applyTheme, readThemePreference, resolveTheme } from "@/lib/theme";

/**
 * Jediný zapisovač režimu vzhledu na `<html>`. Nic nerenderuje — drží jen
 * třídu `light`/`dark` v souladu s uloženou volbou a se systémem.
 *
 * Převzato z `WhitelabelThemeHost` v CRM (`831f9ae6`) jako koncept „jeden
 * writer CSS proměnných tématu". Vrstva whitelabel brandingu per organizace
 * se neuchovala: stojí na schématu `crm`, které se nepřebírá.
 */
export default function ThemeHost() {
  useEffect(() => {
    const preference = readThemePreference();
    applyTheme(resolveTheme(preference));

    // Uživatel nechal volbu na systému → posloucháme jeho přepnutí.
    if (preference !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return null;
}

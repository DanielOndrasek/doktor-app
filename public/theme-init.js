// Téma před prvním paintem. Bez toho dostane <html> barvy z OS, a jakmile se
// `ThemeHost` dostane k uloženému nastavení, přepne se → viditelný záblesk.
// Klíč musí sedět s `THEME_STORAGE_KEY` v `src/lib/theme.ts`.
// Je to samostatný soubor (ne inline <script>), aby platilo CSP `script-src 'self'`
// z `vercel.json` bez výjimek na hash nebo 'unsafe-inline'.
(function () {
  try {
    var stored = localStorage.getItem("doktor:theme");
    var dark =
      stored === "dark" ||
      (stored !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    var root = document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(dark ? "dark" : "light");
  } catch (e) {
    /* localStorage nedostupné — platí výchozí světlé téma z CSS */
  }
})();

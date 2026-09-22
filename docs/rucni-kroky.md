# Ruční kroky a na co se čeká (stav 22. 9. 2026 večer)

Aplikace (K3) má hotové všechno, co jde udělat z tohoto repozitáře. Tenhle seznam říká, co
musí udělat člověk nebo serverový Claude, a co se tím odblokuje. Odškrtávejte přímo tady.

## A. Daniel — nastavení a rozhodnutí

- [ ] **Claude Code bez dotazů na oprávnění.** Soubory `settings.json` (uživatelské i místní)
  mají `bypassPermissions`, ale webová relace claude.ai/code bere režim z přepínače v UI —
  přepnout tam na „auto“ nebo „bypass“. V terminálu: `claude --permission-mode bypassPermissions`.
- [ ] **Supabase dashboard** (přes MCP to nejde):
  - Authentication → URL Configuration: Site URL `https://doktor-app.vercel.app`; Redirect URLs
    přidat `https://doktor-app.vercel.app/reset-hesla`
    a `https://doktor-app-danielondraseks-projects.vercel.app/reset-hesla`.
  - Authentication → Sign-in / Providers → Email: `password_min_length = 12`.
  - Settings → API: vypnout „Automatically expose new tables“ (práva řídí migrace).
  - Organization → Legal: podepsat DPA se Supabase (podmínka O3).
- [ ] **Vlastní doména** pro aplikaci (O4 je rozhodnuto: Gmail bez OAuth, doména je jen věc
  Vercelu). Po ní: doména do `REST_CORS_ORIGINS` na enginu, do Supabase Redirect URLs a CSP
  (`connect-src` Supabase + engine) ve Vercelu.
- [ ] **Pravidelné běhy třídění** (7:00 · 13:00 · 17:00 Praha = `0 5,11,15 * * *` UTC).
  Routine `trig_014oBtj1JrJ64pFMxQWpeXet` je založená, ale **bez konektorů** — z relace Claude
  Code se konektory do Routine předat nedají, takže spuštěná relace nemá `UVN_Email` ani
  `Supabase` a běh neprovede. V claude.ai → Routines otevřít tuhle Routine a přidat konektory
  UVN_Email a Supabase; když to UI neumožní, založit ji tam znovu se stejným rozvrhem a
  s promptem z `docs/routine-trideni.md` a tuhle smazat.
- [ ] **Ověřit K3 ručně** (kontrola před dokončením etapy z `CLAUDE.md`): přihlásit se s MFA,
  projít Poštu, Úkoly, Události a Dnes proti kontrolnímu seznamu v oddílu 6 plánu. Zejména:
  „Přeposlat“ (opravdu odešle — vyzkoušet na sebe), „Zeptat se Clauda“, „Poznámka pro Clauda“,
  Nastavení → Pravidla, odkazy z Dnes na položku a událost.
- [ ] **Google upozornění na přístup rclone** (P1 z prvního běhu 22. 9.): potvrdit, že je to
  vlastní přístup, jinak odvolat.

## B. Štěpán — obsah a rozhodnutí

- [ ] **Podpisy** (O5): v Nastavení → Podpisy vyplnit skutečné texty a názvy, každé schránce
  nastavit výchozí. Dokud jsou prázdné, odpovědi odcházejí bez podpisu.
- [ ] **Vlastní pravidla pro Clauda**: Nastavení → Pravidla pro Clauda (tykání, oslovení,
  kdo dostává jakou odpověď). Claude čte jen schválená.
- [ ] **O2** karty pacientů ne, „případ“ pod odesílajícím lékařem — blokuje `pripady` (K4.1).
- [ ] **O6** sjednotit úkoly s „Rozdělanou prací“ do jedné tabulky — blokuje přenos dat K2.5.
- [ ] **O7** úprava a mazání vlastních událostí v kalendáři (K5). **O9** které složky Disku
  sdílet se služebním účtem (K4.4). **O8** API pojistka pro spadlý ranní běh (K5).

## C. Server `uvn-mail-mcp` (serverový Claude na `root@2.28.234.7`, `/opt/uvn-mail-mcp`)

Souhrnné zadání se závazným pořadím: **`docs/zadani-serveru-doktor-k3.md`** (ÚKOLy 47–54 + odkazy
na 39–41 a zbytek 44). Kopie je i v repozitáři enginu jako `docs/zadani-k3.md`. Jak to spustit:

```
ssh root@2.28.234.7
cd /opt/uvn-mail-mcp && git pull
claude
> Přečti docs/zadani-k3.md a udělej ÚKOLy v uvedeném pořadí, jeden po druhém: po každém
> testy, commit, push, zápis do docs/stav-serveru.md a `docker compose up -d --build mcp`.
> Nic neodesílej bez potvrzeni='ODESLAT' a SEND_ENABLED, nic nemaž. Až skončíš, vypiš, co zbylo.
```

- [ ] **ÚKOL 39 `opravy_sber`** — páry návrh ↔ skutečně odesláno do `doktor.opravy`, návrhy
  poučení do `pouceni` (`stav = navrh`, `zdroj_opravy`). Odblokuje přehled oprav v aplikaci.
- [ ] **ÚKOL 40 `kontakt_profil`** (profil psaní ke kontaktu) a **ÚKOL 41** podpisy ze Sent.
- [ ] **ÚKOL 44** zbytek: `schranka` ve všech nástrojích; hlavně **`mail_preposlat` se
  `schranka` a `odeslat_z`** (dnes jen ÚVN, aplikace u Gmailu tlačítko schovává).
- [ ] **Přílohy z jiného mailu** (K3.4): `prilohy` u `mail_send` / `mail_draft` přijmout i
  `{zdroj: "zprava", ref, index}` — dnes jen `{zdroj: "upload", id}`.
- [ ] **REST vystavit `mail_najdi`** (dohledání podle Message-ID) — když je `ref_cache` položky
  prošlý (zpráva přesunutá mimo běh), aplikace dnes ukáže chybu.
- [ ] **`audit.vysledek` vždy JSON** — část nástrojů zapisuje Python `repr` (`{'ok': True}`);
  aplikace čte obojí, ale je to křehké.
- [ ] **K2.4** MCP nástroje (`polozka_zapis`, `ukol_zalozit`, …) místo přímého SQL z chatu.
- [ ] **K2.6** stav ze schránky: `\Answered` z Mailu/iPhonu → `polozky.stav = odeslano`,
  `stav_zdroj = schranka` (dnes to při běhu dělá Claude ručně).
- [ ] **K2.7 / K2.8** fronta s hlídáním stárnutí, noční dump DB na Disk.
- [ ] `REST_CORS_ORIGINS` += vlastní doména (až bude).

## D. Co Claude dělá sám (pro úplnost)

- Běh třídění na vyžádání podle skillu `email-triage` a `docs/most-claude.md` (zápis do
  `polozky`, `ukoly`, `udalosti`, `behy`; vlaječky P1; šum do `_Triage/Šum`; nic neodesílá).
- Odpovědi na dotazy a poznámky z fronty (`fronta_claude`) — při běhu nebo v chatu.
- Návrhy poučení, až přijdou opravy z ÚKOLu 39.

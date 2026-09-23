# Ruční kroky a na co se čeká (stav 23. 9. 2026 ráno)

Aplikace (K3) i engine (ÚKOLy 47–54) mají hotové všechno, co jde udělat z repozitářů. Tenhle
seznam říká, co musí udělat člověk, a co se tím odblokuje. Odškrtávejte přímo tady.

## A. Daniel — nastavení a rozhodnutí

- [ ] **Claude Code bez dotazů na oprávnění.** Soubory `settings.json` (uživatelské i místní)
  mají `bypassPermissions`, ale webová relace claude.ai/code bere režim z přepínače v UI —
  přepnout tam na „auto“ nebo „bypass“. V terminálu: `claude --permission-mode bypassPermissions`.
- [x] **Supabase dashboard** (hotovo 23. 9.):
  - Authentication → URL Configuration: Site URL `https://doktor-app.vercel.app`; Redirect URLs
    přidat `https://doktor-app.vercel.app/reset-hesla`
    a `https://doktor-app-danielondraseks-projects.vercel.app/reset-hesla`.
  - Authentication → Sign-in / Providers → Email: `password_min_length = 12`.
  - Settings → API: vypnout „Automatically expose new tables“ (práva řídí migrace).
  - [x] DPA: Supabase ho má od 2025 zabudované v Terms of Service (Organization → Legal
    Documents, „no separate signed DPA is needed“) — ověřeno 23. 9., stáhnout k projektu
    „View DPA“ a „Download TIA“ (Transfer Impact Assessment) jako doklad k O3.
- [x] **Vlastní doména**: rozhodnuto 23. 9. **zatím ne**, aplikace zůstává na
  `https://doktor-app.vercel.app`. CSP se nastavuje pro tuhle adresu (Supabase + engine
  v `connect-src`, `vercel.json`). Až doména bude: Vercel → Domains, DNS CNAME, pak
  `REST_CORS_ORIGINS` na enginu, Supabase Redirect URLs.
- [x] **Pravidelné běhy třídění** (7:00 · 13:00 · 17:00 Praha = `0 5,11,15 * * *` UTC).
  Routine `trig_01VFwZW5a3Svv5VkhvuXvHjj` (23. 9.) budí **tuhle relaci Claude Code**
  (`session_01Ndu1HWBxywyTDF821bQLHZ`), která konektory UVN_Email a Supabase má — novou relaci
  bez konektorů vytvořit nejde. Původní Routine bez konektorů je smazaná. Kdyby relace zanikla,
  založit Routine znovu z relace s konektory (prompt v `docs/routine-trideni.md`).
- [ ] **Ověřit K3 ručně** (kontrola před dokončením etapy z `CLAUDE.md`): přihlásit se s MFA,
  projít Poštu, Úkoly, Události, Pacienti a Dnes proti kontrolnímu seznamu v oddílu 6 plánu.
  Zejména: „Přeposlat“ (opravdu odešle — vyzkoušet na sebe, teď i z Gmailu), „Přiložit
  z původní zprávy“ u odpovědi, „Zeptat se Clauda“, „Poznámka pro Clauda“, Nastavení →
  Pravidla, odkazy z Dnes na položku a událost.
- [ ] **Google upozornění na přístup rclone** (P1 z prvního běhu 22. 9.): potvrdit, že je to
  vlastní přístup, jinak odvolat.

### Po dokončení serveru (ÚKOLy 47–54, 23. 9.) — rozhodnutí a tajemství

- [x] **`ZALOHA_HESLO`** z `/opt/uvn-mail-mcp/.env` uložit do správce hesel. Bez něj se žádná
  noční záloha neotevře. Nikam jinam (ne do chatu, ne do gitu).
- [x] **`SUPABASE_DB_URL`** v `.env` enginu a `postgresql-client-17` (23. 9.): záloha jede
  `pg_dump` (schéma `doktor` 440 kB). Heslo databáze bylo při nastavování prozrazeno v chatu
  a v historii shellu → resetováno v Supabase 23. 9., nový URI zapsán přes `read -rs`.
- [x] **CSP** pro `doktor-app.vercel.app` nasazeno 23. 9. (commit `00c44ea`); zkontrolovat
  v prohlížeči konzoli, jestli nic nehlásí „Refused to …“.
- [ ] **E-mail hlídače běhů** (`HLIDAC_MAIL=true` v `.env`): jediná výjimka z „nic se neodesílá
  samo“ — hlídač by poslal e-mail sám sobě, když běh nepřijde. Rozhodnout se Štěpánem; do té
  doby jen audit a wiki.
- [ ] **O9 odvoz záloh mimo server**: rclone ani druhý disk na serveru nejsou, záloha je jen
  lokální. Rozhodnout cíl (Disk přes služební účet, nebo Hetzner Storage Box) a nastavit.
- [ ] **Terminál 22. 9.**: řetězec omylem zadaný do shellu na serveru vypadal jako heslo — je
  v `~/.bash_history` a v chatu. Pokud to heslo je, změnit ho.

## B. Štěpán — obsah a rozhodnutí

- [ ] **Podpisy** (O5): podklad z odeslané pošty je ve wiki enginu („Podpisy v odeslané poště“,
  `kb` id 38, ÚKOL 41). V Nastavení → Podpisy vyplnit texty a názvy, každé schránce nastavit
  výchozí. Dokud jsou prázdné, odpovědi odcházejí bez podpisu.
- [x] **Pravidla pro Clauda**: jádro skillů (18 pravidel) je nahrané a schválené 22. 9.; Štěpán
  jen doplňuje, když něco chybí. Claude čte jen schválená.
- [x] **O2** změněno 22. 9.: karty pacientů ano, navrhuje je běh, schvaluje Štěpán (obrazovka Pacienti).
- [ ] **Skill `email-triage` v claude.ai** nahradit textem `docs/skill-email-triage-app.md`
  (běhy pak píší do aplikace, ne do artefaktu Schránka). Totéž pro projekt, kde běží ranní chat.
- [ ] **O6** sjednotit úkoly s „Rozdělanou prací“ do jedné tabulky — blokuje přenos dat K2.5.
- [ ] **O7** úprava a mazání vlastních událostí v kalendáři (K5). **O9** které složky Disku
  sdílet se služebním účtem (K4.4, teď i pro zálohy). **O8** API pojistka pro spadlý ranní běh (K5).

## C. Server `uvn-mail-mcp` — hotovo 23. 9. 2026

Všech 11 ÚKOLů zadání `docs/zadani-serveru-doktor-k3.md` je nasazených (commity 957b72f …
a0b5a5d, stav v `docs/stav-serveru.md` enginu). Aplikace na to navázala 23. 9.: přeposlání
z obou schránek s kopiemi a přílohami, „Přiložit z původní zprávy“, dohledání zprávy podle
Message-ID, kontrakt pro Clauda přes nástroje enginu.

Co na serveru ještě není a kdy: `podklady_k_odpovedi` (K4.7, po O1), nástroj pro `pripady`
(dnes přímé SQL, viz `most-claude.md`), přenos dat ze Schránky K2.5 (po O6), sklad příloh
a OCR (K4.3), Disk (O9), CardDAV (K4.5), `REST_CORS_ORIGINS` += vlastní doména (až bude).

## D. Co Claude dělá sám (pro úplnost)

- Běh třídění na vyžádání podle skillu `email-triage` a `docs/most-claude.md` — přes nástroje
  enginu (`beh_zacni`, `polozka_zapis`, `ukol_zaloz`, `udalost_navrhni`, `fronta_*`,
  `pouceni_schvalena`, `beh_ukonci`); vlaječky P1; šum do `_Triage/Šum`; nic neodesílá.
- Odpovědi na dotazy a poznámky z fronty (`fronta_vezmi` / `fronta_hotovo`) — při běhu nebo v chatu.
- Návrhy karet pacientů a poučení (`opravy_sber` → `pouceni_navrhni`).

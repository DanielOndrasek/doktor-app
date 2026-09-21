# Zadání serveru: Gmail jako druhý IMAP účet

Vzniklo 21. 9. 2026 z rozhodnutí O4 (`rozhodnuti.md`). **Zadání pro Claude Code na serveru
`uvn-mail-mcp`** (`/opt/uvn-mail-mcp`). Navazuje na `zadani-serveru-doktor-k1.md`
(ÚKOLy 35–41); číslování pokračuje. Platí stejná pravidla jako pro K1 (žádný `expunge()`,
maskování rodných čísel jednou implementací, audit, `potvrzeni` a `SEND_ENABLED`, testy,
hlášení do wiki, `stav-serveru.md`).

**Proč:** Štěpán má osobní @gmail.com. OAuth cesta k němu bez ověření a CASA nevede (interní
aplikace je jen pro účty Workspace; externí projekt s `gmail.modify` vyžaduje CASA; režim
Testing ruší token po 7 dnech). Gmail proto jde stejnou cestou jako ÚVN: **IMAP/SMTP
s heslem aplikace, jediný zapisovač je engine.** Dosud Gmail obsluhoval Claude přes konektor
Gmail; po tomhle zadání konektor pro zápis nepoužívá.

**Pořadí je závazné:** 42 dá účet a tajemství, 43 přemapuje štítky, 44 sjednotí nástroje,
45 odeslání, 46 test kontraktu „Vrátit zpět".

---

## ÚKOL 42 — účet `gmail`: připojení a tajemství

**Co:**
1. Druhý účet v konfiguraci vedle `uvn`: `schranka = "gmail"`, `imap.gmail.com:993` (TLS),
   `smtp.gmail.com:465` (TLS), uživatel = celá adresa, heslo = **heslo aplikace** (16 znaků,
   Štěpán ho vygeneruje po zapnutí dvoufázového ověření).
2. Heslo aplikace žije **jen v tajemstvích enginu** (stejný mechanismus jako heslo ÚVN).
   Nikdy v aplikaci, v Supabase, v logu, v auditu, ve wiki. Do auditu jde `schranka`, ne
   přihlašovací údaje.
3. Limity Gmailu, které engine respektuje: nejvýš **15 souběžných IMAP spojení** na účet
   (držet 1–2, sdílet), stažení do 2 500 MB/den, nahrání do 500 MB/den. Při `[ALERT]`
   nebo `Too many simultaneous connections` čekat a zkusit znovu, ne otevírat další spojení.
4. `mail_stats(schranka="gmail")` vrací stav spojení, počet zpráv a čas posledního `mail_sync`.

**Hotovo, když:** `mail_stats(schranka="gmail")` odpoví bez chyby, v konfiguraci není heslo
v čitelné podobě a `grep` přes repozitář a logy ho nenajde.

## ÚKOL 43 — štítky jako složky, standardní složky přes SPECIAL-USE

**Proč:** Gmail v IMAP ukazuje štítky jako složky a systémové složky pojmenovává podle jazyka
účtu (`[Gmail]/Odeslaná pošta`, `[Gmail]/Všechny zprávy`). Kód, který by spoléhal na názvy,
by po přepnutí jazyka přestal fungovat.

**Co:**
1. Standardní složky najít přes `LIST` s atributy **SPECIAL-USE** (`\All`, `\Sent`, `\Drafts`,
   `\Junk`, `\Trash`, `\Flagged`, `\Important`), ne podle názvu. `mail_folders(schranka="gmail")`
   vrací `standardni` (id z kontraktu aplikace: `inbox`, `sent`, `drafts`, `starred`, `important`,
   `spam`, `trash`, `archive`) a `vlastni` (uživatelské štítky, id = název štítku).
2. `_Triage/Vyřízeno` je na Gmailu **štítek** `_Triage/Vyřízeno` (vnořený štítek `_Triage`).
   Vytvoří ho engine při prvním použití, ne uživatel — jediná výjimka z „nic se nezakládá",
   a jen tenhle jeden štítek (stejně jako `_Triage/*` u ÚVN).
3. **Přesun na Gmailu = změna štítků, ne kopie + smazání.** `mail_move(ref, slozka)`:
   - do `_Triage/Vyřízeno`: přidat štítek `_Triage/Vyřízeno`, odebrat `\Inbox` (zpráva zůstává
     v All Mail — to *je* Gmail archiv);
   - do `INBOX` (návrat): **nejdřív** přidat `\Inbox`, **potom** odebrat `_Triage/Vyřízeno` —
     pořadí je součást kontraktu „Vrátit zpět" (`docs/prevzato/README.md`, bod 5);
   - `archive` (aplikace: `archiveMessage`) = odebrat `\Inbox`, nic víc.
   Použít rozšíření `X-GM-LABELS` (`STORE +X-GM-LABELS` / `-X-GM-LABELS`) místo `COPY`/`MOVE`,
   kde to jde; `MOVE` jen tam, kde Gmail štítek přes `X-GM-LABELS` nepřijme.
4. `novy_ref` po přesunu: UID zprávy v Gmailu se štítkováním **nemění** uvnitř téže složky,
   ale `ref` nese složku, a ta se mění. Vrátit `{ok, novy_ref, slozka, message_id}` jako
   u ÚVN; `novy_ref` sestavit ze složky, ve které je zpráva teď dohledatelná (`\Inbox`, jinak
   `_Triage/Vyřízeno`, jinak `\All`), a UID v ní ověřit `UID SEARCH X-GM-MSGID`.
5. Vlákna přes `X-GM-THRID` (stabilní id vlákna z Gmailu), ne přes vlastní heuristiku
   z `References`; do indexu uložit `vlakno = X-GM-THRID`, `gm_msgid = X-GM-MSGID`.
6. Koš a spam se **nevystavují** ani na Gmailu (`trash`, `deleteFolder`, `createFolder` mimo
   bod 2 neexistují) — stejné pravidlo jako ÚVN.

**Hotovo, když:** `mail_move` tam a zpět na testovací zprávě skončí se zprávou v Doručených
bez štítku `_Triage/Vyřízeno`, `novy_ref` je pokaždé platný a `mail_prilohy(novy_ref)` funguje;
`mail_folders` vrátí správné složky při jazyce účtu čeština i angličtina.

## ÚKOL 44 — `schranka` a `schranky[]` ve všech nástrojích, index a sync

**Co:**
1. Každý nástroj, který dnes bere `schranka="uvn"`, přijme `"gmail"`: `mail_search`, `mail_get`,
   `mail_thread`, `mail_najdi`, `mail_flag`, `mail_move`, `mail_prilohy`, `mail_priloha`,
   `mail_priloha_soubor`, `mail_draft`, `mail_send`, `mail_preposlat`, `mail_sync`, `mail_stats`,
   `mail_kontakty`, `mail_style_sample`, `stav_vlaken`, `kontakt_profil`.
2. `mail_search` a `mail_folders` navíc `schranky: ["uvn","gmail"]` — **sjednocená schránka**
   pro aplikaci (plán 4.1). Výsledek nese `schranka` u každé zprávy; řazení podle data napříč
   schránkami; `dalsi_strana` je jeden token pro obě.
3. `mail_sync(schranka="gmail")`: přírůstkově přes `UIDVALIDITY` + `UID` a `X-GM-MSGID`
   (dedupe — jedna zpráva pod více štítky je v indexu jednou). Pokud index už Gmail obsahuje
   z archivů (`archiv_*`), sjednotit podle `Message-ID` a `X-GM-MSGID`, ne založit duplicitu.
4. Tělo: `mail_get(ref, format)` jako v ÚKOLU 36 — HTML ze surového MIME, sanitizace na serveru,
   `cid:` obrázky jako `data:`, `odkazy[]`. Maskování rodných čísel prochází stejnou funkcí.
5. `stav_vlaken` (ÚKOL 38) hledá odpověď **v obou** Sent — odpověď z Gmailu na zprávu z ÚVN
   (a naopak) uzavírá položku stejně. `odpoved_ze_schranky` to říká.
6. Přesun mezi schránkami neexistuje: `mail_move` s `ref` z jedné schránky a cílem v druhé vrací
   `{ok:false, duvod}`.

**Hotovo, když:** `mail_search(schranky=["uvn","gmail"], dotaz=…)` vrátí zprávy z obou
seřazené dohromady, `mail_sync(schranka="gmail")` dvakrát po sobě nezdvojí žádnou zprávu
a `stav_vlaken` na zprávě z ÚVN zodpovězené z Gmailu vrátí `odpovezeno: true`.

## ÚKOL 45 — odeslání z Gmailu přes SMTP

**Co:**
1. `mail_send` / `mail_draft` / `mail_preposlat` s `odeslat_z = <gmail adresa>` jdou přes
   `smtp.gmail.com:465`. Gmail odeslanou zprávu **sám uloží** do Sent — engine ji do Sent
   **neukládá** znovu (u ÚVN ano), jinak vznikne duplicita.
2. Koncept (`mail_draft`) se ukládá `APPEND` do složky s atributem `\Drafts`, s přílohami podle
   ÚKOLU 37; ověřit, že ho Gmail na webu i v Apple Mailu otevře a odešle.
3. `odeslat_z` musí odpovídat schránce, ze které zpráva přišla; když ne, vrátit varování
   `{ok:false, duvod:"jina_schranka"}`, dokud nepřijde `potvrzeni_jine_schranky: true`
   (aplikace to ukazuje jako varování — pravidlo 8 v `CLAUDE.md` aplikace).
4. `potvrzeni` a `SEND_ENABLED` platí beze změny. Denní limit Gmailu (500 odchozích u osobního
   účtu) engine nehlídá, ale chybu `550 5.4.5` vrací srozumitelně jako `duvod`.

**Hotovo, když:** odpověď z aplikace s `odeslat_z` = Gmail dojde adresátovi, je v Gmail Sent
právě jednou, má správné `In-Reply-To`/`References` a `stav_vlaken` ji následně páruje.

## ÚKOL 46 — test kontraktu „Vrátit zpět" na Gmailu

**Co:** přepsat případ 5 z `docs/prevzato/t22-vratit-zpet.test.js` (v repozitáři aplikace)
na test enginu s falešným IMAP klientem, který umí `X-GM-LABELS`: odškrtnutí → po odpočtu
`mail_move` do `_Triage/Vyřízeno` → `novy_ref` → návrat do `INBOX` v pořadí „INBOX zpět,
Vyřízeno pryč" → `mail_najdi(schranka="gmail")` zprávu najde v Doručených. Dvojí spuštění
nesmí poslat dva přesuny (případ 7).

**Hotovo, když:** test projde a hlášení ve wiki (`typicky_dotaz` = „posledni hlaseni ze
serveru") říká, které nástroje `schranka="gmail"` umějí.

---

## Co tady není

- **OAuth, Gmail API, konektor Gmail pro zápis** — nepoužívají se. Konektor smí Claude dál
  používat jen pro čtení, dokud index Gmailu (ÚKOL 44) neběží; potom ani to.
- REST `/api/v1` pro aplikaci — K2.3. Tyhle nástroje jsou to, co REST obalí; aplikace už je volá
  jmény (`src/lib/email/engineMailbox.ts`).
- Mediendo — třetí schránka podle stejného vzoru, až bude zadání.

## Co si pohlídat

- **Heslo aplikace je plný přístup k účtu.** Rotace: nové heslo aplikace v Google účtu, výměna
  v tajemstvích enginu, staré zneplatnit. Postup zapsat do `stav-serveru.md`.
- Google může hesla aplikací u osobních účtů časem omezit. Kdyby se to stalo, jediná záloha je
  ověření externího projektu s CASA — vědět to teď, ne až to spadne.
- Hesla aplikací nejsou k dispozici při 2FA jen přes bezpečnostní klíč nebo Advanced Protection.

# Zadání serveru: Doktor aplikace, fáze K1

Vzniklo 20. 9. 2026. **Zadání pro Claude Code na serveru `uvn-mail-mcp`** (`/opt/uvn-mail-mcp`).
Kontext a celek je v `plan-doktor-aplikace.md`. Navazuje na ÚKOLy 1–34 ve `stav-serveru.md`.

Pořadí je závazné: ÚKOL 35 odblokuje opravu chyby ve Schránce, 36–37 řeší Štěpánovy
připomínky z 20. 9., 38–41 jsou základ učení a CRM.

## Pravidla, která platí pro všechny úkoly

- **Obecný `expunge()` se do kódu nevrací.** Nic se nemaže, do koše se nepřesouvá.
- Maskování rodných čísel má **jedinou implementaci** (`rodne_cislo.py`); nové výstupy textu
  (HTML tělo, text příloh) jí procházejí stejně jako dosavadní.
- Každý nový nástroj a každý zápis jde do auditu (`mail_audit`).
- Odesílání zůstává za potvrzením (`potvrzeni`) a za přepínačem `SEND_ENABLED`.
- Ke každému úkolu testy (falešný IMAP klient, SHA-256 u příloh) a **hlášení do wiki**
  přes `kb_upsert`, `typicky_dotaz` = „posledni hlaseni ze serveru".
- Nový nástroj ani parametr se do běžícího chatu nepropíše — po nasazení nový chat.
- Po dokončení aktualizovat `stav-serveru.md`.

---

## ÚKOL 35 — `mail_move` vrací nový ref, `mail_najdi` hledá všude

**Proč:** ověřeno 20. 9. na zprávě `3Li.2N23.1CUqUeCJ2i3.1geH6S@seznam.cz`: po přesunu do
`_Triage/Vyřízeno` je původní `INBOX:95065` neplatný, číselné id v indexu se změnilo
(23594 → 23732) a `mail_najdi(schranka="uvn")` vrací „nenalezena … v INBOX, Sent". Schránka
proto neumí omylem vyřízenou zprávu vrátit.

**Co:**
1. `mail_move` vrátí `{ok, novy_ref, slozka, message_id}`. Nový uid vzít z `COPYUID`
   (UIDPLUS/MOVE); když server `COPYUID` nevrátí, dohledat v cílové složce podle
   `HEADER Message-ID`. Index aktualizovat hned, ne až při dalším `mail_sync`.
2. `mail_najdi(schranka="uvn")` hledá ve **všech přihlášených složkách** včetně `_Triage/*`
   (nejdřív v indexu podle `message_id`, potom živě). Nepovinný parametr `slozky`.
3. Přesun **do `INBOX`** je povolený cíl (návrat z `_Triage/*`).

**Hotovo, když:** přesun tam a zpět vrátí pokaždé platný `novy_ref`; `mail_najdi` najde
zprávu v `_Triage/Vyřízeno`; `mail_prilohy(novy_ref)` funguje hned po přesunu.

## ÚKOL 36 — HTML tělo zprávy a zachované odkazy

**Proč:** Štěpán ve Schránce nevidí originál; odkaz schovaný pod tlačítkem (redakční systémy)
se při převodu HTML → text ztrácí, protože index drží jen `body_text` a `body_clean`.

**Co:**
1. `mail_get(ref, format="text"|"html"|"oboji")`. HTML se čte ze surového MIME z IMAPu
   (neukládá se do indexu), **sanitizované na serveru** (bez skriptů, formulářů, externích
   zdrojů; obrázky `cid:` vložit jako `data:` do rozumné velikosti, vzdálené obrázky vypustit).
2. V textové podobě zachovat cíle odkazů: `text odkazu [https://…]`. Platí i pro nově
   indexované zprávy (`body_text`); stará těla se nepřepočítávají.
3. Do výsledku pole `odkazy: [{text, url}]` (bez sledovacích pixelů, bez duplicit).

**Hotovo, když:** u zprávy z redakčního systému vrátí `odkazy` přihlašovací adresu a HTML
se v prohlížeči zobrazí bez načítání čehokoli zvenčí.

## ÚKOL 37 — přílohy odkazem při odeslání, konceptu a přeposlání

**Proč:** `mail_send` ani `mail_draft` přílohu neumějí; base64 přes kontext neprojde
(79 kB PDF = 108 tisíc znaků). `mail_preposlat` přílohy umí — jeho vnitřní funkci znovu použít.

**Co:**
1. Parametr `prilohy: [{zdroj, …}]` u `mail_send`, `mail_draft`, `mail_preposlat`:
   - `{zdroj:"zprava", ref, index|nazev, schranka?}` — příloha z jiné zprávy (ÚVN i Gmail přes IMAP);
   - `{zdroj:"upload", id}` a `{zdroj:"disk", file_id}` — připravit rozhraní, implementace v K2/K4.
2. Server složí `multipart/mixed`, u ÚVN odešle přes SMTP a uloží do `Sent`; koncept
   uloží do `Drafts` včetně příloh (ověřit, že ho Apple Mail otevře a odešle).
3. Před odesláním vrátit při `potvrzeni` chybějícím výpis: názvy, velikosti, součet.
   Strop součtu nastavitelný (`MAX_PRILOHY_MB`, výchozí 20); nad strop `{ok:false, duvod}`.
4. Test SHA-256: příloha v odeslané zprávě = příloha ve zdrojové zprávě.

**Hotovo, když:** z Clauda jde říct „odpověz a přilož PDF z té a té zprávy" a koncept
v Apple Mailu přílohu má.

## ÚKOL 38 — `stav_vlaken`: párování stavu se schránkou

**Proč:** ze 171 položek Schránky je 116 „nových", přestože Štěpán na řadu z nich odpověděl
z Mailu nebo iPhonu. Stav se musí odvozovat ze schránky.

**Co:** nástroj `stav_vlaken(polozky: [{message_id, schranka}])` → pro každou:
`{odpovezeno: bool, odpoved_ref, odpoved_datum, odpoved_ze_schranky, priznaky, aktualni_ref, slozka}`.
Odpověď = pozdější odchozí zpráva s `In-Reply-To`/`References` na tuto zprávu **v kterékoli
schránce** (ÚVN Sent, Gmail odeslané), jinak shoda vlákna + příjemce; doplňkově `\Answered`.
Jen čtení, dávka do 200 položek, bez AI.

**Hotovo, když:** na vzorku z 20. 9. (Český rozhlas P1, Grega, Bureš MTA, Cancers) vrátí
`odpovezeno: true` a u nezodpovězených `false`.

## ÚKOL 39 — `opravy_sber`: páry návrh ↔ skutečně odesláno

**Co:** vstup `[{polozka_id, message_id, schranka, navrh_telo}]`; výstup pro zodpovězené:
`{polozka_id, odeslano_ref, odeslano_telo (bez citace a patičky), podobnost 0–1,
rozdil: {osloveni, podpis, delka_pomer, pridane_vety[], vypustene_vety[]}}`.
Podobnost deterministicky (tokeny bez diakritiky, poměr shody). Citovanou část a patičku
odříznout stejnou funkcí, jakou používá `mail_style_sample`.

**Hotovo, když:** pro dávku návrhů ze Schránky vrátí páry a průměrnou podobnost po
kategoriích — výchozí hodnota metriky kvality.

## ÚKOL 40 — `kontakt_profil`: jak Štěpán danému člověku píše

**Co:** `kontakt_profil(email, n=10)` z posledních odchozích zpráv na adresu (ÚVN Sent,
Gmail odeslané, archiv): `{osloveni, tykani: tyka|vyka|nejiste, podpis: Suchánek|ŠS|Š|Štěpán|…,
paticka: bool, jazyk, obvykla_delka, odesilat_z, posledni_kontakt, pocet}`. Deterministicky
(regulární výrazy nad prvním a posledním řádkem těla, tvary sloves 2. osoby); při méně než
třech zprávách `nejiste`.

**Hotovo, když:** na deseti lidech z tabulky registru ve skillu `email-styl-suchanek`
(sekce 2) souhlasí tykání a podpis.

## ÚKOL 41 — podpisy vytěžené ze Sent (jednorázově)

**Co:** skript `tools/podpisy_ze_sent.py`: z odeslaných zpráv odříznout koncové bloky,
normalizovat, seskupit, vypsat shluky s četností, obdobím a ukázkou. Výstup jako markdown
do wiki. Slouží jako podklad pro Štěpánův výběr a pojmenování podpisů (rozhodnutí O5).

---

## Co v K1 není

REST pro aplikaci, tabulky aplikace, sklad příloh, OCR, Disk, CardDAV — to je K2 a K4.
Rozhraní `prilohy[]` ale navrhnout tak, aby zdroje `upload`, `disk` a `priloha` (sklad)
šly doplnit bez změny signatury.

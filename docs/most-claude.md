# Most do Clauda: jak Claude čte a zapisuje do schématu `doktor`

Aplikace nevolá žádný model (CLAUDE.md, Stack). „Most do Clauda“ z plánu je obráceně:
**Claude přes MCP** čte poštu z enginu (`mcp__UVN_Email__*`) a zapisuje metadata
do Supabase (`mcp__Supabase__execute_sql` / `apply_migration`), aplikace to jen ukazuje.
Tenhle dokument říká, co smí Claude zapsat, kam a jak, aby to aplikace i RLS unesly.
Až vzniknou MCP nástroje na enginu (K2.4: `polozka_zapis`, `ukol_zalozit`, …), budou
dělat totéž; do té doby jde přímý SQL přes Supabase MCP.

## Dvě spojení, jeden uživatel

| Spojení | K čemu | Co nikdy |
|---|---|---|
| Engine `uvn-mail-mcp` (MCP `UVN_Email`) | index pošty, těla, přílohy, kalendáře, adresář (`mail_search`, `mail_get`, `mail_thread`, `mail_kontakty`, `cal_*`) | posílat ven rodná čísla; mazat; odesílat bez potvrzení |
| Supabase projekt `doktor` (MCP `Supabase`, ref `dwwwdeagnqiibwraxyjx`) | metadata: `polozky`, `ukoly`, `udalosti`, `kontakty`, `poznamky`, `behy`, `fronta_claude`, `audit` | těla zpráv, bajty a text příloh (pravidlo 5); rodná čísla (pravidlo 7) |

Každý řádek má `user_id`. Uživatel je zatím jeden — id se zjistí
`select id from auth.users where email = '…'` a dosadí do každého insertu. Supabase MCP
běží jako service role a RLS obchází, proto je `user_id` **povinnost Clauda**, ne databáze.

## Idempotence — každý zápis nese `zdroj_id`

| Tabulka | Klíč | Tvar `zdroj_id` |
|---|---|---|
| `polozky` | `(schranka_id, message_id)` | RFC Message-ID z `mail_get` (ne `ref`, ten se přesunem mění) |
| `ukoly` | `(user_id, zdroj_id)` | `email:<message_id>`, `claude:<projekt>:<slug>`, `plaud:<id nahrávky>` |
| `udalosti` | `(user_id, zdroj_id)` | `email:<message_id>:<index návrhu>` |
| `poznamky` | `(user_id, zdroj_id)` | `plaud:<id>`, `claude:<session>:<n>` |
| `kontakty` | `id = md5('doktor:kontakt:' || klíč)::uuid` | klíč = `prijmeni|jmeno` bez diakritiky; adresy `unique (user_id, hodnota)` |

Vždy `insert … on conflict do nothing` (nebo `do update` jen u sloupců, které Claude vlastní).
Rozepsaný text uživatele (`polozky.rozepsano_telo`) se **nikdy** nepřepisuje (E3).

## Stav se odvozuje ze schránky (pravidlo 4)

`polozky.stav` a `ukoly.stav` mají `stav_zdroj in ('klik', 'schranka', 'beh')`:

- Claude v běhu zapisuje `stav_zdroj = 'beh'`.
- Když engine vidí odpověď odeslanou z Mailu nebo iPhonu, položka se uzavře
  se `stav_zdroj = 'schranka'` — to přijde s K2.6 na enginu, Claude to nesimuluje.
- Klik uživatele v aplikaci (`stav_zdroj = 'klik'`) má přednost; běh ho nepřepisuje.

## Co běh třídění (skill `email-triage`) zapíše místo artefaktu „Schránka“

1. `behy`: jeden řádek na běh (`zacatek`, `stav = 'bezi'` → `hotovo` / `chyba`, `pocty`).
2. `polozky`: na zprávu jeden řádek — `schranka_id`, `message_id`, `vlakno`, `ref_cache`,
   `od`, `od_email`, `predmet`, `datum`, `kategorie`, `priorita 1–3`, `stav`, `co_resit`,
   `navrh_predmet`, `navrh_telo`, `komu[]`, `kopie[]`, `prilohy_meta` (jen názvy, typy,
   velikosti, SHA), `kontakt_id` (podle `kontakt_adresy.hodnota = od_email`), `beh_id`.
   **`ref_cache` je povinný** (`ref` z `mail_search`, tvar `složka:uid`): seznam zpráv
   v aplikaci nemá Message-ID a položky k němu páruje právě přes `ref_cache`; po přesunu
   ho aplikace přepíše na `novy_ref`, běh ho při dalším průchodu obnoví. `navrh_telo` je
   prostý text (odstavce oddělené prázdným řádkem), aplikace ho převede do editoru.
   **`stav`** je `nove` · `ceka` · `odeslano` · `hotovo` (= Vyřízeno v UI) · `zamitnuto`;
   `dnes()` počítá s `hotovo`/`zamitnuto` jako uzavřenými. Kliknutí v aplikaci zapisuje
   `hotovo`/`nove` se `stav_zdroj = klik` — běh takový stav nepřepisuje.
3. `ukoly`: sliby a termíny z pošty — `zdroj = 'email'`, `zdroj_id = 'email:<message_id>'`,
   `polozka_id`, `kontakt_id`; `claude_projekt`, když úkol patří do rozpracovaného projektu.
4. `udalosti`: návrhy termínů — `stav = 'novy'`, `kolize` z `cal_free`; **nikdy** `cal_pridat`
   (do kalendáře jen kliknutím v aplikaci).
5. `audit`: `kdo = 'beh'`, nástroj, parametry bez těl.

Souhrn běhu zůstává v chatu; „Dnes“ ho neukazuje, ukazuje `dnes()`.

## Rozpracováno v Claude

Sekce na Dnes čte `ukoly` s vyplněným `claude_projekt` (ne hotovo / zruseno) a počet
řádků `fronta_claude` ve stavu `ceka` / `bezi`. Projekt tedy existuje, dokud má otevřený
úkol. Když Claude začne na něčem pracovat, založí úkol se `zdroj = 'claude'`,
`claude_projekt = '<název projektu>'`, `zdroj_id = 'claude:<projekt>:<slug>'`; po dokončení
ho přepne na `hotovo` (`stav_zdroj = 'beh'`). Dlouhé požadavky jdou do `fronta_claude`
(`druh`, `vstup`, `stav`, `vysledek`).

## Dotazy z aplikace („Zeptat se", od 22. 9.)

Pošta má vedle hledání bez AI tlačítko „Zeptat se Clauda". Aplikace **žádný model nevolá**
— dotaz zapíše do `fronta_claude`:

```
druh = 'dotaz', stav = 'ceka',
vstup = {otazka, kontext: {zdroj: 'posta', schranka, klicove_slovo, filtr: {from, to, dateFrom, dateTo, direction, hasAttachment}, slozka}}
```

Claude (v chatu nebo v běhu) frontu čte: `select id, vstup from doktor.fronta_claude where
druh = 'dotaz' and stav = 'ceka' order by vytvoreno`. Odpověď hledá přes `mail_search`
(kontext říká, kde: `filtr.from` → `odesilatel`, období → `od_data`/`do_data`, klíčové slovo →
`dotaz`), `mail_thread`, `kb_search` a `archiv_search`; nikdy nic neodesílá ani nepřesouvá.
Zapíše `update … set stav = 'hotovo', vysledek = jsonb_build_object('odpoved', '<prostý text,
odstavce prázdným řádkem>', 'refy', '["INBOX:95420", …]')`; při neúspěchu `stav = 'chyba'`
s `vysledek.odpoved` = proč. Dnes ukazuje `vysledek.odpoved` v „Rozpracováno v Claude";
refy zatím jen jako text (proklik na položku přijde s K0.3, až refy půjdou párovat na `polozky`).
Do odpovědi nepatří rodná čísla (pravidlo 7) — jména pacientů ano.

## Poznámka pro Clauda ke zprávě (od 22. 9.)

V detailu zprávy je „Poznámka pro Clauda": co u téhle zprávy udělat jinak („přepiš návrh
stručněji", „tohle je šum", „odpověď pošlu sám"). Aplikace zapíše do `fronta_claude`:

```
druh = 'poznamka', stav = 'ceka',
vstup = {text, kontext: {zdroj: 'posta', schranka, ref, message_id, predmet, od, polozka_id}}
```

Běh (nebo Claude v chatu) poznámky čte **před** tříděním a návrhy: `select id, vstup from
doktor.fronta_claude where druh = 'poznamka' and stav = 'ceka'`. Podle poznámky upraví
položku (`navrh_telo`, `kategorie`, `priorita`, `stav`; `rozepsano_telo` nikdy — E3) nebo
zprávu (přesun do šumu přes `mail_move`), a zapíše `stav = 'hotovo'`, `vysledek =
jsonb_build_object('odpoved', 'co se udělalo')`. Poznámka nikdy neznamená odeslání —
odeslání je vždy kliknutí v aplikaci (pravidlo 8).

## Pravidla pro Clauda (`pouceni`, od 22. 9.)

Nastavení → Pravidla pro Clauda. Claude před psaním návrhů čte **jen schválená**:
`select text from doktor.pouceni where stav = 'schvaleno' order by vytvoreno`. Vlastní
pravidla lékaře jsou schválená rovnou; návrhy z běhů (`opravy_sber`, ÚKOL 39; K4.7 týdenní
poučení) se zakládají se `stav = 'navrh'` a `zdroj_opravy = array[id oprav]`, lékař je
v Nastavení schválí nebo zamítne. Nic se nemaže.

## Co se 21. 9. naplnilo

- `schranky`: ÚVN (`stepan.suchanek@uvn.cz`). Gmail přibude, až bude adresa a účet na enginu.
- `organizace` (44) a `kontakty` (174) se `kontakt_adresy` (198) z `mail_kontakty(limit 200)`:
  tituly odděleny, jméno a příjmení podle seznamu českých křestních jmen, víc adres jedné
  osoby sloučeno, organizace podle domény. `zdroj = 'adresar_enginu'`. Vlastní adresy
  lékaře vynechány.
- `ukoly` v projektu „Doktor — aplikace“: REST enginu, Gmail IMAP, běh do DB, kontakty,
  Supabase dashboard, doména a CSP.
- `polozky` **ne**: `mail_kontakty` ani `mail_search` nevrací Message-ID a bez něj by
  seed kolidoval s budoucím během. První běh třídění je naplní správně.

## První běh třídění (22. 9. 2026, `behy` d930633b)

Ručně z chatu podle skillu `email-triage`, okno 19.–22. 9.: 45 zpráv ÚVN INBOX, 8 Gmail.
Zapsáno 19 `polozky` (Message-ID přes `mail_get`, `ref_cache` = ref, `kontakt_id` přes
`kontakt_adresy`), 8 návrhů odpovědí v `navrh_telo` (styl `email-styl-suchanek`, bez podpisu —
ten vkládá aplikace podle schránky), 3 `udalosti` (porada IK 14. 10. s kolizí z `cal_events`,
dvě celodenní lhůty) a 11 `ukoly` (`zdroj = email`, `zdroj_id = email:<message_id>`).
Šum a roboti (newslettery, MDPI notifikace, výpadky léčiv) se do `polozky` nezapisovali a nic
se v ÚVN nepřesouvalo ani neoznačovalo — první běh je jen zápis, úklid schránky přijde
s dalšími běhy. Stav odvozený ze schránky: zpráva s `\Answered` dostala `stav = odeslano`,
`stav_zdroj = schranka`. Co příští běh musí navíc: `mail_flag` P1 vlaječkou, šum do
`_Triage/Šum`, přílohy přes `mail_priloha`, `kb_upsert` hlášení.

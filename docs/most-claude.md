# Most do Clauda: jak Claude čte a zapisuje do schématu `doktor`

Aplikace nevolá žádný model (CLAUDE.md, Stack). „Most do Clauda“ z plánu je obráceně:
**Claude přes MCP** čte poštu z enginu (`mcp__UVN_Email__*`) a zapisuje metadata do Supabase,
aplikace to jen ukazuje. Tenhle dokument říká, co smí Claude zapsat, kam a jak, aby to
aplikace i RLS unesly.

**Od 23. 9. 2026 (ÚKOL 54, K2.4) se zapisuje přes nástroje enginu**, ne přímým SQL. Nástroje
mají pravidla zadrátovaná v jedné implementaci: `user_id` doplní engine, rodné číslo se
**odmítne** (nic se nezapíše), `rozepsano_telo` se nezapisuje nikdy, `stav_zdroj = klik` se
nepřepisuje, idempotence přes `(schranka_id, message_id)` a `zdroj_id`, každé volání jde do
`audit`. Přímé SQL (`mcp__Supabase__execute_sql`) zůstává jen pro **čtení**, pro `pripady`
(nástroj zatím není) a pro nouzové opravy.

Data z artefaktu „Schránka“ (212 položek, 213 úkolů, 34 událostí, 21 oprav) jsou v aplikaci od
23. 9. 2026; artefakt je od té doby jen archiv. Text skillu pro claude.ai: `docs/skill-email-triage-app.md`.

## Dvě spojení, jeden uživatel

| Spojení | K čemu | Co nikdy |
|---|---|---|
| Engine `uvn-mail-mcp` (MCP `UVN_Email`) | pošta: `mail_search`, `mail_get`, `mail_thread`, `mail_kontakty`, `mail_flag`, `mail_move`, `cal_*`, `kb_*`; **zápis do Supabase**: `beh_zacni`, `beh_ukonci`, `polozka_zapis`, `ukol_zaloz`, `udalost_navrhni`, `fronta_vezmi`, `fronta_hotovo`, `pouceni_schvalena`, `pouceni_navrhni`; styl: `kontakt_profil`, `opravy_sber` | posílat ven rodná čísla; mazat; odesílat (`mail_send`, `mail_preposlat`) bez výslovného pokynu; `cal_pridat` z běhu |
| Supabase projekt `doktor` (MCP `Supabase`, ref `dwwwdeagnqiibwraxyjx`) | **čtení** stavu (`polozky`, `ukoly`, `pripady`, `pouceni`, `behy`, `audit`), zápis `pripady` | těla zpráv, bajty a text příloh (pravidlo 5); rodná čísla (pravidlo 7) |

Uživatel je zatím jeden — nástroje enginu `user_id` doplní samy; u přímého SQL (jen `pripady`)
se zjistí `select id from auth.users where email = 'stepan.suchanek@uvn.cz'`.

## Nástroje enginu pro zápis (ÚKOL 54)

| Nástroj | Co dělá | Klíč idempotence |
|---|---|---|
| `beh_zacni(schranky=["uvn","gmail"])` → `beh_id` | založí řádek `behy` (`stav = bezi`) | — |
| `beh_ukonci(beh_id, stav, pocty, chyba)` | uzavře běh (`hotovo` / `chyba` / `zruseno`); `pocty` = `{zpravy_uvn, zpravy_gmail, polozky, koncepty, ukoly, udalosti, pripady, sum_uvn, sum_gmail, prilohy_precteno}` | — |
| `polozka_zapis(beh_id, polozka)` | upsert `polozky`; `polozka = {schranka_id, message_id, vlakno, ref_cache, od, od_email, predmet, datum, kategorie, priorita, stav, co_resit, navrh_predmet, navrh_telo, komu[], kopie[], prilohy_meta, kontakt_id, pripad_id}` | `(schranka_id, message_id)`; **`ref_cache` povinný** (`ref` z `mail_search`); stav `klik` se nechá (`stav_ponechan`) |
| `ukol_zaloz(ukol)` | upsert `ukoly`; `ukol = {nazev, popis, termin, cas, priorita, druh, oblast, zdroj, zdroj_id, polozka_id, kontakt_id, claude_projekt}` | `zdroj_id` (`email:<message_id>`, `claude:<projekt>:<slug>`, `plaud:<id>`) |
| `udalost_navrhni(udalost)` | návrh do `udalosti` (`stav = novy`); `udalost = {nazev, zacatek, konec, celodenni, misto, kalendar, kolize[], polozka_id, zdroj_id}` — **nikdy `cal_pridat`** | `zdroj_id` (`email:<message_id>:<n>`) |
| `fronta_vezmi(druh?, limit)` → `[{id, druh, vstup}]` | vezme čekající řádky `fronta_claude` a označí je `bezi` (zabere si je) | — |
| `fronta_hotovo(id, vysledek, stav)` | uzavře řádek fronty (`hotovo` / `chyba`) | — |
| `pouceni_schvalena()` → `[text]` | jen `stav = schvaleno` | — |
| `pouceni_navrhni(text, zdroj_opravy[])` | návrh pravidla ke schválení (`stav = navrh`) | — |

Návratové hodnoty: `{ok, id | beh_id | pocet, kod?, duvod?}`; `kod: "rodne_cislo"` = nic se
nezapsalo, oprav vstup. `schranka_id`: ÚVN `2e19d638-c598-46ad-abcf-6f34c39606cd`, Gmail
`44068697-283a-4163-a0be-bce3260f6d8c` (tabulka `schranky`).

## Stav se odvozuje ze schránky (pravidlo 4)

`polozky.stav` a `ukoly.stav` mají `stav_zdroj in ('klik', 'schranka', 'beh')`:

- Claude v běhu zapisuje `stav_zdroj = 'beh'` (nástroje to dělají samy).
- **Engine od ÚKOLU 49 sám uzavírá** položky, na které přišla odpověď z Mailu nebo iPhonu
  (`stav = odeslano`, `stav_zdroj = schranka`, každých 15 min), a po každém `mail_move`
  obnovuje `ref_cache`. Běh to nesimuluje.
- Klik uživatele v aplikaci (`stav_zdroj = 'klik'`) má přednost; běh ho nepřepisuje.

## Co běh třídění (skill `email-triage`) zapíše místo artefaktu „Schránka“

1. `beh_zacni` → `beh_id`; na konci `beh_ukonci` s `pocty`.
2. `fronta_vezmi()` **před tříděním**: poznámky ke zprávám (`druh = poznamka`) a dotazy
   (`druh = dotaz`) — viz níž; každý uzavřít `fronta_hotovo`.
3. `pouceni_schvalena()` a řídit se jimi (jádro skillů `email-styl-suchanek` a `email-triage`
   tam je od 22. 9.; lékař doplňuje).
4. Na zprávu `polozka_zapis` — **`ref_cache` je povinný** (seznam v aplikaci nemá Message-ID
   a položky páruje právě přes něj), `navrh_telo` prostý text (odstavce prázdným řádkem,
   bez podpisu — ten vkládá aplikace), `kontakt_id` podle `kontakt_adresy.hodnota = od_email`,
   `prilohy_meta` jen názvy, typy, velikosti, SHA. **`stav`** je `nove` · `ceka` · `odeslano` ·
   `hotovo` (= Vyřízeno v UI) · `zamitnuto`.
5. `ukol_zaloz` na sliby a termíny (`zdroj = email`, `zdroj_id = email:<message_id>`,
   `polozka_id`, `kontakt_id`); `udalost_navrhni` na termíny (`kolize` z `cal_free`;
   **nikdy `cal_pridat`**).
6. Karty pacientů (`pripady`) přímým SQL — viz níž.
7. P1 vlaječka `mail_flag`, jednoznačný šum `mail_move` do `_Triage/Šum`.
8. `beh_ukonci(beh_id, "hotovo", pocty)`. Souhrn zůstává v chatu; „Dnes“ ukazuje `dnes()`.

## Rozpracováno v Claude

Sekce na Dnes čte `ukoly` s vyplněným `claude_projekt` (ne hotovo / zruseno) a počet řádků
`fronta_claude` ve stavu `ceka` / `bezi`. Když Claude začne na něčem pracovat, založí úkol
`ukol_zaloz({zdroj: 'claude', claude_projekt: '<projekt>', zdroj_id: 'claude:<projekt>:<slug>', …})`;
po dokončení ho přepne na `hotovo` (`stav_zdroj = beh`).

## Dotazy z aplikace („Zeptat se“, od 22. 9.)

Pošta má vedle hledání bez AI tlačítko „Zeptat se Clauda“. Aplikace **žádný model nevolá** —
dotaz zapíše do `fronta_claude`:

```
druh = 'dotaz', stav = 'ceka',
vstup = {otazka, kontext: {zdroj: 'posta', schranka, klicove_slovo, filtr: {from, to, dateFrom, dateTo, direction, hasAttachment}, slozka}}
```

Claude: `fronta_vezmi("dotaz")`, odpověď hledá přes `mail_search` (kontext říká, kde: `filtr.from`
→ `odesilatel`, období → `od_data`/`do_data`, klíčové slovo → `dotaz`), `mail_thread`,
`kb_search` a `archiv_search`; nikdy nic neodesílá ani nepřesouvá. Uzavře
`fronta_hotovo(id, {odpoved: '<prostý text, odstavce prázdným řádkem>', refy: ['INBOX:95420', …]}, 'hotovo')`;
při neúspěchu `stav = 'chyba'` s `odpoved` = proč. Dnes ukazuje `vysledek.odpoved`
v „Rozpracováno v Claude“. Do odpovědi nepatří rodná čísla (pravidlo 7) — jména pacientů ano.

## Poznámka pro Clauda ke zprávě (od 22. 9.)

V detailu zprávy je „Poznámka pro Clauda“: co u téhle zprávy udělat jinak („přepiš návrh
stručněji“, „tohle je šum“, „odpověď pošlu sám“). Aplikace zapíše:

```
druh = 'poznamka', stav = 'ceka',
vstup = {text, kontext: {zdroj: 'posta', schranka, ref, message_id, predmet, od, polozka_id}}
```

Běh: `fronta_vezmi("poznamka")` **před** tříděním. Podle poznámky upraví položku
(`polozka_zapis` s novým `navrh_telo`, `kategorie`, `priorita`, `stav`; `rozepsano_telo` nikdy —
E3) nebo zprávu (šum přes `mail_move`), a uzavře `fronta_hotovo(id, {odpoved: 'co se udělalo'})`.
Poznámka nikdy neznamená odeslání — odeslání je vždy kliknutí v aplikaci (pravidlo 8).

## Karty pacientů (`pripady`, O2 změněno 22. 9.)

Nástroj enginu zatím není — jediné místo, kde běh píše přímým SQL. Když je vlákno
o **konkrétním pacientovi** (jméno stojí ve zprávě nebo v příloze — žádost o převzetí,
konzultace, objednání, výsledek), běh navrhne kartu:

```sql
insert into doktor.pripady (user_id, nazev, kontakt_id, shrnuti, zdroj_id, stav, stav_zdroj, beh_id, posledni_zprava)
values (<user_id>, '<Jméno Příjmení pacienta>', <kontakt_id odesílajícího lékaře nebo null>,
        '<1–2 věty: co se řeší, co je další krok>', 'vlakno:<vlakno>', 'navrh', 'beh', <beh_id>, <datum zprávy>)
on conflict (user_id, zdroj_id) do update set posledni_zprava = excluded.posledni_zprava
returning id;
```

a položce dá `pripad_id` (`polozka_zapis` s `pripad_id`).

- Dřív než založíš novou: `select id from doktor.pripady where user_id = … and stav <> 'zamitnuto'
  and lower(nazev) = lower('<jméno>')` — týž pacient ve druhém vlákně se **připojí** k existující
  kartě, nová se nezakládá. `zamitnuto` se nezakládá znovu.
- `nazev` je jméno, jak stojí ve vlákně; bez titulů, bez rodného čísla, bez data narození.
  `shrnuti` bez rodného čísla a bez čísel pojištěnce (pravidlo 7). Údaje jen z téhož vlákna.
- Kartu, kterou lékař změnil (`stav_zdroj = 'klik'`), běh nepřepisuje — jen doplňuje zprávy.
- Karta z jedné zprávy bez jména pacienta nevzniká (`[PACIENT]` není karta).

## Pravidla pro Clauda (`pouceni`)

Nastavení → Pravidla pro Clauda. 22. 9. tam bylo nahráno 18 schválených pravidel — jádro
skillů `email-styl-suchanek` a `email-triage`. Claude před psaním návrhů čte **jen schválená**
(`pouceni_schvalena()`). Návrhy z běhů (`opravy_sber`, ÚKOL 39) zakládá engine přes
`pouceni_navrhni` se `stav = navrh` a `zdroj_opravy`; lékař je v Nastavení schválí nebo
zamítne. Vlastní pravidla lékaře jsou schválená rovnou. Nic se nemaže.

## Historie naplnění

- **21. 9.** `schranky` (ÚVN, Gmail), `organizace` (44), `kontakty` (174) se `kontakt_adresy`
  (198) z `mail_kontakty`; `ukoly` projektu „Doktor — aplikace“.
- **22. 9. první běh třídění** (`behy` d930633b, ručně z chatu, ještě přímým SQL): 45 zpráv ÚVN,
  8 Gmail → 19 `polozky`, 8 návrhů, 3 `udalosti`, 11 `ukoly`; nic se nepřesouvalo.
- **23. 9.** engine ÚKOLy 47–54: nástroje pro zápis, stav ze schránky, hlídač běhů, zálohy.
  Od teď běhy jen přes nástroje.

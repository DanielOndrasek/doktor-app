# Zadání K2: schéma `doktor` a REST `/api/v1`

Vzniklo 21. 9. 2026 po rozhodnutí O3 (Supabase EU) a O4 (Gmail přes IMAP). Kontext je
v `plan-doktor-aplikace.md` (oddíly 3 a 4.1), pravidla v `CLAUDE.md`. Pokrývá **K2.2**
(schéma, RLS, testy odepření) a **K2.3** (REST enginu pro aplikaci, ověření JWT). Zbytek K2
(MCP nástroje 4.2, přenos dat, běhy, zálohy) má vlastní zadání.

**Kdo co dělá:**

| Část | Kde | Kdo |
|---|---|---|
| A. Schéma `doktor` | `supabase/migrations/` v tomto repozitáři, projekt Supabase EU | CC-A (tento repozitář) |
| B. REST `/api/v1` | `/opt/uvn-mail-mcp` na Hetzneru | CC-S (server) |
| C. Napojení aplikace | `src/lib/*` tady | CC-A, až A a B stojí |

Aplikace už má připravené tvary, na které A i B míří — jsou vypsané v části C. Kde se zadání
a hotový kód rozejdou, mění se zadání *nebo* jedno místo v kódu, ne obrazovky.

---

## A. Schéma `doktor` (K2.2)

### A.1 Pravidla pro všechny tabulky

1. **Schéma `doktor`**, české názvy tabulek a sloupců přesně podle oddílu 3 plánu. Nepřejmenovávat,
   nepřekládat. Sloupce navíc jen ty v A.3, každý s důvodem.
2. **Každá tabulka má `id uuid primary key default gen_random_uuid()`, `user_id uuid not null
   references auth.users`, `vytvoreno timestamptz not null default now()`, `upraveno timestamptz
   not null default now()`** (trigger na `upraveno`). `user_id` i při jednom uživateli — přístup
   sekretariátu přijde později (pravidlo 6).
3. **RLS zapnutá na všech tabulkách**, jedna sada politik: `select / insert / update / delete`
   jen pro `user_id = auth.uid()`. Engine a běhy jdou přes service role; ta RLS obchází, a proto
   **musí `user_id` vždy nastavit** (na serveru je `DOKTOR_USER_ID` v konfiguraci, ne odvozený
   z dat).
4. **Idempotence:** každý zápis, který může přijít víckrát (z běhu, z Clauda, ze synchronizace),
   nese `zdroj_id text` s **unikátním indexem** `(user_id, zdroj_id)` tam, kde plán `zdroj_id`
   uvádí (`ukoly`, `poznamky`) — a navíc u `polozky` (`(schranka_id, message_id)`) a `udalosti`
   (viz A.3). Duplicitní zápis je `on conflict do nothing` nebo `do update`, nikdy chyba nahoru.
5. **Datum a čas `timestamptz`.** Nikdy `timestamp` bez zóny, nikdy text.
6. **Výčty jako `check` constraint**, ne Postgres enum (enum nejde měnit bez zámku tabulky):
   - `polozky.stav_zdroj in ('klik','schranka','beh')`,
   - `ukoly.stav in ('todo','probiha','ceka','hotovo','odlozeno','zruseno')` — přesně, nic navíc,
   - `ukoly.zdroj in ('email','claude','rucne','plaud')`,
   - `udalosti.stav in ('novy','pridano','zamitnuto')`,
   - `poznamky.druh in ('poznamka','zapis','hovor')`, `poznamky.zdroj in ('plaud','rucne','claude')`,
   - `schranky.typ in ('uvn','gmail','mediendo')`,
   - `audit.kdo in ('app','claude','beh')`.
7. **Žádná těla zpráv, žádné bajty ani text příloh** (pravidlo 5). `polozky.navrh_telo`
   a `rozepsano_telo` jsou návrh a rozepsaná odpověď — to je práce uživatele, ne tělo zprávy.
   `prilohy_meta jsonb` = jen `[{nazev, typ, velikost, sha}]`.
8. **Rodné číslo se do žádného sloupce nezapisuje** (pravidlo 7). Maskování dělá engine; DB
   nemá kontrolu, která by ho poznala — proto ho nesmí dostat.
9. **Migrace jen dopředné** (pravidlo 10): `supabase/migrations/<timestamp>_<popis>.sql`, jedna
   migrace = jedna věc. Po každé: `supabase gen types typescript --schema doktor
   > src/types/database.ts` a commit obojího.

### A.2 Tabulky

Sloupce podle oddílu 3 plánu; typy doplněné. Systémové sloupce z A.1.2 se neopakují.

| Tabulka | Sloupce | Klíče a indexy |
|---|---|---|
| `schranky` | `typ`, `adresa text unique`, `vychozi_podpis_id uuid → podpisy`, `aktivni bool default true` | — |
| `polozky` | `schranka_id → schranky`, `message_id text`, `vlakno text`, `ref_cache text` (poslední známý `ref` enginu), `od text`, `od_email text`, `predmet text`, `datum timestamptz`, `kategorie text`, `priorita smallint` (1–3), `stav text`, `stav_zdroj`, `co_resit text`, `navrh_predmet text`, `navrh_telo text`, `rozepsano_telo text`, `komu text[]`, `kopie text[]`, `podpis_id → podpisy`, `odeslat_z text`, `prilohy_meta jsonb`, `kontakt_id → kontakty`, `pripad_id → pripady`, `beh_id → behy` | unique `(schranka_id, message_id)`; index `(user_id, stav, priorita)`, `(user_id, datum desc)`, `(kontakt_id)` |
| `ukoly` | `nazev text not null`, `popis text`, `stav`, `odlozeno_do date`, `priorita text`, `termin date`, `cas time`, `druh text`, `oblast text`, `zdroj`, `zdroj_id text`, `claude_projekt text`, `polozka_id → polozky`, `kontakt_id → kontakty`, `kal_uid text`, `poradi int` | unique `(user_id, zdroj_id)`; index `(user_id, stav, poradi)`, `(user_id, termin)` |
| `udalosti` | `polozka_id → polozky`, `nazev text not null`, `zacatek timestamptz not null`, `konec timestamptz`, `celodenni bool default false`, `misto text`, `kalendar text`, `stav`, `kal_uid text`, `kolize jsonb` (`[{nazev, zacatek, konec, kalendar}]`) | index `(user_id, stav, zacatek)` |
| `kontakty` | `jmeno text`, `prijmeni text`, `tituly text`, `organizace_id → organizace`, `role text`, `poznamka text`, `zdroj text`, `profil_psani jsonb` (`{osloveni, tykani, podpis, paticka, jazyk, odesilat_z, spocteno}`), `ulozit_do_kontaktu bool default false`, `carddav_uid text`, `sloucen_do uuid → kontakty` | index `(user_id, prijmeni, jmeno)` |
| `kontakt_adresy` | `kontakt_id → kontakty`, `hodnota text` (lowercase), `primarni bool` | unique `(user_id, hodnota)` |
| `kontakt_telefony` | `kontakt_id`, `hodnota text`, `primarni bool` | unique `(user_id, hodnota)` |
| `organizace` | `nazev text not null`, `domena text` | unique `(user_id, domena)` where domena not null |
| `stitky` | `nazev text` | unique `(user_id, nazev)` |
| `kontakt_stitky` | `kontakt_id`, `stitek_id` | primary key `(kontakt_id, stitek_id)` |
| `poznamky` | `kontakt_id`, `pripad_id`, `text text not null`, `druh`, `zdroj`, `zdroj_id text` | unique `(user_id, zdroj_id)` where zdroj_id not null |
| `vazby_dokumentu` | `kontakt_id`, `zdroj text check in ('priloha','disk')`, `priloha_sha text`, `disk_file_id text`, `nazev text` | check: právě jedno z `priloha_sha`, `disk_file_id` |
| `pripady` | `nazev text not null`, `kontakt_id → kontakty` (odesílající lékař) — po O2 **ano** | index `(user_id, kontakt_id)` |
| `pohledy` | `nazev text`, `filtr jsonb` (`{kontakty[], dotaz, obdobi, schranky[]}`), `pripnuto bool` | — |
| `podpisy` | `nazev text`, `jazyk text`, `html text`, `text text`, `vychozi_pro_schranku uuid → schranky` | — |
| `pravidla` | převzato ze Schránky: `text text`, `kategorie text`, `aktivni bool`, `zdroj text` | — |
| `opravy` | `polozka_id`, `navrh text`, `odeslano_ref text`, `podobnost numeric(4,3)`, `rozdil jsonb`, `zpracovano bool default false` | index `(user_id, zpracovano)` |
| `pouceni` | `text text`, `stav text check in ('navrh','schvaleno','zamitnuto')`, `zdroj_opravy uuid[]` | — |
| `behy` | `zacatek timestamptz`, `konec timestamptz`, `stav text check in ('bezi','hotovo','chyba')`, `schranky text[]`, `pocty jsonb`, `chyba text` | index `(user_id, zacatek desc)` |
| `fronta_claude` | `druh text`, `vstup jsonb`, `stav text check in ('ceka','bezi','hotovo','chyba')`, `vysledek jsonb` | index `(user_id, stav, vytvoreno)` |
| `audit` | `kdo`, `nastroj text`, `vstup_hash text`, `vysledek text`, `cas timestamptz default now()` | **insert-only**: politika `update`/`delete` neexistuje ani pro vlastníka; index `(user_id, cas desc)` |

Sloupec `pravidla` říká plán jen „převzato ze Schránky" — přesnou sadu doplní přenos dat
(K2.5) z artefaktu; zatím `text`, `kategorie`, `aktivni`, `zdroj`.

### A.3 Sloupce navíc proti plánu — každý s důvodem, k odsouhlasení

| Tabulka.sloupec | Proč | Kdo ho čte |
|---|---|---|
| `ukoly.stav_zmenen timestamptz` | „X dní ve sloupci" na kartě kanbanu; nastavuje trigger při změně `stav` | `KanbanCard.stateEnteredAt` |
| `ukoly.stav_zdroj text check in ('klik','schranka','beh')` | pravidlo 4 platí i pro úkoly: stav odvozený ze schránky vs. kliknutí; bez toho `TaskSource.move` nemá kam zapsat, odkud změna přišla | `TaskSource.move` |
| `udalosti.zdroj_id text` + unique `(user_id, zdroj_id)` | běh navrhne tutéž událost ze stejné zprávy dvakrát (7:00 a 13:00) — bez klíče vzniknou dva návrhy | běh, `EventSource` |
| `polozky.odlozeno text` / `signaly_odlozene` | „odložit o 7 dní" a „nerelevantní" na Dnes potřebují někam zapsat, že signál nemá přijít znovu; návrh: tabulka `signaly_odlozene (klic text, akce text, do timestamptz)` unique `(user_id, klic)` | `TodaySource.dismiss` |
| `sablony (nazev, predmet, telo_html, zarazeni, pouzito int)` | plán tabulku šablon nemá, ale komponenty pošty je mají (řádek Komponenty pošty); buď tabulka, nebo šablony = `pravidla` s druhem — rozhodnout | `EmailTemplatesDialog` |

Co tady neodsouhlasíte, se do migrace nedostane a aplikace to pole nechá prázdné.

### A.4 Funkce v databázi

Aplikace čte a zapisuje `ukoly`, `udalosti`, `poznamky`, `kontakty`, `podpisy`, `pohledy`
a metadata `polozky` **přímo přes supabase-js s RLS** (stack v `CLAUDE.md`). Engine se volá jen
tam, kde jde o schránku, kalendář nebo sklad. Dvě věci potřebují funkci v DB:

1. **`doktor.dnes()`** → řádky signálu pro obrazovku Dnes (K3.5): `{klic, urg 1–4, kat
   ('p1'|'termin'|'udalost'|'odpoved'), nazev, proc, dukazy text[], akce jsonb
   [{popisek, ikona, href}], termin date, href}`. Zdroje: `polozky` (P1 = `priorita = 1 and
   stav <> 'hotovo'`; odpoved = `stav = 'ceka'` déle než 2 pracovní dny), `ukoly` (`termin <
   today and stav not in ('hotovo','zruseno')`), `udalosti` (`stav = 'novy'` a `zacatek::date =
   today`). Vynechá klíče v `signaly_odlozene` s `do > now()`. `security invoker`, RLS platí.
2. **`doktor.signal_odlozit(klic, akce)`** → zapíše do `signaly_odlozene` (`done` = navždy,
   `snoozed` = +7 dní, `irrelevant` = navždy). `security invoker`.

Tvar výstupu `dnes()` je v `src/lib/today.ts` (`Signal`). Kde se `proc` a `dukazy` skládají
česky, je to v SQL, ne v aplikaci — aplikace je jen zobrazí.

### A.5 Testy odepření (vzor `supabase/tests` z CRM)

Pro každou tabulku: jako uživatel A založit řádek, jako uživatel B **nevidět, neupravit,
nesmazat**; jako anonymní nevidět nic; `audit` jako vlastník nejde `update` ani `delete`.
`pgTAP` nebo `deno test` — vzít vzor z CRM (`crm/supabase/tests`, commit `831f9ae6`), ne psát
od nuly. Běží v CI před `supabase db push`.

**Hotovo, když (A):** migrace projdou na prázdném projektu i podruhé (idempotentně),
`supabase gen types` vydá `src/types/database.ts`, testy odepření projdou, `tsc` v aplikaci
projde s vygenerovanými typy bez `as never`.

---

## B. REST `/api/v1` enginu (K2.3)

### B.1 Ověření a obálka

1. **Bearer JWT ze Supabase** v každém požadavku. Engine ho ověří proti JWKS projektu
   (`https://<projekt>.supabase.co/auth/v1/.well-known/jwks.json`, cache s TTL), zkontroluje
   `aud = authenticated`, `exp`, a **`sub` musí být v seznamu povolených uživatelů** v konfiguraci
   enginu (`DOKTOR_POVOLENI_UZIVATELE`). Cizí platný JWT = 403.
2. **Bez session aal2 nic** — engine čte claim `aal` a bez `aal2` vrací 403 `mfa_required`.
   MFA je povinné (plán, oddíl 9); aplikace to vynucuje bránou, engine to musí vynutit taky,
   protože aplikace není bezpečnostní opatření.
3. **Obálka:** každá odpověď je JSON `{ok: true, …}` nebo `{ok: false, duvod, chyba?}`.
   `duvod` je krátký kód pro program (`mfa_required`, `neznama_schranka`, `neplatny_ref`,
   `jina_schranka`, `prilohy_nad_strop`, `send_vypnuto`), `chyba` česká věta pro člověka.
   HTTP kódy: 200, 400 (vstup), 401 (bez tokenu), 403 (cizí / bez aal2), 404 (`neplatny_ref`),
   413 (přílohy), 429, 502 (IMAP/SMTP), 500.
4. **CORS** jen pro doménu aplikace (`https://doktor.<doména>`) a `http://localhost:5173`.
5. **Audit:** každé volání do `audit` (`kdo = 'app'`, `nastroj`, `vstup_hash`, `vysledek`)
   přes service role — stejně jako MCP nástroje.
6. **Limity:** 60 požadavků/min na uživatele, `upload` 20 MB na soubor (= `MAX_PRILOHY_MB`),
   `mail_search` `limit ≤ 100`.

### B.2 Cesty a tvary — tenký obal 1 : 1 nad nástroji (rozhodnuto 21. 9.)

`POST /api/v1/<nastroj>` s JSON tělem, **jméno cesty = jméno MCP nástroje, tělo = jeho
parametry, odpověď = jeho výsledek** (zabalený do `{ok: true, …}`, když ho nástroj sám nemá).
Aplikace se přizpůsobila skutečným tvarům nástrojů, jak je MCP vrací 21. 9. 2026
(`src/lib/email/engineMailbox.ts`, `src/lib/events.ts`), takže REST nic nepřejmenovává
a nepřekládá. Překlad id složek z kontraktu (`inbox` → `INBOX`, `archive` → `_Triage/Vyřízeno`)
dělá aplikace. Nástroje, které se vystavují beze změny:

`mail_search`, `mail_get`, `mail_thread`, `mail_prilohy`, `mail_priloha`, `mail_folders`,
`mail_flag`, `mail_move`, `mail_stats`, `mail_najdi`, `mail_kontakty`, `mail_send`, `mail_draft`,
`mail_preposlat`, `cal_calendars`, `cal_events`, `cal_free`, `cal_pridat`.

Co aplikace posílá navíc a nástroj to dnes **nezná** (pydantic by odmítl) — proto se to
posílá jen když je vyplněné a K2.3 to má doplnit:

| Nástroj | Nový parametr | Význam |
|---|---|---|
| `mail_search`, `mail_get`, `mail_folders`, `mail_move`, `mail_stats`, `mail_send`, `mail_draft` | `schranka: 'gmail'` | Gmail jako druhá schránka (ÚKOL 44); ÚVN zůstává výchozí a neposílá se |
| `mail_search` | — | `jen_neprectene` engine nemá (index nezná FLAGS); nepřečtené se poznají až z `priznaky` — přidat `priznaky` do řádků `vysledky` (`\Seen,\Flagged,…` jako u `mail_najdi`) |
| `mail_get` | — | přidat `telo_html` (sanitizované, ÚKOL 36) vedle `telo`; aplikace ho vezme přednostně |
| `mail_send` | `skryta_kopie: string[]`, `html: bool`, `odeslat_z`, `podpis_id`, `prilohy: [{zdroj:'upload', id}]` | skrytá kopie, HTML tělo, „Odeslat z" (varování `jina_schranka`), podpis, přílohy odkazem (ÚKOL 37) |
| `mail_draft` | `ref` ve výsledku | ref uloženého konceptu |
| `mail_stats` | `neprectene` ve výsledku | počet nepřečtených v INBOXu |
| `cal_pridat` | `kal_uid` ve výsledku (nebo `uid`) | UID založené události pro `udalosti.kal_uid` |

Co aplikace posílá **přesně jako nástroj čeká** (kontrola pro K2.3, ať se to nerozejde):
`mail_search {slozka, dotaz, limit, offset}` → `{pocet, vysledky:[{ref, id, datum, smer, od,
komu, kopie, predmet, vlakno, prilohy (názvy čárkou), uryvek}]}`; `mail_get {ref, plne_telo:true}`
→ `{…, message_id, telo}`; `mail_prilohy {ref}` → `{prilohy:[{index, jmeno, typ, bajtu}]}`;
`mail_folders` → `{result:[{name, allowed, special, flags}]}`; `mail_flag {ref, priznak:
'seen'|'flagged', nastavit}`; `mail_move {ref, slozka}` → `{novy_ref, slozka, message_id}` (ÚKOL 35);
`mail_send {komu, kopie, predmet, telo, odpoved_na_message_id, potvrzeni:'ODESLAT'}`;
`cal_calendars` → `{kalendare: string[]}` (název = id); `cal_pridat {kalendar, nazev, datum,
cas, minut, celodenni, misto, zdroj_id, potvrzeni:'PRIDAT'}`.

**Nové cesty**, které nástroje nemají a REST je přidá:

| Cesta | Vstup | Výstup |
|---|---|---|
| `upload` | **multipart**, pole `soubor` (jeden soubor) | `upload_id, nazev, velikost, typ` — sklad enginu s TTL 24 h, dokud se nepoužije v `mail_send`/`mail_draft` |
| `mail_priloha_odkaz` | `ref`, `index` | `url` — **podepsaný odkaz s TTL 10 min**, `GET` bez JWT, stream bajtů z `mail_priloha_soubor` (server-side, ne přes klienta), `Content-Disposition` podle typu |
| `podpisy_seznam` | — | `podpisy: [{id, nazev, jazyk}]` — čte z Supabase přes service role |
| `stav_vlaken` | `polozky: [{message_id, schranka}]` | podle ÚKOLU 38 (pravidlo 4) |

Nevystaveno na REST (a nikdy): `trash`, `delete_folder`, `create_folder`, jakýkoli `expunge`,
`mail_priloha_soubor` (base64 přes klienta), `mail_sync`, `kb_*`, `archiv_*`, `mail_audit`.
Žádná cesta nevrací tělo přílohy jako base64.

**Implementace (návrh, až bude repozitář enginu na GitHubu):** FastAPI router `rest_api.py`
vedle MCP serveru, sdílí registr nástrojů (`call_tool(name, args)`), middleware: JWT/JWKS
(cache 1 h), `aal2`, allow-list `sub`, CORS pro doménu aplikace a `localhost:5173`, limit
60/min, audit. Jeden soubor, žádná duplikace logiky nástrojů.

### B.3 Kde to sedí ke kódu aplikace

| Aplikace | Volá |
|---|---|
| `engineMailbox.listMessages` | `mail_search {slozka, dotaz, limit, offset}` — překlad id složek je v aplikaci (rozhodnuto 21. 9.); stránkování přes `offset` |
| `engineMailbox.getMessage` | `mail_get {ref, plne_telo}` + `mail_prilohy {ref}` když zpráva přílohy má |
| `moveToFolder` / `archiveMessage` | `mail_move`; archiv = `_Triage/Vyřízeno` |
| `sendWithUploads` / `saveDraft` | `mail_send` / `mail_draft` s `prilohy[{zdroj:'upload'}]` |
| `upload` | `upload` multipart |
| `attachmentLink` | `mail_priloha_odkaz` |
| `EventSource.calendars` / `add` | `cal_calendars` / `cal_pridat`; `reject` je jen zápis do `udalosti` přes RLS — **hotovo** (`createSupabaseEventSource`; bez `VITE_ENGINE_URL` kalendáře prázdné, jde jen zamítat) |
| `TodaySource` | `doktor.dnes()` / `doktor.signal_odlozit()` přes supabase-js (A.4), ne REST — **hotovo** (`createSupabaseTodaySource`) |
| `TaskSource` | `ukoly` přes supabase-js; `move` = `update stav, stav_zdroj='klik'` — **hotovo** (`createSupabaseTaskSource`) |

**Hotovo, když (B):** `curl` s platným JWT (aal2) na `mail_search` vrátí zprávy z obou schránek,
s JWT bez aal2 403 `mfa_required`, s cizím JWT 403; `upload` → `mail_send` s `prilohy[{zdroj:
'upload'}]` doručí přílohu (test SHA-256 z ÚKOLU 37); `mail_priloha_odkaz` otevře PDF
v prohlížeči bez tokenu a po 10 minutách odkaz neplatí; obrazovka Pošta v aplikaci s
`VITE_ENGINE_URL` ukáže seznam, detail, odpověď a přílohu bez úprav v kódu obrazovky.

---

## C. Co aplikace už má a na co A i B míří

| V aplikaci | Čeká na |
|---|---|
| `src/lib/email/engineMailbox.ts` (`Wire*`) | B.2 |
| `src/lib/today.ts` (`Signal`, `TodaySource`) | A.4 `dnes()`, `signal_odlozit()`, A.3 `signaly_odlozene` |
| `src/lib/tasks.ts` (`TaskSource`, `KanbanCard`) | `ukoly` + A.3 `stav_zmenen`, `stav_zdroj` |
| `src/lib/events.ts` (`EventSource`, `EventProposal`) | `udalosti` + B.2 `cal_*` |
| `src/lib/notes.ts` (`NoteIntake`) | `poznamky`, `ukoly` (K4.6 — jen tvar) |
| `src/lib/runs.ts` (`Run`) | `behy`, `audit` (K2.7) |
| `src/lib/email/compose.ts` (`EmailTemplate`) | A.3 `sablony` — rozhodnout |
| `src/components/email/EmailContext.tsx` (`load(emails)`) | `kontakty` + `kontakt_adresy` přes RLS, poslední zprávy přes `mail_search(adresy)` |
| `src/lib/supabase/client.ts` (`db.schema: 'doktor'`, bez typů) | A.1.9 `src/types/database.ts` |

Po A a B se v aplikaci udělá **jedna** věc: `supabase gen types`, čtyři zdroje místo
`EMPTY_*`, a ruční průchod podle oddílu 6 plánu. Obrazovky se nemění.

## Co v tomhle zadání není

MCP nástroje 4.2 (`polozka_zapis`, `ukol_zalozit`, `kontakt_*`, `podklady_k_odpovedi` …) — K2.4,
vlastní zadání, ale **nad stejným schématem a stejnými pravidly** z A.1. Přenos dat ze Schránky
(K2.5) čeká na O6. Běhy do nové DB (K2.6, K2.7) a zálohy (K2.8) taky.

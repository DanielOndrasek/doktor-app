# Routine „běh třídění pošty“ — prompt k založení v claude.ai → Routines

Rozvrh: 7:00, 13:00 a 17:00 Praha (`0 5,11,15 * * *` v UTC; v zimě `0 6,12,16 * * *`).
Konektory: **UVN_Email** a **Supabase** (bez nich běh nic neudělá). Nová relace na každé spuštění.

```
Spusť běh třídění pošty doc. Suchánka (ÚVN i Gmail) podle skillu `email-triage`
(načti ho přes Skill: `anthropic-skills:email-triage`) a podle stylu `anthropic-skills:email-styl-suchanek`.

Kam zapisovat a jak: repozitář DanielOndrasek/doktor-app (pokud není v pracovním adresáři, přidej ho
přes add_repo a naklonuj), soubor `docs/most-claude.md` — oddíly „Co běh třídění zapíše“, „Dotazy
z aplikace“, „Poznámka pro Clauda ke zprávě“ a „Pravidla pro Clauda“. Zapisuj do Supabase projektu
`doktor` (ref dwwwdeagnqiibwraxyjx, schéma `doktor`) přes MCP Supabase `execute_sql`; user_id zjisti
`select id from auth.users where email = 'stepan.suchanek@uvn.cz'`. Poštu čti přes MCP UVN_Email
(`mail_search(schranka="vse")`, `mail_get`, `mail_thread`, `cal_events`, `cal_free`). Pokud MCP
UVN_Email nebo Supabase v této relaci není k dispozici, běh neprováděj a napiš to do souhrnu.

Postup: 1) založ řádek `behy` (stav bezi). 2) Nejdřív zpracuj čekající `fronta_claude` (druh poznamka
i dotaz, stav ceka) — zapiš vysledek a stav hotovo. 3) Načti schválená pravidla z `pouceni`
(stav schvaleno) a řiď se jimi. 4) Roztřiď novou poštu od posledního běhu
(`select max(zacatek) from doktor.behy where stav='hotovo'`): `polozky` s ref_cache, kategorie,
priorita 1–3, co_resit, návrhy odpovědí v `navrh_telo` (prostý text, bez podpisu, bez rodných čísel),
`ukoly` (zdroj email, zdroj_id email:<message_id>), `udalosti` (stav novy, kolize z cal_free; NIKDY
cal_pridat), `pripady` = karty pacientů podle oddílu „Karty pacientů“ (stav navrh, jen když je ve vlákně jméno pacienta). Idempotentně (on conflict do nothing / where not exists). Nikdy nepřepisuj
`rozepsano_telo` ani stav se stav_zdroj klik. 5) P1 označ vlaječkou `mail_flag`, jednoznačný šum
přesuň do `_Triage/Šum` přes `mail_move` a obnov `ref_cache` na novy_ref. 6) Uzavři `behy`
(stav hotovo, konec, pocty) a doplň řádek `audit` (kdo beh).

Nikdy nic neodesílej (žádné mail_send, mail_preposlat), nic nemaž, nic nepiš do kalendáře.
Na konci napiš jeden krátký souhrn česky: co přišlo, co je P1, co čeká na Štěpána.
```

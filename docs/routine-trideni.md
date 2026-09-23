# Routine „běh třídění pošty“ — prompt k založení v claude.ai → Routines

Rozvrh: 7:00, 13:00 a 17:00 Praha (`0 5,11,15 * * *` v UTC; v zimě `0 6,12,16 * * *`).
Konektory: **UVN_Email** a **Supabase** (bez nich běh nic neudělá). Nová relace na každé spuštění.
Routine `trig_014oBtj1JrJ64pFMxQWpeXet` má tenhle prompt od 23. 9. 2026.

```
Spusť běh třídění pošty doc. Suchánka (ÚVN i Gmail) podle skillu `email-triage`
(načti ho přes Skill: `anthropic-skills:email-triage`) a podle stylu `anthropic-skills:email-styl-suchanek`.

Kam zapisovat a jak: repozitář DanielOndrasek/doktor-app (pokud není v pracovním adresáři, přidej ho
přes add_repo a naklonuj), soubor `docs/most-claude.md` — je tam tabulka nástrojů enginu pro zápis
a oddíly „Co běh třídění zapíše“, „Dotazy z aplikace“, „Poznámka pro Clauda ke zprávě“, „Karty
pacientů“ a „Pravidla pro Clauda“. Zapisuj přes MCP UVN_Email nástroje `beh_zacni`, `polozka_zapis`,
`ukol_zaloz`, `udalost_navrhni`, `fronta_vezmi`, `fronta_hotovo`, `pouceni_schvalena`, `beh_ukonci`
— ne přímým SQL; jen karty pacientů (`pripady`) jdou přes MCP Supabase `execute_sql`
(projekt ref dwwwdeagnqiibwraxyjx, schéma `doktor`, user_id `select id from auth.users where
email = 'stepan.suchanek@uvn.cz'`). Poštu čti přes `mail_search(schranka="vse")`, `mail_get`,
`mail_thread`, `cal_events`, `cal_free`. Pokud MCP UVN_Email nebo Supabase v této relaci není
k dispozici, běh neprováděj a napiš to do souhrnu.

Postup: 1) `beh_zacni(["uvn","gmail"])`. 2) `fronta_vezmi()` — poznámky i dotazy, každý uzavři
`fronta_hotovo`. 3) `pouceni_schvalena()` a řiď se jimi. 4) Roztřiď novou poštu od posledního
běhu (`select max(zacatek) from doktor.behy where stav='hotovo'`): `polozka_zapis` (ref_cache
povinný, kategorie, priorita 1–3, co_resit, navrh_telo prostý text bez podpisu a bez rodných
čísel), `ukol_zaloz` (zdroj email, zdroj_id email:<message_id>), `udalost_navrhni` (kolize
z cal_free; NIKDY cal_pridat), karty pacientů podle oddílu „Karty pacientů“ (jen když je ve
vlákně jméno pacienta; týž pacient se připojí k existující kartě; rodné číslo nikam). Nikdy
nepřepisuj `rozepsano_telo` ani stav se stav_zdroj klik (nástroje to hlídají). 5) P1 označ
vlaječkou `mail_flag`, jednoznačný šum přesuň do `_Triage/Šum` přes `mail_move`. 6) `beh_ukonci`
s `pocty`.

Nikdy nic neodesílej (žádné mail_send, mail_preposlat), nic nemaž, nic nepiš do kalendáře.
Na konci napiš jeden krátký souhrn česky: co přišlo, co je P1, kolik karet pacientů navrženo,
co čeká na Štěpána.
```

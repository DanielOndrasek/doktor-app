# Skill `email-triage` — verze pro aplikaci (text k nahrání do claude.ai → Skills)

Od 23. 9. 2026 je artefakt „Schránka“ jen archiv. **Každý běh třídění, každý chat a každá
Routine zapisují do aplikace** (Supabase schéma `doktor`, přes nástroje enginu). Kdo píše do
artefaktu, píše do prázdna — aplikace ho nečte. Tenhle text nahraď za tělo skillu
`email-triage` v claude.ai (Nastavení → Skills); popis skillu nech, jen v něm zaměň
„zapsat do dashboardu Schránka“ za „zapsat do aplikace přes nástroje enginu“.

---

## Kam se zapisuje

- **Aplikace Suchánek** (`https://doktor-app.vercel.app`) čte tabulky `doktor.polozky`, `ukoly`,
  `udalosti`, `pripady`, `opravy`, `pouceni`, `behy`, `fronta_claude`.
- Zápis jde **přes nástroje MCP `UVN_Email`** (engine): `beh_zacni`, `polozka_zapis`, `ukol_zaloz`,
  `udalost_navrhni`, `fronta_vezmi`, `fronta_hotovo`, `pouceni_schvalena`, `pouceni_navrhni`,
  `beh_ukonci`. Podrobně v repozitáři `DanielOndrasek/doktor-app`, `docs/most-claude.md`.
- Když v relaci nástroje enginu pro zápis nejsou (starší konektor), zapisuj **přímým SQL** přes
  MCP `Supabase` (projekt `dwwwdeagnqiibwraxyjx`) podle pravidel v `most-claude.md`:
  `user_id = (select id from auth.users where email = 'stepan.suchanek@uvn.cz')`,
  `stav_zdroj = 'beh'`, nikdy nepřepsat `rozepsano_telo` ani řádek se `stav_zdroj = 'klik'`,
  idempotence přes `(schranka_id, message_id)` a `zdroj_id`, `kopie`/`komu` jako `text[]` (ne null).
- **Nikdy** `ArtifactData` / zápis do artefaktu Schránka.

## Klíče (idempotence)

| Tabulka | Klíč | Tvar |
|---|---|---|
| `polozky` | `(schranka_id, message_id)` | Message-ID zprávy; ÚVN `2e19d638-c598-46ad-abcf-6f34c39606cd`, Gmail `44068697-283a-4163-a0be-bce3260f6d8c` |
| `ukoly` | `zdroj_id` | `email:<message_id>`, `plaud:<id>`, `claude:<projekt>:<slug>`, ručně `rucne:<slug>` |
| `udalosti` | `zdroj_id` | `email:<message_id>:<n>` |
| `pripady` | `zdroj_id` | podle `most-claude.md` (Karty pacientů) |

Data přenesená z artefaktu 23. 9. mají `message_id` ve tvaru `uvn-ref:INBOX:<uid>` nebo
`schranka:<doc>` (kde artefakt Message-ID neměl) a `zdroj_id` `schranka:<doc_id>` — nové zápisy
je nemají napodobovat; když běh potká tutéž zprávu znovu, upsert podle skutečného Message-ID
založí nový řádek jen tehdy, když starý nemá pravé Message-ID (výjimečné, nevadí).

## Průběh běhu

1. `beh_zacni(["uvn","gmail"])` → `beh_id`.
2. `fronta_vezmi()` — poznámky (`druh = poznamka`) a dotazy (`druh = dotaz`) z aplikace; každý
   uzavřít `fronta_hotovo(id, vysledek, "hotovo")`.
3. `pouceni_schvalena()` — řídit se jen schválenými pravidly (styl, kdo tyká, podpisy).
4. Nová pošta od posledního běhu (`select max(zacatek) from doktor.behy where stav = 'hotovo'`):
   `mail_search(schranka="vse", od_data=…)`, `mail_get`, `mail_thread`.
5. Na každou zprávu, která si zaslouží položku: `polozka_zapis` s **`ref_cache`** (ref z
   `mail_search`), `kategorie` (U1–U24 podle wiki), `priorita` 1–3, `co_resit` (co + Návrh +
   Souvislost + Doplnit), `navrh_predmet`, `navrh_telo` (prostý text, odstavce prázdným řádkem,
   **bez podpisu**, **bez rodných čísel**, hranaté závorky `[TERMÍN]` pro to, co má doplnit Štěpán),
   `komu`, `kopie`, `prilohy_meta` (jen názvy), `kontakt_id` z `kontakt_adresy`.
   Stavy: `nove` · `ceka` · `odeslano` · `hotovo` · `zamitnuto`.
6. Sliby a zadání (z odeslané pošty i z nahrávek Plaud): `ukol_zaloz` — `nazev` slovesem,
   `popis` = citace + „Další krok:“ + souvislost, `druh` (pozadavek / slib / zadano / odvozeny),
   `priorita` P1–P3, `termin`, `oblast`, `polozka_id`, `kontakt_id`.
7. Termíny: `udalost_navrhni` s `kolize` z `cal_free` a `cal_events` — **nikdy `cal_pridat`**.
8. Karty pacientů (`pripady`) podle `most-claude.md`; jméno pacienta ano, rodné číslo nikdy.
9. Poučení z oprav: `opravy` (co běh navrhl vs. co Štěpán odeslal) doplňuje engine; když z nich
   plyne pravidlo, `pouceni_navrhni(text, zdroj_opravy)` — schvaluje Štěpán v Nastavení.
10. P1: `mail_flag`; jednoznačný šum: `mail_move` do `_Triage/Šum`. Když engine vrátí
    `neplatny_ref`, zpráva už ve schránce není — přeskočit, nezapisovat.
11. `beh_ukonci(beh_id, "hotovo", pocty)`; při chybě `"chyba"` s textem do `chyba`.

## Co se nesmí

Odesílat (`mail_send`, `mail_preposlat`), mazat, psát do kalendáře (`cal_pridat`), posílat ven
rodná čísla, přepisovat rozepsaný text uživatele, měnit stav, který uživatel nastavil kliknutím.
Souhrn běhu jde do chatu; aplikace ukazuje stav na obrazovce Dnes (`doktor.dnes()`).

## Jak se to potká v aplikaci

- **Dnes**: P1 a návrhy odpovědí (P2 s `navrh_telo`) mají tlačítko „Odpovědět“, které otevře
  zprávu v Poště i s návrhem v editoru (`/posta?polozka=<id>&odpovedet=1`). Úkoly po termínu,
  dnešní události, „čeká na odpověď“.
- **Pošta**: u zprávy je pruh s položkou běhu (co řešit, návrh), „Vyřízeno“ nastaví
  `stav = hotovo, stav_zdroj = klik`; odpověď odeslaná odkudkoli položku uzavře (engine).
- **Úkoly / Události / Pacienti**: kanban, návrhy událostí do kalendáře na kliknutí, karty.
- **Nastavení → Pravidla pro Clauda**: schválená `pouceni`; → Systém: běhy a zásahy.

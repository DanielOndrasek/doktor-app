# Zadání serveru: co aplikace v1 potřebuje od enginu (K2.4–K2.8, ÚKOLy 47–53)

Vzniklo 22. 9. 2026 po dokončení aplikace K3 (`doktor-app`, commit `0ccbe47`). **Zadání pro
Claude Code na serveru `uvn-mail-mcp`** (`/opt/uvn-mail-mcp`). Navazuje na
`zadani-serveru-doktor-k1.md` (ÚKOLy 35–41), `zadani-serveru-doktor-gmail.md` (42–46)
a `zadani-k2-schema-a-rest.md` (schéma, REST). Číslování pokračuje. Platí stejná pravidla:
žádný `expunge()`, nic se nemaže, maskování rodných čísel jednou implementací, `potvrzeni`
a `SEND_ENABLED` u všeho, co odesílá, audit, testy, zápis do `docs/stav-serveru.md`.

**Jak aplikace s enginem mluví dnes** (ať se nic nerozbije): REST `/api/v1/<nástroj>` s JWT
ze Supabase, obálka `{ok, …}` / `{ok:false, kod, chyba}`, REST odmítá neznámé parametry
(`neznamy_parametr`). Aplikace volá `mail_search(schranka="vse")`, `mail_get`, `mail_thread`,
`mail_prilohy`, `mail_priloha_odkaz`, `upload`, `mail_send` s `prilohy: [{zdroj: "upload", id}]`,
`mail_draft`, `mail_move`, `mail_flag`, `mail_preposlat`, `cal_*`, `podpisy_seznam`. Cokoli z toho
změní tvar odpovědi, je změna kontraktu — přidávat pole ano, přejmenovávat ne.

**Pořadí je závazné, podle toho, co aplikaci nejvíc chybí:**
47 (přeposlání Gmail) → 48 (JSON v auditu, hodina práce) → 49 (stav ze schránky, K2.6)
→ 50 (dokončit ÚKOL 44) → 39 → 40 → 41 (z K1, nezměněno) → 51 (přílohy z jiného mailu)
→ 52 (hlídač běhů, K2.7) → 53 (zálohy, K2.8) → 54 (MCP nástroje, K2.4).

---

## ÚKOL 47 — `mail_preposlat` pro obě schránky

**Proč:** Aplikace má tlačítko Přeposlat (přeposílá s původními přílohami přes
`mail_preposlat`), ale nástroj nezná `schranka` ani `odeslat_z`: `fetch_raw(folder, uid)`
i `send_message(msg)` jdou na ÚVN. U Gmail zpráv aplikace tlačítko schovává.

**Co:**
1. `mail_preposlat(ref, komu, telo, zpusob="cast", potvrzeni="", schranka="uvn",
   odeslat_z="", kopie=None, skryta_kopie=None, html=False)`. Schránka původní zprávy se
   pozná z `ref` stejně jako u `mail_get` (`[Gmail]/…` → gmail), parametr `schranka` je jen
   pojistka. `odeslat_z` určuje schránku odeslání jako u `mail_send` (jiná než původní →
   `varovani: ["jina_schranka"]`, pravidlo 8). `kopie`/`skryta_kopie` jako u `mail_send`.
   `html=True`: `telo` je HTML, textová alternativa se odvodí (aplikace dnes posílá text).
2. `$Forwarded` na originálu v té schránce, kde zpráva je (Gmail přes IMAP na
   `[Gmail]/Všechny zprávy:<uid>`); `priznak_nastaven` ve výsledku.
3. Kopie do Sent dané schránky odeslání (Gmail si ji ukládá sám přes SMTP).
4. Výsledek nese navíc `schranka`, `odeslano_z`, `varovani[]` — aplikace je už čte.

**Hotovo, když:** přeposlání Gmail zprávy s přílohou na sebe projde, příloha dorazí, originál
má `$Forwarded`, ÚVN chování beze změny; `tests/test_preposlat.py` s falešným IMAP/SMTP.
V aplikaci pak stačí vrátit `forwardSupported` → `true` (`src/lib/email/engineMailbox.ts`).

## ÚKOL 48 — `audit.vysledek` vždy JSON

**Proč:** Část volání `_audit` zapisuje Python `repr` (`{'ok': True, 'schranka': 'uvn', …}`),
část `json.dumps`. Aplikace (`src/lib/runs.ts`) čte obojí, ale je to křehké a do Supabase
`doktor.audit` jde totéž.

**Co:** Jediná cesta: `_audit(tool, args, result: dict | str)` sám udělá
`json.dumps(result, ensure_ascii=False)` (u `str` ho zabalí do `{"text": …}`), zkrácení na
limit až po serializaci; všechna volání přes `str(res)` / `repr` odstranit. Nikdy do auditu
těla zpráv, hesla, tokeny, rodná čísla (maskovat před zápisem).

**Hotovo, když:** `select count(*) from doktor.audit where vysledek like '{''%'` po nasazení
neroste; test, který projde všechna volání `_audit` v `app/` a odmítne ne-JSON.

## ÚKOL 49 — stav ze schránky do `polozky` (K2.6, pravidlo 4)

**Proč:** Odpověď odeslaná z Mailu nebo iPhonu má položku uzavřít stejně jako odeslání
z aplikace. `stav_vlaken` to umí spočítat, ale nikdo ho pravidelně nevolá — dnes to dělá
Claude ručně při běhu.

**Co:**
1. Úloha v `_sync_loop` po každém syncu (nebo každých `STAV_INTERVAL_SECONDS`, výchozí 900):
   načte z Supabase `polozky` se `stav in ('nove','ceka')` (service role, jen sloupce
   `id, message_id, schranka_id, stav, stav_zdroj`), zavolá `stav_vlaken` a u zodpovězených
   zapíše `stav = 'odeslano', stav_zdroj = 'schranka'`. **Nikdy nepřepisuje** řádek se
   `stav_zdroj = 'klik'` (klik má přednost) ani `rozepsano_telo`.
2. Po `mail_move` (přesun z aplikace i z běhu) obnovit `polozky.ref_cache = novy_ref` podle
   `message_id` — aplikace to dělá jen pro svůj přesun, běh pro svůj; engine to má dělat
   vždy, je jediný, kdo přesun vidí.
3. `\Answered` po `mail_send` s `odpoved_na_message_id` už engine nastavuje; zkontrolovat,
   že to platí i pro Gmail (`odpoved_na_ref` v `[Gmail]/Všechny zprávy`).
4. Každý zápis do Supabase jde do `audit` (`kdo = 'beh'`, `nastroj = 'stav_ze_schranky'`,
   `vysledek = {"uzavreno": n, "ref_obnoven": m}`).

**Hotovo, když:** odpověď na testovací zprávu odeslaná z Apple Mail do 15 minut přepne
položku na `odeslano` / `schranka` a aplikace ji ukáže jako uzavřenou; položka odškrtnutá
v aplikaci (`klik`) zůstane, i když ve schránce odpověď není.

## ÚKOL 50 — dokončit ÚKOL 44 (Gmail ve všech nástrojích)

Podle `docs/stav-serveru.md` zbývá: bod 1 (`schranka="gmail"` v `mail_thread`, `mail_kontakty`,
`mail_style_sample`, `kontakt_profil`), bod 2 (`schranky: [...]` + jeden `dalsi_strana` místo
`offset`), bod 5 (`stav_vlaken` hledá odpověď v obou Sent — nutné pro ÚKOL 49),
`mail_get(schranka="gmail")` z indexu místo živého IMAPu (aplikaci trvá detail Gmail zprávy
2–4 s), `mail_move` na Gmailu obnovit `gm_labels` hned. `offset` zachovat pro zpětnou
kompatibilitu (aplikace ho používá jako `pageToken`), `dalsi_strana` přidat vedle.

## ÚKOL 39, 40, 41 — beze změny

Zadání v `zadani-serveru-doktor-k1.md`. Doplnění pro 39: výstup `opravy_sber` se **zapisuje do
Supabase** `doktor.opravy` (`polozka_id, navrh, odeslano_ref, podobnost, rozdil, zpracovano=false`,
service role, `user_id` povinný) a z každé dávky s podobností pod 0,7 vznikne návrh poučení
do `doktor.pouceni` (`text`, `stav='navrh'`, `zdroj_opravy = array[id oprav]`). Lékař je
schvaluje v aplikaci (Nastavení → Pravidla pro Clauda); engine i Claude čtou jen `schvaleno`.
Pro 41 beze změny: skript dá jen podklad do wiki, podpisy zakládá lékař v aplikaci (O5).

## ÚKOL 51 — přílohy z jiného mailu (K3.4)

**Proč:** Okno psaní má „příloha z jiného mailu" v plánu; engine bere jen
`{zdroj: "upload", id}`.

**Co:** `prilohy[]` u `mail_send`, `mail_draft` (a po ÚKOLU 47 i `mail_preposlat`) přijme
`{zdroj: "zprava", ref, index}` — bajty se vezmou z IMAPu (nebo ze skladu příloh, až bude K4.3)
přímo na enginu, přes aplikaci ani přes Clauda nikdy neprojdou (pravidlo 2). Kontrola: `ref`
musí patřit uživateli (obě schránky jsou jeho), `index` z `mail_prilohy`. Signatura
`prilohy: list[dict]` se nemění, jen validace zdroje. Výsledek nese u každé přílohy `zdroj`.

**Hotovo, když:** koncept s přílohou z cizí zprávy vznikne v Konceptech s bajty shodnými
s originálem (sha256); REST test.

## ÚKOL 52 — hlídač běhů a fronty (K2.7)

**Proč:** Běhy třídění spouští Claude (Routine 7:00 / 13:00 / 17:00). Když nepřijde, aplikace
to sice ukáže (Dnes varuje po 26 h), ale nikdo se to nedozví, dokud ji neotevře.

**Co:** `tools/hlidac_behu.py` v cronu enginu každou hodinu: (1) `doktor.behy` — poslední
`stav='hotovo'` starší než 8 h v pracovní den (7–19 h) → varování; běh ve stavu `bezi` déle
než 1 h → varování; (2) `doktor.fronta_claude` — řádek `ceka` starší než 24 h → varování.
Varování = řádek `audit` (`kdo='beh'`, `nastroj='hlidac'`, `vysledek` JSON s důvodem) a
**e-mail sám sobě** (`mail_send` na `stepan.suchanek@uvn.cz` z ÚVN, předmět „Doktor: běh
nepřišel", `potvrzeni='ODESLAT'` — jediná výjimka z „nic se neodesílá samo", odsouhlasit se
Štěpánem; jinak jen audit + wiki `kb_upsert`). Nejvýš jedno varování za 6 h na druh.

**Hotovo, když:** simulovaný výpadek (žádný běh 9 h) vytvoří řádek auditu a jeden e-mail;
druhý běh hlídače nic nepošle.

## ÚKOL 53 — zálohy (K2.8)

**Co:** noční cron: `pg_dump` Supabase (connection string jen v `.env`, schéma `doktor` +
`auth` bez hesel? — `auth` ne, jen `doktor`), `data/mail.db`, `data/archiv.db`, `data/kb/`
→ `tar`, šifrovat (`age` nebo gpg s klíčem v `.env`), uložit lokálně (7 dní) a přes `rclone`
na Disk do složky, kterou určí Štěpán (O9; do rozhodnutí lokálně + druhý disk Hetzneru).
Rodná čísla v `mail.db` jsou v tělech zpráv → záloha musí být šifrovaná vždy. Obnova
zdokumentovaná v `docs/stav-serveru.md` a jednou vyzkoušená.

**Hotovo, když:** ranní záloha existuje, `restore` do prázdného adresáře projde a
`mail_stats` nad obnovenou kopií sedí s produkcí.

## ÚKOL 54 — MCP nástroje nad Supabase (K2.4)

**Proč:** Claude dnes zapisuje do Supabase přímým SQL z chatu (`docs/most-claude.md`). Nástroje
na enginu dají jednu implementaci pravidel: `user_id` vždy, idempotence přes `zdroj_id`,
nikdy `rozepsano_telo`, nikdy stav přes `klik`, nikdy rodné číslo, audit.

**Co (podle plánu 4.2, tenké obaly nad service role):**
`beh_zacni(schranky[]) → beh_id`, `beh_ukonci(beh_id, stav, pocty, chyba)`,
`polozka_zapis(beh_id, polozka{…}) → id` (upsert podle `(schranka_id, message_id)`, `stav` jen
když není `klik`), `ukol_zaloz(ukol{…})` (upsert `zdroj_id`), `udalost_navrhni(udalost{…})`
(nikdy `cal_pridat`), `fronta_vezmi(druh?) → [{id, vstup}]`, `fronta_hotovo(id, vysledek, stav)`,
`pouceni_schvalena() → [text]`, `pouceni_navrhni(text, zdroj_opravy[])`,
`podklady_k_odpovedi(message_id)` (úrovně z O1; K4.7, může být později).
Každý nástroj: validace rodných čísel v textových polích (odmítnout, ne maskovat — do DB
nesmí), `audit` řádek, REST **nevystavovat** (aplikace to nepotřebuje).

**Hotovo, když:** běh třídění z chatu projde jen přes tyhle nástroje bez jediného
`execute_sql`; `docs/most-claude.md` v `doktor-app` se přepíše na nástroje (udělá aplikace).

## ÚKOL 55 — rychlý seznam pošty: levnější živé příznaky (doplněno 23. 9. 2026)

**Proč:** seznam v aplikaci trval sekundy. REST si u `mail_search` vynucuje `zive_priznaky=True`
(`REST_VYCHOZI` v `app/rest_api.py`), a to znamená při každém seznamu nové IMAP přihlášení k ÚVN
a k Gmailu za sebou (~2,4 s podle `docs/stav-serveru.md`), zatímco z indexu je seznam za 5 ms.
Aplikace od 23. 9. posílá `zive_priznaky` výslovně: seznam nejdřív `false` (index), pak na pozadí
`true` (příznaky). Živé příznaky tedy zůstávají, jen ať jsou levné.

**Co:**
1. `mail_search` se `zive_priznaky=True`: ÚVN a Gmail číst **souběžně** (dnes `for` smyčka za
   sebou), IMAP timeout pro čtení FLAGS snížit z 60 s na ~5 s (při chybě se vrátí index, jako dnes).
2. `UPDATE messages SET flags` jen u řádků, kde se příznak opravdu změnil — dnes se přepisuje
   všech 30 řádků a každý spouští FTS trigger s celým `body_clean`; a `WHERE schranka, folder, uid`
   u Gmailu prochází všechny řádky složky `[Gmail]/Všechny zprávy` (index jen na `folder`).
   Doplnit index `(schranka, folder, uid)`.
3. Sync ÚVN aktualizovat FLAGS i u už stažených zpráv v INBOXu (dnes `sync_folder` bere jen UID
   nad `last_uid`, takže `\Seen` z ÚVN v indexu zamrzne na stavu při prvním stažení). Stačí
   posledních ~200 UID při každém syncu. Pak může aplikace časem živé příznaky vypnout úplně.
4. `mail_folders` a `mail_stats` dnes při každém volání přihlašují k IMAPu — cache na enginu
   60 s (aplikace si je cachuje 15 min, ale Claude ne).
5. Volitelně: `mail_get` s `format=html` stahuje celé RFC822 živě (Gmail 2–4 s); u zpráv už
   jednou stažených držet sanitizované HTML v indexu (`body_html`), ať je detail z indexu.

**Hotovo, když:** `mail_search(schranka="vse", limit=30, zive_priznaky=True)` pod 1 s
(změřit, zapsat do `docs/stav-serveru.md`), po přečtení zprávy v Mailu ÚVN se do 10 minut
změní `flags` v indexu bez živého čtení, `mail_folders` podruhé za minutu bez IMAP přihlášení.

---

## Co v tomhle zadání není

K2.5 přenos dat ze Schránky (čeká na O6). K4.3 sklad příloh a OCR. Disk dovnitř (O9).
CardDAV. Vlastní doména a CSP (aplikace, Vercel). Routine pro běhy (claude.ai, ne engine).

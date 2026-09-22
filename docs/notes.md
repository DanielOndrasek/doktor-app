# Poznámky

Sem patří, na co se narazí mimo aktuální etapu. Nezdržuj se tím — zapiš a pokračuj.

Formát: datum, jedna až tři věty, a kam to patří (fáze nebo rozhodnutí).

---

**20. 9. 2026 — založení repozitáře.** Repozitář vznikl jako kostra pro K3. Kód se sem
zatím nepíše: čeká se na engine (K1) a na databázi s rozhraním (K2), a hlavně na
rozhodnutí O3 a O4. Co je hotové: pravidla v `CLAUDE.md`, zdrojové dokumenty v `docs/`,
kontrakt chování „Vrátit zpět“ v `docs/prevzato/`.

**20. 9. 2026 — kopie z vividbooks.** Převzaté jsou první tři řádky
`docs/prevzeti-z-vividbooks.md`: UI kit, vzhled a tokeny, kontrakt `MailboxClient`.
Rozhodnutí o odstřižených importech a o odchylkách jsou v oddílu „Co se při kopírování
rozhodlo" tamtéž. Pro K3 dál platí, že se čeká na O3 a O4.

**20. 9. 2026 — react-day-picker v9 (pro K3).** CRM je na v8, která nepodporuje React 19,
takže `calendar.tsx` a `date-picker.tsx` jsou přepsané na v9. Až se bude přebírat Úkoly
a Události, jejich pickery (`TaskDeadlinePicker` a spol.) budou chtít stejné přepsání —
v8 API (`fromDate`, `toDate`, `captionLayout="buttons"`) v tomhle repozitáři neexistuje.

**20. 9. 2026 — komponenty pošty a kanban.** Řádky 5 a 9 převzaté; odchylky v oddílu
„Co se při kopírování rozhodlo". `EmailCompose` posílá přílohy jako `uploadIds` (ne
base64) — vyřešeno 21. 9. v `engineMailbox.ts`: `sendWithUploads` je mapuje na
`prilohy: [{zdroj: "upload", id}]`, kontrakt `MailboxClient` zůstal nedotčený.
`KanbanCard` je projekce řádku `ukoly`; mapování napíše obrazovka Úkoly (K3.6), až
budou typy z K2.

**20. 9. 2026 — šablony zpráv (K2).** Schéma `doktor` v plánu nemá tabulku šablon,
ale řádek Komponenty pošty nese `EmailTemplatesDialog`. Dialog je props-driven
(`EmailTemplate` v `lib/email/compose.ts`); kde se šablony uloží, je otázka pro K2
vedle `podpisy` a `pravidla`.

**20. 9. 2026 — přihlášení (O3, O4).** Řádek Přihlášení převzatý; kód čeká na projekt
Supabase. Až bude (O3): zapnout TOTP MFA v Auth, nastavit `password_min_length = 12`,
přidat `<doména>/reset-hesla` do redirect allow-listu (O4) a doplnit e-mailovou šablonu
obnovy hesla. Účet uživatele se zakládá ručně v Supabase — aplikace registraci nemá
a mít nebude.

**20. 9. 2026 — obrázky v podpisu (K3.3).** `SignatureEditor` nahrává obrázky přes
`onUploadImage`; kam, není rozhodnuté. Pravidlo 5 mluví o tělech a přílohách, obrázek
podpisu je něco mezi — nejjednodušší je nechat ho na enginu vedle příloh (`upload_id`
+ veřejná URL), ať Supabase drží jen `podpisy.html`. Rozhodnout s O3.

**20. 9. 2026 — signály pro Dnes (K2).** `crm.today_signals()` v `831f9ae6` není (jen
volání a typ), takže vzor je tvar řádku, ne SQL. Pro K2 to znamená napsat funkci
`doktor.dnes()` od nuly nad `polozky` (P1, čeká na odpověď), `ukoly` (po termínu)
a `udalosti` (dnes) — a `signal_dismiss` s odložením o 7 dní. Tvar výstupu je
v `src/lib/today.ts`.

**21. 9. 2026 — Zápisy jsou K4.6.** Komponenty `notes/` jsou převzaté (K3.1 kopie), ale
zapojení ke kontaktům je K4.6 a příjem z Plaudu (`plaud-intake` v `831f9ae6` není) se
navrhne v K2 vedle `poznamky`. V K3 se do Dnes nezapojují.

**21. 9. 2026 — běhy a zásahy (K2.7, K3.9).** `RunsHistory` čeká na `behy` + `audit`.
Tvar řádku (`Run` v `src/lib/runs.ts`) má navíc `source` a `state`, protože Doktor musí
vidět i běh, který nedoběhl — CRM to nepotřebovalo. `agent_commands` z tabulky převzetí
v `831f9ae6` není; vzor je `agent_runs`.

**21. 9. 2026 — `engineMailbox.ts` čeká na K2.3.** Klient je napsaný proti nástrojům
enginu a tvarům z K1. Co K1 nezadává, je v `Wire*` typech na jednom místě: názvy polí
seznamu zpráv (`ref, vlakno, od, komu, predmet, datum, datum_ms, ukazka, priznaky`),
stránkování (`strana` / `dalsi_strana`), složky (`standardni`, `vlastni`), `mail_stats`
→ `neprectene`, `upload` → `upload_id`, a `mail_priloha_odkaz` → `{url}` (krátkodobý podepsaný odkaz — bearer JWT se do `<a href>`
nedá, proto odkaz podepisuje engine). Až K2.3 řekne jinak, mění se jen `engineMailbox.ts`. Obrazovka Pošta
(`/posta`) ho zapojuje přes `createEngineMailboxFromEnv(getToken, schranka)`; bez
`VITE_ENGINE_URL` ukáže pruh „engine není propojený". Podpis, adresář, šablony a kontext
se do ní doplní, až budou zdroje z K2.

**21. 9. 2026 — Úkoly nad prázdným zdrojem (K3.6).** `/ukoly` má kanban; `TaskSource`
v `src/lib/tasks.ts` čeká na K2 (`load` = řádky `ukoly` → `KanbanCard`, `move` = nový
`stav` + `stav_zdroj = klik`). Bez „+" a bez detailu úkolu — obojí potřebuje zápis do
`ukoly`. Seznam po termínech a kalendář jsou další dva pohledy téže obrazovky.
*Doplněno 21. 9. večer:* `createSupabaseTaskSource()` čte `ukoly` (bez `zruseno`, řazení
`poradi, termin, vytvoreno`, jméno kontaktu přes vztah `kontakty`) a `move` zapisuje
`stav` + `stav_zdroj = 'klik'`; `stav_zmenen` drží trigger. Zakládání a detail úkolu
(`?ukol=`) zůstávají — karta na něj odkazuje, obrazovka ho zatím neumí.

**21. 9. 2026 — Události nad prázdným zdrojem (K3.7).** `/udalosti` ukazuje návrhy
z mailů ve stavech nové · přidané · zamítnuté s kolizemi a zápisem do kalendáře jen
z tlačítka. `EventSource` v `src/lib/events.ts` čeká na K2: `load` = řádky `udalosti`,
`calendars` = vrstvy kalendářů (jména dodá engine, `cal_calendars` — tady se nevymýšlejí),
`add` = `cal_pridat` + `kal_uid` + `stav = pridano`, `reject` = `stav = zamitnuto`.
Vlastní události a jejich úpravy jsou O7/K5. Nic z toho není z CRM — to mělo jen Google
kalendář a `task_gcal_sync`, který se nepřebírá.

**21. 9. 2026 — Gmail bez OAuth (O4 rozhodnuto).** Štěpán má osobní Gmail; interní aplikace
ani neověřený externí projekt nejdou. IMAP/SMTP s heslem aplikace na enginu, viz `rozhodnuti.md`. Pro engine (K1/K2) to znamená druhý IMAP účet a Gmail specifika (štítky,
All Mail, `X-GM-THRID`); pro aplikaci nic — `engineMailbox` už `schranka = gmail` umí.
Řádky Gmail klient a Gmail OAuth v tabulce převzetí přešly do Nepřebírat.

**21. 9. 2026 — O3 rozhodnuto, engine zůstává.** Supabase EU je jen databáze a přihlášení;
engine na Hetzneru zůstává jediným zapisovačem nad schránkami (ÚVN i Gmail) a drží těla,
přílohy, index, MCP, kalendáře, běhy. Co čeká na enginu navíc, je zadané v `zadani-serveru-doktor-gmail.md`
(ÚKOLy 42–46). Pro Supabase: založit projekt (EU), zapnout TOTP, `password_min_length = 12`,
redirect `<doména>/reset-hesla`, DPA.

**21. 9. 2026 — zadání K2 (schéma a REST).** `zadani-k2-schema-a-rest.md`. Pět sloupců navíc
proti plánu je v A.3 **k odsouhlasení**, ne rozhodnutých: `ukoly.stav_zmenen`,
`ukoly.stav_zdroj`, `udalosti.zdroj_id`, tabulka `signaly_odlozene`, tabulka `sablony`.
Bez odsouhlasení se do migrace nedostanou a aplikace nechá pole prázdné. Otevřená volba
v B.3: kdo překládá id složek z kontraktu (`inbox`) na názvy enginu (`INBOX`) — dnes aplikace.

**21. 9. 2026 — schéma `doktor` je v Supabase.** Projekt `doktor`, ref `dwwwdeagnqiibwraxyjx`,
org Daniel Ondrášek, region `eu-west-1` (Irsko — O3 psalo Frankfurt, EU platí), Postgres 17.
Aplikováno 10 migrací z `supabase/migrations/` (9 schématu + `advisory_search_path_rls_indexy`,
která řeší nálezy advisorů: pevný `search_path` u šesti funkcí, politiky s `(select auth.uid())`
místo `auth.uid()` pro každý řádek, 21 indexů nad cizími klíči). Security advisor po ní hlásí
nic, performance jen INFO „unused index" (databáze je prázdná). Totéž ověřeno lokálně na
Postgres 16 se zástupným `auth` schématem: RLS, insert-only audit, `stav_zmenen`, `dnes()`,
`signal_odlozit()`.

`src/types/database.ts` je generovaný přes postgres-meta z lokální kopie schématu (stejný
generátor, jaký používá `supabase gen types`), protože schéma `doktor` zatím **není
vystavené v API projektu** a hostovaný generátor ho nevidí. Po každé další migraci znovu:
`supabase gen types typescript --project-id dwwwdeagnqiibwraxyjx --schema doktor > src/types/database.ts`
(jakmile bude schéma vystavené) a commit obojího.

**Co zbývá udělat ručně v dashboardu Supabase** (přes MCP to nejde):
1. ~~Settings → API → *Exposed schemas*: přidat `doktor`~~ — **hotovo 21. 9. 06:46 UTC**; důkaz
   v logu PostgREST: „Schema cache loaded 23 Relations, 39 Relationships, 4 Functions" (předtím
   0 Relations). Pozor: `generate_typescript_types` přes MCP se ptá Management API jen na
   `public` (výchozí `included_schemas`), takže doktor nikdy neukáže — typy se generují CLI
   s `--schema doktor`, nebo z lokální kopie přes postgres-meta jako dosud. „Exposed tables"
   v novém UI počítá tabulky s právy pro `anon`; u nás je to záměrně 0 (práva jen
   `authenticated` + `service_role`, migrace `funkce_bez_anon` sebrala anonu i EXECUTE).
   Přepínač „Automatically expose new tables" vypnout — práva řídí migrace.
2. Authentication → MFA: zapnout TOTP; Sign-in / Providers → Email: `password_min_length = 12`;
   URL configuration: site URL a redirect `<doména>/reset-hesla`.
3. Organization → Legal: DPA se Supabase (podmínka O3).
4. Heslo k databázi nikam nepsat — aplikace ho nepotřebuje, engine dostane connection string
   do svých secrets až v K2.3.

**21. 9. 2026 — Události nad `udalosti` (K3.7).** `createSupabaseEventSource({engine})` čte
`udalosti` pod RLS (řazení `zacatek`, původ přes vztah `polozky` → předmět nebo odesílatel,
`kolize` jsonb obranně), `reject` zapíše `stav = zamitnuto`. `calendars` = `cal_calendars`,
`add` = `cal_pridat` (`kalendar_id, nazev, zacatek, konec, celodenni, misto, polozka_id,
zdroj_id = id návrhu, potvrzeni: true`) a pak `stav = pridano, kal_uid, kalendar`. Když engine
zapíše a update řádku selže, návrh zůstane „nový" — další kliknutí engine odmítne přes
`zdroj_id` (nástroj `cal_pridat` vrací `{ok:false}`), takže duplikát nevznikne, ale řádek je
nutné srovnat ručně; K2.3 ať vrací při shodě `zdroj_id` existující `kal_uid` místo odmítnutí.
Bez `VITE_ENGINE_URL` jsou kalendáře prázdné, tlačítko Přidat je vypnuté a obrazovka to říká.

Přenos k enginu je teď společný: `src/lib/engine/client.ts` (`createEngineClient`, obálka
`{ok, duvod, chyba}`, `EngineError`); `engineMailbox` nad ním jen skládá payloady pošty.
JWT pro engine dává `src/lib/supabase/token.ts`.

**21. 9. 2026 — Dnes nad `dnes()` (K3.5).** `createSupabaseTodaySource()` volá `rpc("dnes")`
a `rpc("signal_odlozit", {p_klic, p_akce})`; řádek → `Signal` v `toSignal` (`akce` jsonb
obranně, `urg`/`kat` mimo číselník se zahodí). Generované typy funkcí neznají nullabilitu
(`termin`, `href` jsou ve skutečnosti volitelné) — řeší se přetypováním v `toSignal`, ne
ručním zásahem do `database.ts`. Tím jsou všechny tři zdroje (Dnes, Úkoly, Události) na
databázi; na dashboard zbývá vystavit schéma `doktor` v API, jinak nic z toho nenačte.

**21. 9. 2026 — detail a zakládání úkolu (K3.6).** `TaskDialog` nad `TaskSource.get / create /
update`; převzetí z CRM je rozepsané v `prevzeti-z-vividbooks.md`. Co zbývá z K3.6: seznam
po termínech a kalendář (buckety a týden/měsíc z `VbTasksPage.tsx` jdou převzít) a „úkol →
iCloud Pracovní se Simčou na kliknutí" (`cal_pridat` + `ukoly.kal_uid`, až bude REST).
`EmailContext.onCreateTask` se dá zapojit na `taskSource.create({… source: "email",
contactId, itemId})`, až Pošta dostane kontext z K2.3.

**21. 9. 2026 — seznam po termínech a kalendář (K3.6).** Z `VbTasksPage.tsx`, rozepsané
v `prevzeti-z-vividbooks.md`. Obrazovka Úkoly má tři pohledy nad jedním `load`: kanban ·
seznam · kalendář, hledání a `?ukol=` detail. Z K3.6 zbývá jen „úkol → iCloud Pracovní se
Simčou na kliknutí" (`cal_pridat` + `ukoly.kal_uid`, až bude REST enginu).

**21. 9. 2026 — nasazení na Vercel.** Tým „danielondrasek's projects" (`team_xQkhkQ7c4AKTGZIGdZqhH3mI`,
plán Hobby), projekt `doktor-app` (`prj_EzkWeNt7MCA9qhoajFqjRKwFVjBw`) propojený
s `DanielOndrasek/doktor-app`, produkční větev `main` — každý push do `main` se nasadí sám,
ostatní větve dostanou náhled. Proměnné `VITE_SUPABASE_URL` a `VITE_SUPABASE_ANON_KEY` jsou
nastavené pro production · preview · development (obě veřejné). První produkční nasazení
`dpl_2fxxD5RULpoznKMG6FpAtnezoz7v` z commitu `20fef76`.

Adresy: `https://doktor-app.vercel.app` (produkce, krátký alias — používá se v prohlížeči
i v `REST_CORS_ORIGINS` enginu), `https://doktor-app-danielondraseks-projects.vercel.app`
(produkce, dlouhý alias), `https://doktor-app-git-main-danielondraseks-projects.vercel.app`
(větev main). Engine musí v CORS znát každou adresu, ze které se aplikace otevírá — jinak
preflight spadne s „No 'Access-Control-Allow-Origin' header" (stalo se 21. 9. večer).

**21. 9. 2026 večer — první živá Pošta: co se opravilo hned.** (1) Prosté textové tělo
(zpráva bez HTML části, typicky odpověď z Outlooku) se v iframu slévalo do jednoho odstavce
→ `textToHtml` v `lib/email/html.ts` (zalomení, klikací odkazy); odkazy z těla se otvírají
v nové kartě (`<base target>` + sandbox `allow-popups`). (2) Přílohy: náhled PDF, obrázku
a textu v dialogu, stažení pod původním názvem (`fetch` → `blob:`; `<a download>` na cizí
origin nefunguje) a „Stáhnout vše" po jedné — `lib/email/attachments.ts`, prop `attachmentUrl`
místo `onOpenAttachment`. (3) „Odeslat z" v okně psaní (K3.3) nad `schranky`; Gmail řádek
`suchanekstepan@gmail.com` založen 21. 9. Gmail v seznamu je pomalý a bez úryvku, protože engine
ho čte živě přes IMAP — náprava je ÚKOL 44 bod 3 (index Gmailu), zadáno serverovému Claudovi.

**21. 9. 2026 večer — audit z enginu padal na právech.** `doktor.audit` byl prázdný, ačkoli
Pošta běžela. V edge logu Supabase: `POST /rest/v1/audit` → 403 (`python-requests`, role
`service_role`), v postgres logu „permission denied for table audit". Tabulky `audit` a `behy`
neměly žádná práva pro `authenticated` ani `service_role` (ostatních 21 ano) — výchozí práva
ze `schema_doktor` se na ně nepropsala, důvod nezjištěn. Migrace `prava_audit_behy`: explicitní
`grant all on all tables` + `revoke update, delete, truncate on audit` (insert-only i pro
service role). Ponaučení: po každé migraci ověřit `information_schema.role_table_grants`,
ne jen advisory.

**22. 9. 2026 — index Gmailu na enginu (ÚKOL 44.3, commity `d2bc353`, `ecd2d75`).** Gmail je
v témže indexu jako ÚVN (sloupec `schranka`, klíč X-GM-MSGID, štítky přes CONDSTORE); `mail_search`
`gmail` i `vse` čte z indexu s úryvkem (medián 5 ms), `vlakno = gmail:<X-GM-THRID>`, `ref` dál
`[Gmail]/Všechny zprávy:<uid>`. `mail_thread` čte podle klíče vlákna bez ohledu na schránku, takže
aplikace vlákno skládá i u Gmailu (dřív jsme ho pro Gmail přeskakovali). Co zbývá na enginu je
v `docs/stav-serveru.md` enginu: `mail_get(gmail)` živě, `schranky[]` + `dalsi_strana`,
`stav_vlaken` přes obě Sent, `mail_move` na Gmailu propíše štítky až dalším syncem.

**22. 9. 2026 — kontext u e-mailu zapojený (K3.8).** `Mail` dostává `contactSource` a `taskSource`
z `App.tsx` a do `EmailInbox.renderContext` dává `EmailContext`: kontakt podle adres z hlavičky
(`ContactSource.findByEmails` nad `kontakt_adresy`, odkaz `/kontakty?kontakt=`), poslední zprávy
z enginu (`findByContacts` = `mail_search(odesilatel=…)` přes obě schránky), otevřené úkoly
kontaktu (odkaz `/ukoly?ukol=`) a „Úkol z mailu" (`ukoly`, `zdroj = email`, `kontakt_id`;
`polozka_id` přibude, až běh naplní `polozky`). Vlastní adresy se berou ze `schranky`. Navíc
našeptávač adres v okně psaní z adresáře (`ContactSource.list`). Z K3 zbývá K3.2 pole triage
a autosave nad `polozky` (čeká na první běh), K3.3 podpisy, K3.4 přílohy z jiného mailu a Disku,
K3.6 úkol → iCloud, K3.9 přehled běhů; mimo K3 kontrakt „Vrátit zpět".

**22. 9. 2026 — úkol → iCloud „Pracovní se Simčou" (K3.6 dokončeno).** `TaskSource.addToCalendar`
(jen když je engine): `cal_pridat(kalendar = TASK_CALENDAR, nazev, datum = termin, cas, minut 30
u času, celodenni bez času, popis, zdroj_id = 'ukol:<id>', potvrzeni PRIDAT)` → `ukoly.kal_uid`.
Tlačítko je v kontextu dialogu úkolu, jen u uloženého úkolu s termínem; když je termín v dialogu
rozepsaný a neuložený, hlásí „nejdřív ulož". Opakované kliknutí engine odmítne přes `zdroj_id`.
Název kalendáře je konstanta v `lib/tasks.ts` (plán ho jmenuje výslovně); až bude víc kalendářů
pro úkoly, půjde do `schranky`/nastavení.

**22. 9. 2026 — „Vrátit zpět" po Vyřízeno (K0.1 → K3.2, kontrakt t22).** V Poště je ✓ Vyřízeno
(v seznamu na hover, v detailu v patičce). Zpráva zmizí ze seznamu, dole běží lišta s odpočtem
10 s a tlačítkem Vrátit zpět; dokud běží, schránka o ničem neví (případ 1 a 8). Po doběhnutí
`archiveMessage` = `mail_move` do `_Triage/Vyřízeno`, engine vrací `novy_ref` (2). Selhání přesunu
vrátí zprávu do seznamu a ukáže chybu (6). Druhé ✓ během odpočtu první přesun provede hned,
odchod z obrazovky taky (7). Ve složce Vyřízeno je místo ✓ „Vrátit mezi otevřené" = `mail_move`
do INBOX (3, 5 — dohledání a Gmail štítky dělá engine, ne aplikace). Co chybí: stav položky
(`polozky.stav = vyrizeno/nove`, `stav_zdroj = klik`) a `presun_ceka`/`presun_pokusy` — přijde
s naplněnými `polozky`; a `hledani v archivu` když `novy_ref` chybí (4) je dnes na enginu.

**22. 9. 2026 — Nastavení a podpisy per schránka (K3.3, bez čekání na O5).** `/nastaveni`
(`src/pages/Settings.tsx`, `src/lib/signatures.ts`): seznam podpisů z `podpisy`, název, jazyk,
„výchozí pro schránku" (nejvýš jeden na schránku — ostatním se vazba sundá) a `SignatureEditor`
z CRM; `text` se odvozuje z HTML při uložení. Podpisy se nemažou. Okno psaní dostává
`signatureFor(adresa)` a vloží výchozí podpis schránky, ze které se bude odesílat (odpověď =
schránka, kam zpráva přišla), jednou při otevření; přepnutí Od uvnitř okna podpis nemění (přepsalo
by rozepsaný text). Engine `podpis_id` **nedostává** — podpis je v těle, jinak by ho přidal
podruhé; `podpisy_seznam` na enginu tím pádem aplikace nepotřebuje. Obrázky v podpisu zůstávají
`data:` do 3 MB (`onUploadImage` nezapojen — kam ukládat, rozhodne s K4.3 sklad příloh).
O5 (názvy podpisů z ÚKOLU 41) zůstává otevřené — Štěpán si je zatím pojmenuje sám.

**22. 9. 2026 — pole triage, návrh a autosave nad `polozky` (K3.2 dokončeno na straně aplikace).**
`src/lib/items.ts` (`ItemSource`: `byRefs`, `byMessageId`, `setStateByRef`, `saveUserDraft`).
Seznam se páruje přes `ref_cache` (v seznamu z enginu Message-ID není), detail přes `message_id`.
V seznamu chip P1–P3, „Čekám" a `co_resit` místo úryvku; v detailu box priorita · kategorie ·
stav · co řešit a věta, že je návrh (nebo rozepsaný text). Odpovědět předvyplní tělo: rozepsaný
text uživatele má přednost před `navrh_telo` (E3), předmět z `navrh_predmet`. Rozepsaný text se
ukládá 1,5 s po psaní do `rozepsano_telo` (HTML). Vyřízeno → `stav = hotovo`, `ref_cache = novy_ref`;
Vrátit mezi otevřené → `nove`; obojí `stav_zdroj = klik`. Tabulka je zatím prázdná — první běh
třídění ji naplní podle `most-claude.md` (doplněno: `ref_cache` povinný, slovník `stav`).
Tím je K3 hotové až na K3.4 (přílohy z jiného mailu, Disk) a K3.9 (běhy), obojí čeká na engine/běh.

**22. 9. 2026 — první běh třídění do databáze (K2.6, ručně z chatu).** Popsáno v `most-claude.md`
(oddíl „První běh třídění"): 19 položek, 8 návrhů, 3 události, 11 úkolů, `behy` hotovo, `audit`
s `kdo = beh`. Tím má Pošta poprvé pole triage a Dnes signály z `dnes()`. Zjištění pro schéma:
`udalosti (user_id, zdroj_id)` nemá unikátní constraint použitelný pro `on conflict` (zápis jde
přes `where not exists`) — u příštích migrací zvážit `unique` místo částečného indexu.
Nastavení Claude Code: `.claude/settings.json` v repozitáři povoluje Bash, Edit, Write a MCP
servery (UVN_Email, Supabase, Vercel, github, Claude_Code_Remote) bez dotazu na oprávnění.
Zbývá v Supabase → Authentication → URL Configuration: Site URL = produkční adresa,
Redirect URLs += `https://doktor-app-danielondraseks-projects.vercel.app/reset-hesla`.
Vlastní doména a CSP (`connect-src` Supabase + engine) až s K2.3.

**21. 9. 2026 — značka „Suchánek" a postranní lišta.** Na přání: název aplikace je „Suchánek"
písmem podpisu (`font-signature` = Dancing Script 600/700, načítá se z Google Fonts spolu
s Interem; bez sítě spadne na `cursive`). Navigace je postranní lišta z CRM `AdminLayout`
(viz převzetí). V railu je jen iniciála „S" — celý podpis by se do 56 px nevešel; kdyby měl
být vidět celý, jde rail rozšířit nebo podpis otočit svisle.

**21. 9. 2026 — mimo etapu na přání: Kontakty (K4.1) a „Rozpracováno v Claude".** Uživatel
si vyžádal adresář s minimálním CRM a přehled aktivních projektů Clauda dřív než K3.8/K3.9.
Uděláno jako `/kontakty` (`ContactSource` nad `kontakty`, `poznamky`, `ukoly`) a sekce na
Dnes nad `ukoly.claude_projekt` + `fronta_claude`. Pravidla pro zápis Claudem jsou
v `docs/most-claude.md`. Data naplněna přes Supabase MCP: schránka ÚVN, 44 organizací,
174 kontaktů se 198 adresami z `mail_kontakty`, 6 úkolů projektu „Doktor — aplikace".
`polozky` se neseedovaly (bez Message-ID by kolidovaly s během).

**Co zůstává na enginu (blokuje Poštu, e-maily u kontaktu, kalendáře):** REST `/api/v1`
podle `zadani-k2-schema-a-rest.md` část B. Engine je jiný repozitář (`uvn-mail-mcp`) —
do této session ho jde přidat přes `add_repo`, pak lze REST napsat tady.

**21. 9. 2026 — klient enginu srovnaný se skutečnými nástroji.** Přes MCP `UVN_Email` jsem
si přečetl skutečné signatury a tvary (`mail_search` → `{pocet, vysledky}` s `uryvek`,
`prilohy` jako text; `mail_get` → `telo`, `message_id`; `mail_prilohy` → `{index, jmeno, typ,
bajtu}`; `mail_folders` → `{result:[{name, special, flags}]}`; `mail_flag` s `priznak
'seen'|'flagged'`; `mail_send` s `potvrzeni:'ODESLAT'` a bez příloh; `cal_calendars` → názvy;
`cal_pridat` s `datum, cas, minut, potvrzeni:'PRIDAT'`). `engineMailbox.ts` a `events.ts`
teď posílají přesně tohle; REST K2.3 je tenký obal 1:1 (zadání B.2 přepsáno). Co engine
nezná (`schranka`, `skryta_kopie`, `html`, `prilohy`, `telo_html`, `priznaky` v seznamu,
`neprectene`), se posílá jen když je vyplněné — pydantic by cizí parametr odmítl.

Repozitář enginu není na GitHubu (jen `/opt/uvn-mail-mcp` na Hetzneru). Rozhodnuto: nahrát
ho na GitHub, pak REST napsat dovnitř. Do té doby Pošta hlásí „engine není propojený".

**21. 9. 2026 večer — REST enginu stojí (K2.3), aplikace ho má nastavený.** Claude Code na
serveru hlásí `https://mcp.2-28-234-7.sslip.io/api/v1/<nástroj>`: JWT ze Supabase s `aal2`,
allow-list uživatelů, CORS pro Vercel a `localhost:5173`, skryté nástroje 404, podepsaný odkaz
na přílohu bez JWT; z tabulky B.2 hotové `priznaky`, `telo_html` (sanitizace nh3, vzdálené
obrázky a inline styly pryč, `cid:` jako `data:`), `skryta_kopie`, `html`, `odeslat_z`
s varováním `jina_schranka`, `prilohy`, `ref` z `mail_draft`, `neprectene`, `kal_uid`, navíc
`novy_ref` z `mail_move` a `stav_vlaken` (K1.4). `podpis_id`, `podpisy_seznam` a kopie auditu
do `doktor.audit` čekají na `SUPABASE_SERVICE_ROLE_KEY` v `.env` enginu (klíč jde jen tam,
nikdy do aplikace ani do chatu). Omezení: Gmail `mail_search` má prázdný `uryvek`,
`mail_thread` jen ÚVN, `mail_send` s přílohou netestováno (opravdu by odeslal).
`VITE_ENGINE_URL` nastaveno na Vercelu pro production · preview · development; Vite ho
zapéká při buildu, takže platí od dalšího nasazení. Engine stále není na GitHubu (`gh auth
login` na serveru čeká na kód ze zařízení). Test „přes internet" jde udělat rovnou z Pošty
po přihlášení s MFA — access token z `localStorage` není třeba nikam vkládat.

**21. 9. 2026 večer — engine na GitHubu, klient srovnaný s `rest_api.py`.** Repozitář
`DanielOndrasek/uvn-mail-mcp` (privátní, commit `c60bed8`, 35 souborů, žádný `.env`, index ani
klíč; `.gitignore` kryje `.env*`, `data/`, `*.db`, `*.pem`, `*.key`). Porovnání s klientem
aplikace: cesty, obálka, JWT, CORS, `upload` (pole `soubor`), `mail_priloha_odkaz`, `novy_ref`,
`telo_html`, `priznaky`, `neprectene`, `ref` z konceptu a `kal_uid` sedí. Opraveno v aplikaci:
sjednocená schránka posílá `schranka: "vse"` a schránku zprávy si pamatuje podle refu (Gmail
refy `[Gmail]/Všechny zprávy:<uid>`), nepřečtené se sčítají z obou; `mail_draft` dostává i přílohy,
skrytou kopii, `odeslat_z` a `podpis_id` (engine je bere); chybová hláška ukazuje `chyba` (věta),
kód je v `EngineError.reason`, 401/403 → `unauthorized`; `varovani` z `mail_send` (`jina_schranka`)
jde do toastu. Co zůstává na serveru: `REST_LIMIT_ZA_MINUTU=60` je pro listování málo (detail
= `mail_get` + `mail_prilohy`), doporučeno 240; JWKS ověřuje ES256/RS256/EdDSA — projekt musí mít
asymetrické podepisování JWT (Project Settings → JWT Keys), s legacy HS256 vrátí engine
„neznámý klíč"; CORS zná jen produkční adresu a `localhost:5173`, ne náhledová nasazení.


**22. 9. 2026 — detail zprávy: hlavní tělo dostává prostor.** Adresáti (`Komu`) se ukazují na
jednom řádku, od čtvrté adresy je „+N dalších" s rozkliknutím (hromadné zprávy z ÚVN mívají
desítky adres). Blok vlákna se přesunul až pod tělo a přílohy, je sbalený (v hlavičce rozsah
dat), po rozbalení ukáže posledních 6 zpráv a starší na „Zobrazit N starších". Stav rozbalení
se při přepnutí zprávy resetuje.

**22. 9. 2026 — K3.9 Přehled běhů a zásahů Clauda na Dnes.** `RunsHistory` (převzatá
`AgentRunsHistory`) dostala zdroj nad `behy` + `audit` (`src/lib/runs.ts`). Zásah Clauda se
skládá jen ze zápisových nástrojů auditu (`mail_move`, `mail_flag`, `mail_draft`, `mail_send`,
`mail_preposlat`, `cal_pridat`, `kb_upsert`, `mail_sync`), volání blíž než 30 minut jsou jeden
zásah; po rozbalení jsou vidět jednotlivé kroky (schránka, složka → složka, UID, příznaky).
Čtení se neukazuje — jen `mail_search` má přes 500 řádků za den. Zjištění: `audit.vysledek`
píše engine někdy jako JSON, někdy jako Python `repr` (`{'ok': True, …}`) — aplikace čte obojí,
ale engine by měl sjednotit na JSON (poznámka pro server). Hlavička sekce varuje, když poslední
běh je starší než 26 h (K2.7 „kontrola, že běh proběhl"). Odkazy `/posta?polozka=<id>`
z `dnes()` a z přehledu běhů teď Pošta otevírá (`ItemSource.byId` → `ref_cache` → `openRef`);
když je `ref_cache` prošlý (zpráva přesunutá mimo běh), ukáže se chyba — dohledání podle
Message-ID přes `mail_najdi` by chtělo REST nástroj na enginu. `/udalosti?udalost=` a
`/ukoly?ukol=`: Úkoly parametr čtou; Události od téhož dne také (přepnou záložku a kartu zvýrazní).

**22. 9. 2026 — Přeposlat s původními přílohami (kontrolní seznam plánu).** „Přeposlat" v detailu
otevře okno psaní v režimu přeposlání: tělo je jen poznámka, engine (`mail_preposlat`,
`zpusob = cast`) doplní původní hlavičky, text a **přílohy překopíruje**, předmět složí „Fwd: …"
a na originálu nastaví `$Forwarded`. Okno proto nemá sponku ani „Odeslat z" a předmět je jen
náhled; přeposílané přílohy jsou vypsané v rámečku nad tělem. Poznámka jde jako text
(`htmlToPlainText`, společné s `podpisy.text`). Omezení enginu (poznámka pro server):
`mail_preposlat` nezná `schranka` ani `odeslat_z`, čte i odesílá jen ÚVN — u Gmail zprávy
aplikace přeposlání odmítne se srozumitelnou hláškou; REST odmítá neznámé parametry, takže
se posílá jen `ref, komu, telo, zpusob, potvrzeni`. Poznámka se před odesláním kontroluje na
rodné číslo na enginu (přílohy záměrně ne). `\Answered` u odpovědi engine nastavuje přes
`odpoved_na_message_id` už od K3.2.

**22. 9. 2026 — „Zeptat se": hledání bez AI a dotaz pro Clauda (kontrolní seznam, K0.3/K0.4).**
V Poště je vedle pole hledání „Rozšířené hledání": osoba (odesílatel), adresát (i v kopii),
období, směr, jen s přílohou — jde 1 : 1 na `mail_search` (`MailListParams.filter`, Doktor navíc
proti kontraktu z CRM). S filtrem se hledá ve všech složkách obou schránek, ne jen v otevřené.
„Zeptat se Clauda" zapíše dotaz s kontextem hledání do `fronta_claude` (`druh = dotaz`); Dnes
ukazuje dotazy a `vysledek.odpoved` v „Rozpracováno v Claude". Jak odpovídat je v
`docs/most-claude.md`. Co zůstává: uložené pohledy (K4.2), proklik z odpovědi na položku (K0.3).

**22. 9. 2026 — Pravidla pro Clauda a „Poznámka pro Clauda" (kontrolní seznam: korekce, pravidla).**
Nastavení má oddíl Pravidla pro Clauda nad `pouceni`: návrhy z běhů ke schválení, schválená
a zamítnutá, vlastní pravidlo (rovnou schválené), úprava textu; nic se nemaže. V detailu zprávy
je „Poznámka pro Clauda" — zapíše `fronta_claude` (`druh = poznamka`) s refem, Message-ID,
předmětem a `polozka_id`; Dnes ji ukazuje vedle dotazů a odpověď Clauda po zpracování. Kontrakt
pro Clauda je v `docs/most-claude.md`. Co zůstává: přehled `opravy` (páry návrh ↔ odesláno)
přijde, až je engine začne plnit (ÚKOL 39 `opravy_sber`); dnes by byl prázdný.

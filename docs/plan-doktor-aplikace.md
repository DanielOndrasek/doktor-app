# Plán vývoje: Doktor aplikace

Vzniklo 20. 9. 2026 v projektu „Emailový asistent". Navazuje na `stav-serveru.md`,
`dashboard-schranka.md`, `skilly-a-behy.md` a na průzkum kódu `vividbooks-ultra`
(větev `crm/s0-skeleton`, commit `831f9ae6`).

**Cíl:** přesunout artefakt „Schránka" do vlastní aplikace, zachovat jeho funkce a přidat
celé UI e-mailové schránky, CRM kontaktů s historií, úkoly s kanbanem, přílohy a propojení
s Claudem přes MCP. Aplikace nemá nahradit Apple Mail; má dát třídění, kontext, CRM a most
do Clauda.

**Kdo co dělá** (zkratky v tabulkách):

| Zkratka | Kdo / kde |
|---|---|
| CH | tento projekt v Claude (Schránka, skilly, běhy, dokumenty) |
| CC-S | Claude Code na serveru `uvn-mail-mcp` (Hetzner) |
| CC-A | Claude Code v novém repozitáři aplikace |
| D | Daniel (infrastruktura, účty, nasazení) |
| Š | Štěpán (rozhodnutí o pravidlech a obsahu) |

---

## 1. Architektura

```
 Claude (Desktop, web, mobil, běhy 7/13/17)        Prohlížeč / telefon
          │  MCP (jeden konektor „Doktor")                │  HTTPS + Supabase Auth (MFA)
          ▼                                               ▼
 ┌───────────────────────────── ENGINE (Hetzner, Python) ─────────────────────────────┐
 │ index pošty ÚVN+Gmail+archivy (FTS) · sklad příloh + text + OCR · koncepty/odeslání │
 │ CalDAV iCloud · CardDAV · Disk (služební účet) · párování stavu · profil ze Sent    │
 │ rozhraní: MCP pro Clauda  +  REST /api/v1 pro aplikaci (ověřuje JWT ze Supabase)    │
 └───────────────┬──────────────────────────────────────────────────┬─────────────────┘
                 │ service key                                      │ IMAP/SMTP, Gmail API, CalDAV, Drive
                 ▼                                                  ▼
   DATABÁZE APLIKACE (Supabase, EU, samostatný projekt)      zdroje (schránky, iCloud, Disk)
   položky · úkoly · události · kontakty · poznámky · pohledy
   podpisy · pravidla · opravy · běhy · fronta · audit
                 ▲
                 │ supabase-js (RLS)
   FRONTEND (React/Vite, kopie vybraných částí vividbooks `crm/src`)
```

Zásady:

1. **Jeden zapisovač nad schránkou.** Se schránkami mluví jen engine. Vercel handler
   `api/email/imap.ts` z CRM se pro ÚVN nepoužije; zůstává jako možnost pro další schránky.
2. **Přemýšlení v Claude, hledání na serveru.** Návrhy píše Claude podle skillů; podklady
   (vlákno, přílohy, podobné odpovědi, profil kontaktu, wiki) skládá engine bez AI.
3. **Příloha se předává odkazem**, nikdy jako base64 přes Clauda nebo prohlížeč.
4. **Stav se odvozuje ze schránky** (odeslaná zpráva ve vlákně, `\Answered`), ne jen z kliknutí.
5. **Nic se nemaže.** `trash` a `delete_folder` se v naší implementaci schránky nevystaví.
6. **Zdroj pravdy:** suroviny u zdroje (IMAP, iCloud, Disk) · provozní pravda v DB aplikace
   se zálohou na Disk · čitelné markdown zrcadlo na Disku (generované, needitované ručně).
7. **Každý MCP nástroj vrací `url` do aplikace** a zápisy nesou `zdroj_id` (idempotence).

---

## 2. Co se přebírá z vividbooks verze

**Přebrat (kopií do nového repa, ne fork):**

| Oblast | Soubory |
|---|---|
| UI kit, vzhled | `src/components/ui/*`, `src/index.css` (tokeny), `tailwind.config.ts`, `WhitelabelThemeHost` |
| Pošta | `src/lib/email/types.ts` (kontrakt `MailboxClient`), `gmailMailbox.ts`, `components/email/*` (Inbox, Compose, RichEditor, FolderNav, Templates, SignaturePreview, WorkPanel, RecipientsInput), `lib/emailSignature*.ts`, `components/vividbooks/EmailSignatureEditor.tsx` |
| Karta kontaktu | `pages/VbPersonDetailPage.tsx`, `components/vividbooks/EntityDetailShell.tsx`, `ActivityTimeline.tsx`, `ActivityDialog.tsx`, `ActivityPanel.tsx`; z `EntityWall.tsx` koncept a části UI |
| Kontext u e-mailu | `components/vividbooks/CrmEmailContext.tsx` |
| Úkoly | `pages/crm/VbTasksPage.tsx`, `components/tasks/*`, kanban z `components/sales/SalesKanban*.tsx` + `components/kanban/*` |
| Dnes | `pages/HomePage.tsx`, `components/home/TodaySignals.tsx`, `EvidenceChips.tsx`; vzor `crm.today_signals()` |
| Zápisy | vzor `plaud-intake`, `crm.call_recordings`, `CallRecordingsInbox.tsx` |
| Přehled práce agenta | `AgentRunsHistory.tsx`, vzor `agent_commands` |
| Přihlášení | Supabase Auth, `components/mfa/*`, stránky Auth/Reset |
| Disk | `components/google/*` (Picker, `drive.file`), funkce `drive-access-token` |
| Gmail | funkce `gmail-auth`, `gmail-callback`, `gmail-*` (ověřený OAuth klient) |

**Nepřebírat:** schéma `crm` (122 tabulek, organizace, billing, Kabinet, reality), datovou
vrstvu úkolů (příspěvky na zdi obchodu), `vb-assistant` a ostatní AI funkce přes API klíč,
`task_gcal_sync` (jen vzor), embeddingy přes Gemini, záložky Používání/Skóre/Obchody.

---

## 3. Datový model aplikace (schéma `doktor`)

| Tabulka | Klíčové sloupce |
|---|---|
| `schranky` | typ (uvn, gmail, mediendo), adresa, vychozi_podpis_id, aktivni |
| `polozky` | schranka_id, message_id, vlakno, ref_cache, od, od_email, predmet, datum, kategorie, priorita, stav, stav_zdroj (klik, schranka, beh), co_resit, navrh_predmet, navrh_telo, rozepsano_telo, komu[], kopie[], podpis_id, odeslat_z, prilohy_meta, kontakt_id, pripad_id, beh_id |
| `ukoly` | nazev, popis, **stav (todo, probiha, ceka, hotovo, odlozeno, zruseno)**, odlozeno_do, priorita, termin, cas, druh, oblast, zdroj (email, claude, rucne, plaud), **zdroj_id unique**, claude_projekt, polozka_id, kontakt_id, kal_uid, poradi |
| `udalosti` | polozka_id, nazev, zacatek, konec, celodenni, misto, kalendar, stav (novy, pridano, zamitnuto), kal_uid, kolize |
| `kontakty` | jmeno, prijmeni, tituly, organizace_id, role, poznamka, zdroj, **profil_psani** (osloveni, tykani, podpis, paticka, jazyk, odesilat_z, spocteno), ulozit_do_kontaktu, carddav_uid, sloucen_do |
| `kontakt_adresy`, `kontakt_telefony` | kontakt_id, hodnota unique, primarni |
| `organizace` | nazev, domena |
| `stitky`, `kontakt_stitky` | — |
| `poznamky` | kontakt_id, pripad_id, text, druh (poznamka, zapis, hovor), zdroj (plaud, rucne, claude), zdroj_id |
| `vazby_dokumentu` | kontakt_id, zdroj (priloha, disk), priloha_sha nebo disk_file_id, nazev |
| `pripady` | nazev, kontakt_id (odesílající lékař) — jen po rozhodnutí O2 |
| `pohledy` | nazev, filtr (kontakty[], dotaz, obdobi, schranky), pripnuto |
| `podpisy` | nazev, jazyk, html, text, vychozi_pro_schranku |
| `pravidla` | převzato ze Schránky |
| `opravy` | polozka_id, navrh, odeslano_ref, podobnost, rozdil, zpracovano |
| `pouceni` | návrh pravidla ke schválení, stav, zdroj_opravy[] |
| `behy` | zacatek, konec, stav, schranky, pocty, chyba |
| `fronta_claude` | druh, vstup, stav, vysledek |
| `audit` | kdo (app, claude, beh), nastroj, vstup_hash, vysledek, cas |

V Supabase jsou jen metadata příloh. Těla zpráv, bajty a text příloh zůstávají na enginu.
Všechny tabulky mají `user_id` a RLS, i když je uživatel jeden (pozdější přístup sekretariátu).

---

## 4. Rozhraní

### 4.1 REST enginu pro aplikaci = třetí implementace `MailboxClient`

| Metoda kontraktu | Engine | Poznámka |
|---|---|---|
| `listMessages` | index (`mail_search`) | sjednocená schránka: parametr `schranky[]` |
| `getMessage` | `mail_get` | **nově HTML tělo** se zachovanými odkazy, inline obrázky jako `data:` |
| `getAttachment` | sklad / IMAP | stream, ne base64 |
| `setRead`, `setStarred` | `mail_flag` | |
| `moveToFolder`, `archiveMessage` | `mail_move` | vrací `novy_ref` |
| `trashMessage`, `deleteFolder`, `createFolder` | — | nevystaveno |
| `send` | `mail_send` | přílohy odkazem; `odeslat_z`, `podpis_id` |
| — (nové) `saveDraft` | `mail_draft` | koncept s přílohami do Konceptů |
| `findByContacts` | index podle adres | okamžité, včetně archivů |
| — (nové) `upload` | multipart na engine | vrací `upload_id` |

Ověření: engine validuje JWT ze Supabase (JWKS) a seznam povolených uživatelů.

### 4.2 MCP nástroje pro Clauda

Stávající `mail_*`, `cal_*`, `kb_*`, `archiv_*` zůstávají. Nové:

| Skupina | Nástroje |
|---|---|
| Přehled | `dnes`, `fronta_ke_zpracovani`, `fronta_claude_dalsi`, `fronta_claude_hotovo` |
| Položky | `polozka_zapis`, `polozka_stav`, `navrh_uloz` |
| Návrhy | `podklady_k_odpovedi`, `pravidla_psani`, `pouceni_navrhni` |
| Úkoly | `ukol_zalozit`, `ukol_uprav`, `ukoly_seznam` |
| Kontakty | `kontakt_najdi`, `kontakt_karta`, `kontakt_uprav`, `kontakt_poznamka`, `kontakt_slouc` |
| Pohledy | `pohled_uloz`, `pohledy` |
| Přílohy | `priloha_text` (stránkovaně), `priloha_hledat`, `priloha_nahled` (obrázek stránky) |
| Podpisy | `podpisy_seznam` |

Rozšíření stávajících: `mail_send` / `mail_draft` / `mail_preposlat` parametr `prilohy[]`
(`{zdroj: zprava|priloha|disk|upload, …}`), `odeslat_z`, `podpis_id`; `mail_move` vrací
`novy_ref`; `mail_najdi(uvn)` hledá ve všech složkách.

---

## 5. Fáze a úkoly

### K0 — Schránka: opravy, které nečekají (CH)

| # | Úkol | Hotovo, když |
|---|---|---|
| K0.1 | **Vrácení po ✓** — lišta „Vrátit zpět" 10 s; „Vrátit mezi otevřené" přesune zprávu zpět do Doručených (Gmail: štítek INBOX zpět, „Vyřízeno" pryč) a obnoví `uvn_ref`. Do nasazení K1.1 přes dohledání v indexu, potom přes `novy_ref`. | omylem odškrtnutá ÚVN zpráva je po vrácení v Doručených a jde u ní Přečíst přílohu i Přeposlat |
| K0.2 | **Originál** — tlačítko u položky, tělo z `mail_get`, odkazy klikací (plně až po K1.2) | odkaz na redakční systém jde otevřít ze Schránky |
| K0.3 | **Hledání s prokliky** — „Zeptat se" vrací i seznam zpráv s refy, karta otevře originál | žádné opisování ze screenshotu |
| K0.4 | **Záložka Hledat + pohledy** — pole Osoba(y), Klíčové slovo, Období; přímý dotaz do indexu bez AI, u Gmailu konektor; uložení pohledu do kolekce `pohledy` | člověk + klíčové slovo na dvě kliknutí |

### K1 — Server: základ (CC-S) — zadání v `zadani-serveru-doktor-k1.md`

| # | Úkol |
|---|---|
| K1.1 | `mail_move` vrací `novy_ref`; `mail_najdi(uvn)` hledá ve všech složkách včetně `_Triage/*` |
| K1.2 | HTML tělo zprávy (`mail_get(format="html")`), odkazy zachované i v textové podobě |
| K1.3 | Přílohy odkazem v `mail_send`, `mail_draft`, `mail_preposlat` (zdroj `zprava`), kontrola velikosti, výpis příloh před odesláním |
| K1.4 | Párování stavu se schránkou: nástroj `stav_vlaken`, který pro seznam `message_id` vrátí, zda ve vlákně existuje pozdější odchozí zpráva (z kterékoli schránky) nebo `\Answered` |
| K1.5 | Páry návrh ↔ odesláno: `opravy_sber` (vstup: návrhy z položek, výstup: skutečně odeslaný text, podobnost, rozdíl) |
| K1.6 | Profil kontaktu ze Sent: `kontakt_profil(email)` — oslovení, tykání, podpis, patička, jazyk, odesílat z |
| K1.7 | Podpisy vytěžené ze Sent: jednorázový výpis shluků koncových bloků s četností (podklad pro O5) |

Úprava skillu `email-triage` (CH): krok „uzavři položky zodpovězené mimo dashboard" nad K1.4.

### Kontrolní bod po K0 + K1

Schránka má opravené chyby, přílohy v konceptech a stav podle schránky. Pokud to stačí,
stavba se může zastavit bez ztráty. Pokud ne (očekávám), pokračuje se K2.

### K2 — Data a rozhraní (CC-S, D, CH)

| # | Úkol |
|---|---|
| K2.1 | (D) Samostatný Supabase projekt v EU, doména pod ověřeným OAuth (O3, O4) |
| K2.2 | Schéma `doktor` podle oddílu 3, RLS, testy odepření (vzor `supabase/tests` z CRM) |
| K2.3 | REST `/api/v1` podle 4.1, ověření JWT |
| K2.4 | MCP nástroje podle 4.2 (položky, úkoly, kontakty, přehled, podklady) |
| K2.5 | Jednorázový přenos dat ze Schránky (`polozky`, `ukoly`, `udalosti`, `pravidla`, `corrections`, `sent_messages`, adresář) a z „Rozdělané práce" (`ukoly`) — po O6 |
| K2.6 | (CH) Běhy zapisují do nové DB; po přechodnou dobu dvojí zápis i do Schránky |
| K2.7 | Fronta zpracování + `behy` s kontrolou, že běh proběhl (upozornění, když fronta stárne) |
| K2.8 | Zálohy DB na Disk (noční dump), audit |

### K3 — Aplikace v1 (CC-A)

| # | Úkol |
|---|---|
| K3.1 | Repo, kopie částí podle oddílu 2, přebarvení, přihlášení s MFA |
| K3.2 | **Pošta:** `engineMailbox.ts` (třetí `MailboxClient`), sjednocená schránka s přepínačem, pole triage v seznamu (priorita, co řešit), čtečka s originálem, editor s předvyplněným návrhem, automatické ukládání rozepsaného textu |
| K3.3 | **Podpisy a Odeslat z:** více podpisů (editor z CRM), předvolba kontakt → pravidlo → schránka; patička oddělená od těla; varování při odpovědi z jiné schránky |
| K3.4 | **Přílohy v editoru:** přetažení (upload na engine), z jiného mailu, z Disku (Picker) |
| K3.5 | **Dnes:** P1, úkoly po termínu, dnešní události, čeká na odpověď, připnuté pohledy |
| K3.6 | **Úkoly:** seznam po termínech, kanban (TODO · V procesu · Čekám · Hotovo · Odloženo), kalendář; úkol → iCloud „Pracovní se Simčou" na kliknutí |
| K3.7 | **Události:** návrhy z mailů, kolize ve třech vrstvách kalendářů, zápis na kliknutí |
| K3.8 | Kontext u e-mailu (boční panel): kdo to je, poslední zprávy, otevřené úkoly, „Úkol z mailu" |
| K3.9 | Přehled běhů a zásahů Clauda (vzor `AgentRunsHistory`) |

### K4 — Aplikace v2 (CC-A, CC-S)

| # | Úkol |
|---|---|
| K4.1 | **Kontakty:** seznam se serverovým filtrem, karta (Plocha, E-maily, Úkoly, Události, Dokumenty, Poznámky), slučování duplicit, údaje z podpisů jako návrh |
| K4.2 | Uložené pohledy jako virtuální karty, připnutí na Dnes |
| K4.3 | Sklad příloh: ukládání podle SHA-256, text při příjmu (PDF, DOCX, XLSX, PPTX, vložené zprávy), OCR, fulltext v přílohách, doplnění historie po dávkách |
| K4.4 | Disk dovnitř (služební účet, O9) a ven (archiv příloh podle `archiv-priloh-disk.md`) |
| K4.5 | CardDAV: zápis označených kontaktů do Apple Kontaktů |
| K4.6 | Zápisy z Plaudu ke kontaktům |
| K4.7 | `podklady_k_odpovedi` v plné podobě; týdenní poučení do wiki ke schválení; metrika podobnosti |

### K5 — Dotažení

Obousměrný kalendář pro vlastní události (O7) · markdown zrcadlo na Disk · volitelná API
pojistka se stropem (O8) · vypnutí artefaktu · další projekty z nemocnice a kliniky.

**Artefakt se vypíná až po týdnu běhů bez ručních oprav v nové aplikaci.**

---

## 6. Funkce Schránky, které se musí přenést (kontrolní seznam)

- [ ] priority P1–P3 a „čekám", „co řešit", návrhy odpovědí
- [ ] rozepsaný text se ukládá sám a běh ho nepřepíše (E3)
- [ ] odeslání s potvrzením; nic se neodesílá samo
- [ ] „Odeslat z" s varováním; podpisy per schránka, patička až při odeslání
- [ ] u termínu zákroku jen „Termín potvrdím po domluvě."
- [ ] záložky Pošta · Úkoly · Události
- [ ] zápis do kalendáře jen na kliknutí; úkoly do „Pracovní se Simčou"; tři vrstvy kalendářů
- [ ] korekce a „Poznámka pro Clauda" (nově hlavně ze Sent), pravidla, adresář
- [ ] „Zeptat se" (nově: hledání bez AI + dotaz přes Clauda)
- [ ] přeposlání s původními přílohami, příznaky `\Answered` a `$Forwarded`
- [ ] rodné číslo nikdy do těla; jména pacientů se píší normálně
- [ ] kontrola, že běhy proběhly

---

## 7. Otevřená rozhodnutí

| # | Rozhodnutí | Kdo | Blokuje |
|---|---|---|---|
| O1 | Uvolnit pravidlo „data jen z téhož vlákna" na tři úrovně (vlákno · týž pacient se shodou dvou údajů · slabá shoda jen v panelu) | Š | K4.7 |
| O2 | Karty pacientů ne; vlákna o pacientovi jako „případ" pod odesílajícím lékařem | Š | K4.1 |
| O3 | Databáze: Supabase EU, nebo vše na Hetzneru | D | K2.1 |
| O4 | Doména aplikace pod ověřeným Google OAuth projektem | D | K2.1 |
| O5 | Seznam a názvy podpisů (podklad z K1.7) | Š | K3.3 |
| O6 | Sjednotit úkoly s „Rozdělanou prací" do jedné tabulky | Š + D | K2.5 |
| O7 | Povolit úpravu a mazání vlastních událostí v kalendáři (mění rozhodnutí z 13. 9.) | Š | K5 |
| O8 | API pojistka pro spadlý ranní běh, měsíční strop | D | K5 |
| O9 | Které složky Disku sdílet se služebním účtem | Š | K4.4 |

---

## 8. Měřítka

1. Týden běhů bez ručních oprav.
2. Podobnost návrh ↔ odesláno po kategoriích roste (K1.5 dává výchozí hodnotu).
3. Otevřené položky odpovídají skutečnosti (dnes 116 ze 171 „nových", z toho řada zodpovězených z Mailu).
4. Štěpán aplikaci otevírá denně.

## 9. Rizika

| Riziko | Ošetření |
|---|---|
| Stavba odsune kvalitu návrhů a spolehlivost běhů | K0 a K1 jsou první a mají hodnotu samy o sobě |
| Webová aplikace s pacientskou poštou na internetu | MFA, samostatný projekt v EU, přílohy a těla jen na enginu, zálohy, audit |
| Dva zapisovače nad ÚVN schránkou | jen engine; Vercel handler se pro ÚVN nepoužije |
| Rozjezd kopie od vividbooks CRM | kopie k commitu, ne fork; žádné sledování upstreamu |
| Mediendo zůstává mimo | souhlas správce tenantu; aplikace to nezmění |
| Ranní běhy bez konektoru (19.–20. 9.) | fronta: spadlý běh znamená zpoždění, ne ztrátu; K2.7 hlídá stáří fronty |

## 10. Zjištění z 20. 9., ze kterých plán vychází

- „Vrátit mezi otevřené" mění jen stav v DB; zpráva zůstane v `_Triage/Vyřízeno`.
- Po přesunu je `uvn_ref` neplatný, číselné id v indexu se změní (ověřeno: 23594 → 23732)
  a `mail_najdi(uvn)` zprávu nenajde (hledá jen INBOX a Sent). Dohledat ji jde jen přes
  `mail_search` podle odesílatele a data.
- Za 12 dní 171 položek, 11 odesláno z dashboardu, 41 vyřízeno, 116 otevřených; z ÚVN
  přitom za týden odešlo kolem dvaceti odpovědí z Mailu a iPhonu. Kolekce `corrections` je
  proto prázdná — učení musí brát data ze Sent.
- CRM: jedna schránka na uživatele, přílohy base64 do 3 MB, hledání živě přes IMAP,
  bez konceptů, kalendář jen Google, AI přes API klíč, žádné MCP.

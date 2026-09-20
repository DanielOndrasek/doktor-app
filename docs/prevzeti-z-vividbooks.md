# Převzetí z vividbooks CRM

Zdroj: `vividbooks/vividbooks-ultra`, větev `crm/s0-skeleton`, **commit `831f9ae6`**.
Cesty ve sloupci „Odkud“ jsou vůči podadresáři `crm/` zdrojového repozitáře —
CRM tam žije jako samostatná aplikace, `src/index.css` je tedy
`crm/src/index.css`.

**Kopie ke commitu, ne fork.** Soubory se zkopírují, přebarví a dál žijí vlastním životem.
Žádný upstream remote, žádné merge zpět. Kdo bude za rok hledat, proč se něco liší,
najde odpověď tady, ne v historii cizího repozitáře.

> **Pozor na rozsah session.** `vividbooks-ultra` patří organizaci `vividbooks`,
> `doktor-app` účtu `danielondrasek`. Jedna session neudrží obojí, pokud si oba
> repozitáře nevybereš jako zdroje hned při jejím založení. Kopii proto dělej
> v session, která vidí oba.

## Jak kopírovat

1. **Ber jen to, co je v tabulce.** Když soubor táhne za sebou import, který v tabulce
   není, zastav se a rozhodni: buď se přenese i ten (a dopíše se sem), nebo se odstřihne.
   Nepřetahuj celé adresáře „pro jistotu“.
2. **Odstřihni schéma `crm`.** Organizace, billing, Kabinet, reality, zeď obchodu.
   Co po odstřižení nedává smysl samo, je znamení, že se přebírá špatná vrstva —
   ne pozvánka dotáhnout zbytek CRM.
3. **Zachovej kontrakt, přepiš implementaci.** `MailboxClient` z `types.ts` se přebírá
   **doslova**, včetně jmen metod — na něm stojí `engineMailbox.ts`, naše třetí
   implementace. Metody `trashMessage`, `deleteFolder` a `createFolder` v kontraktu
   zůstanou, ale naše implementace je nevystaví (pravidlo 3 v `CLAUDE.md`).
4. **Texty do `src/lib/i18n/cs.ts`.** Každý řetězec viditelný uživateli, který ve zkopírované
   komponentě zůstal natvrdo, se cestou přesune do slovníku. Tohle je jediná chvíle,
   kdy se to dělá levně.
5. **Jeden commit na oblast**, ne jeden velký. Ať jde poznat, odkud co přišlo.
6. **Do commitu napiš zdrojový commit** (`831f9ae6`) — je to jediná vazba na původ,
   kterou budeme mít.

## Přebrat

| Oblast | Odkud | Kam | Hotovo |
|---|---|---|---|
| UI kit | `src/components/ui/*` | `src/components/ui/` | ☑ |
| Vzhled, tokeny | `src/index.css`, `tailwind.config.ts`, `WhitelabelThemeHost` | `src/index.css`, `tailwind.config.ts`, `src/components/ThemeHost.tsx` | ☑ |
| Kontrakt pošty | `src/lib/email/types.ts` (`MailboxClient`) | `src/lib/email/types.ts` | ☑ |
| Gmail klient | `src/lib/email/gmailMailbox.ts` | `src/lib/email/gmailMailbox.ts` | ☐ |
| Komponenty pošty | `src/components/email/*` (Inbox, Compose, RichEditor, FolderNav, Templates, SignaturePreview, WorkPanel, RecipientsInput) | `src/components/email/` | ☑ |
| Podpisy | `src/lib/emailSignature*.ts`, `components/vividbooks/EmailSignatureEditor.tsx` | `src/lib/email/signature*.ts`, `src/components/email/SignatureEditor.tsx` | ☑ |
| Karta kontaktu | `pages/VbPersonDetailPage.tsx`, `components/vividbooks/EntityDetailShell.tsx`, `ActivityTimeline.tsx`, `ActivityDialog.tsx`, `ActivityPanel.tsx`; z `EntityWall.tsx` koncept a části UI | `src/pages/ContactDetail.tsx`, `src/components/contacts/` | ☐ |
| Kontext u e-mailu | `components/vividbooks/CrmEmailContext.tsx` | `src/components/email/EmailContext.tsx` | ☐ |
| Úkoly | `pages/crm/VbTasksPage.tsx`, `components/tasks/*` | `src/pages/Tasks.tsx`, `src/components/tasks/` | ☐ |
| Kanban | `components/sales/SalesKanban*.tsx`, `components/kanban/*` | `src/components/kanban/` | ☑ |
| Dnes | `pages/HomePage.tsx`, `components/home/TodaySignals.tsx`, `EvidenceChips.tsx`; vzor `crm.today_signals()` | `src/pages/Today.tsx`, `src/components/home/` | ☐ |
| Zápisy | vzor `plaud-intake`, `crm.call_recordings`, `CallRecordingsInbox.tsx` | `src/components/notes/` | ☐ |
| Přehled práce agenta | `AgentRunsHistory.tsx`, vzor `agent_commands` | `src/components/runs/` | ☐ |
| Přihlášení | Supabase Auth, `components/mfa/*`, stránky Auth/Reset | `src/lib/supabase/`, `src/components/auth/`, `src/pages/{Login,ResetPassword}.tsx` | ☑ |
| Disk | `components/google/*` (Picker, `drive.file`), funkce `drive-access-token` | `src/components/google/` | ☐ |
| Gmail OAuth | funkce `gmail-auth`, `gmail-callback`, `gmail-*` | `supabase/functions/` | ☐ |

**Pořadí:** UI kit a vzhled první (na nich stojí všechno ostatní), pak kontrakt pošty,
pak přihlášení. Zbytek podle toho, kterou obrazovku z K3 zrovna stavíš.

## Co se při kopírování rozhodlo

Zápis podle pravidla 1 „Jak kopírovat": u každého importu, který soubor táhl a v tabulce
nebyl, tady stojí, jestli se přenesl, nebo odstřihl. Kdo bude hledat, proč něco chybí,
najde odpověď tady.

### UI kit (20. 9. 2026)

**Přeneseno spolu s kitem**, protože si to kit sám táhne: `src/hooks/use-toast.ts`,
`src/hooks/use-mobile.tsx`, `src/hooks/use-keyboard-inset.ts`, `src/lib/utils.ts`.

**Odstřiženo** — každá z těchto komponent táhne závislost mimo stack z `CLAUDE.md`
a žádná obrazovka K3 ji nepotřebuje:

| Soubor | Závislost | Čím se nahrazuje |
|---|---|---|
| `chart.tsx` | recharts | grafy v K3 nejsou (záložky Používání a Skóre se nepřebírají) |
| `carousel.tsx` | embla-carousel-react | — |
| `drawer.tsx` | vaul | `sheet.tsx` |
| `sonner.tsx` | sonner, next-themes | `toast.tsx` + `toaster.tsx` (Radix) |
| `form.tsx` | react-hook-form, zod | formuláře K3 jsou malé, stačí `label` + `input` |
| `input-otp.tsx` | input-otp | až s MFA, pokud ji `components/mfa/*` bude chtít |
| `__tests__/searchable-select.test.tsx` | vitest | v repozitáři zatím není testovací běh |

**Doplněné závislosti**, bez kterých se kit nepřenese: `cmdk` (`command`,
`searchable-select`), `react-resizable-panels` (`resizable`), `react-day-picker`
(`calendar`, `date-picker`).

**react-day-picker v9 místo v8.** CRM je na v8, která nepodporuje React 19. v9
přejmenovala třídy (`day_selected` → `selected`, `head_cell` → `weekday`, …), sloučila
`IconLeft`/`IconRight` do `Chevron` a `fromDate`/`toDate`/`initialFocus` na
`startMonth`/`endMonth`/`autoFocus`. `calendar.tsx` a `date-picker.tsx` jsou proto
přepsané; vzhled a veřejné props `DatePicker` zůstaly.

**TypeScript strict.** CRM jede na `strict: false`. Kopie se drží stacku Doktora, takže
strict je zapnutý; kit to snesl bez úprav. Na lint bylo potřeba `interface X extends Y {}`
→ `type X = Y` v `command.tsx` a `textarea.tsx`.

**Texty do `src/lib/i18n/cs.ts`** (pravidlo 4): `pagination`, `sidebar`, `dialog`,
`sheet`, `breadcrumb`, `searchable-select`, `date-picker`. Jsou to hlavně popisky pro
odečítače obrazovky, ale i ty uživatel „vidí“.

### Vzhled a tokeny (20. 9. 2026)

Z `index.css` (1160 řádků) se přebraly tokeny, base layer a obecné záplaty prohlížečů:
override na `dvh` jednotky, pojistka proti auto-zoomu inputů na iOS a posuvníky.

**Přebarveno:** akcent (`--secondary`, `--ring`, sidebar) ze značkového indiga
Vividbooks na klidnou klinickou modrozelenou. Inkoustový neutrální základ zůstal.

**Odstřiženo:** tokeny `--deal-*` a `--pipeline-*` (zeď obchodu a pipeline obchodů =
schéma `crm`), paleta `neon-*` a barva `pipeline` v `tailwind.config.ts`, animace
asistenta, loaderu, přihlašovací aurory a „výhry obchodu“, styly pro Leaflet,
docx-preview, šablony smluv a výběr oblasti pro report.

**Odloženo na jejich řádek**, ne odstřiženo — patří k oblasti, která se ještě nepřebírá:
`.animate-fade-in-up` a `.home-surface*` (Dnes), `.animate-task-complete-out` (Úkoly).
`.signature-surface` se nakonec nepřebral: používal ho jen starší
`components/SignatureEditor.tsx`, který se nebere (viz Podpisy).

**Až se bude přebírat Úkoly**, čeká na remapování na tokeny Doktora:
`TaskDetailDialogChrome.tsx` a `TaskContextPreviewCards.tsx` sahají na `--deal-*`.
(`EmailCompose.tsx` sahal na `neon-*` jen u tlačítka AI, které se nepřebralo.)

**`WhitelabelThemeHost` → `ThemeHost.tsx`.** Zůstal koncept „jediný zapisovač tématu na
`<html>`“ (plus `src/lib/theme.ts` a skript v `index.html`, který třídu nastaví před
prvním paintem). Whitelabel branding per organizaci se nepřebírá: stojí na
`organizations.whitelabel` ze schématu `crm` a Doktor má jednoho uživatele a jeden
vzhled. Odstřižené s ním: `hooks/useWhitelabel.ts`, `useWhitelabelBySlug.ts`,
`lib/whitelabelTheme.ts`, `lib/websiteSlug.ts`.

### Kontrakt pošty (20. 9. 2026)

Kopie je doslovná včetně jmen metod. Tři odchylky:

1. `provider` a `sentVia` znají navíc `"engine"` — bez toho se do kontraktu nevejde
   `engineMailbox.ts`, o kterou celé převzetí jde.
2. `dealId` v `MailSendRequest` a `MailContactSearchParams` odstřižené (zeď obchodu).
3. Komentáře o zdi obchodu a o „dvou implementacích“ přepsané na vlákno, kartu kontaktu
   a „každou implementaci“.

`trashMessage`, `deleteFolder` a `createFolder` v kontraktu podle pravidla 3 zůstaly.
Zbytek souboru je proti zdroji znak po znaku shodný — dá se ověřit `diff`em proti
`crm/src/lib/email/types.ts` v commitu `831f9ae6`.

### Komponenty pošty (20. 9. 2026)

Přebráno 12 souborů: osm jmenovaných v tabulce a čtyři, které si táhnou
(`EmailListItem`, `SaveAsTemplateDialog`, `EmailSignatureNode`, `emailFolders`).

**Přeneseno spolu s nimi:**

| Co | Kam | Proč |
|---|---|---|
| `lib/emailWallUtils.ts` (jen `parseEmailFromHeader`, `emailInitials`, `avatarColorClass`, `escapeForHtmlSrcDoc`, `sanitizeEmailHtml`) | `src/lib/email/html.ts` | jméno „wall" bylo zavádějící — je to obecná práce s HTML e-mailu; bez sanitizace se cizí HTML do iframu dávat nesmí. Zbytek souboru (`postProcessEmailDocument`, `buildEmailIframeSrcDoc`, `groupGmailByThread`, …) zůstal ve zdroji. |
| — | `src/lib/email/compose.ts` | nové: tvary mezi oknem psaní a volajícím (`ComposeSendRequest`, `AttachmentUploadRef`, `EmailTemplate`, `EmailRecipientSuggestion`) |
| tiptap (`@tiptap/react`, `starter-kit`, `extension-{underline,text-align,text-style,image,table,link}`) | závislost | RichEditor je v tabulce jmenovitě |
| dompurify | závislost | sanitizace těla zprávy |

**Nepřebráno:** `EmailQuickActions.tsx` (slučovací pole nad obchody a školami
+ AI návrh) a `ScheduledEmailsButton.tsx` (fronta `crm.scheduled_emails`,
odesílá samo).

**Odstřižené uvnitř převzatých souborů.** Každá položka kvůli pravidlu z `CLAUDE.md`
nebo kvůli schématu `crm`; místo importu je vždy prop, aby obrazovky K3 dosadily
Doktorovu vrstvu:

| Bylo | Je | Pravidlo |
|---|---|---|
| `useMailbox()` z `hooks/useMailAccount` (účty v `crm`) | `EmailInbox` dostává `mailbox: MailboxClient` propsem | 1 — jeden zapisovač |
| `mailbox.send(...)` přímo z Compose | prop `onSend(ComposeSendRequest)` | 1 |
| `fileToBase64` + `attachments: [{ data }]` při odeslání | prop `onUploadAttachment(file) → { uploadId }`, k odeslání jdou `uploadIds` | 2 — příloha odkazem |
| stažení přílohy dekódováním base64 v prohlížeči | prop `onOpenAttachment` | 2 |
| tlačítko „Smazat", `trashMessage`, zakládání a mazání složek v `EmailFolderNav` | pryč | 3 — nic se nemaže |
| „Později" + `handleSchedule` + `scheduleOptions` | pryč | 8 — nic se neodesílá samo |
| „Napsat text AI" (`email-text-assist`) | pryč | žádné volání modelu z aplikace |
| `fillTemplateFields`, `greetingFor`, `mergeContext` (`lib/vividbooks/templateFields`) | šablona se vloží tak, jak je | schéma `crm` |
| `ownerToRecipientOptions` (vlastníci nemovitosti), role Vlastník/Kupující/Nájemník/Zájemce | `recipientSuggestions` se skupinou, řazení abecedně | schéma `crm` |
| `searchEmailRecipients` z `lib/partySearch` | prop `onSearchRecipients` | schéma `crm` — adresář přijde s řádkem Karta kontaktu |
| šablony z `email_templates`, bucket `template-attachments`, `is_shared`, „Moje", `author_name`, RPC `email_template_used` | propsy `templates`, `onSaveTemplate`, `onDeleteTemplate`, `onTemplateUsed` | schéma `crm`; jeden uživatel; sklad příloh je K4 |
| podpis z `profiles.email_signature` | prop `signatureHtml` | řádek Podpisy |
| `CrmEmailContext` v detailu | slot `renderContext(detail)` | řádek Kontext u e-mailu |
| `EmailWorkPanel`: tři sloupce z `email_waiting`, `email_tracking`, `scheduled_emails` | jeden sloupec „Čeká na mou odpověď" z propsu `waiting` | schéma `crm`; sledovací pixel a naplánované odeslání sem nepatří; zdroj dat řeší Dnes (K3.5) |
| `toast` ze `sonner` | `useToast` z převzatého kitu | sonner se nepřebral (UI kit) |
| avatar z náhodného odstínu `hsl(hash % 360, …)` | `avatarColorClass` z palety | ladí s tokeny ve světlém i tmavém režimu |

Kontrakt `MailboxClient` zůstal nedotčený: `MailSendRequest.attachments` (base64)
v něm je, ale okno psaní ho nepoužívá. Jak `uploadIds` dojedou do enginu, rozhodne
`engineMailbox.ts` (K3.2).

Nezměněné proti zdroji: `EmailSignaturePreview`, `EmailSignatureNode`
(jen třída `vb-email-signature` → `doktor-email-signature`), `EmailRichEditor`
(jen texty do slovníku).

### Kanban (20. 9. 2026)

Přebráno jako **tvar**, ne jako data: mřížka sloupců, sloupec s proužkem
a počtem, karta s názvem na dva řádky a patičkou, zvýraznění podle stáří ve
sloupci, optimistický přesun s návratem při chybě, odložená kostra načítání.
Spolu s tím `hooks/useDelayedLoading.ts`.

**Sloupce** jsou stavy úkolu z `CLAUDE.md`: TODO · V procesu · Čekám · Hotovo ·
Odloženo (`zruseno` sloupec nemá). `DEAL_STAGES` (Lead → Předání) a
`dealPipelinePalette.ts` se nepřebraly; proužky berou barvy z tokenů
(akcent, varování, úspěch, ztlumené).

**Karta** (`KanbanCard` v `types.ts`) je projekce řádku `ukoly`: název, termín
relativně s absolutním datem v `title`, priorita, kontakt, oblast, stáří ve sloupci.
Typy tabulek přijdou generované z Supabase (K2) — kanban na nich nezávisí, řádek
na kartu přemapuje obrazovka Úkoly.

**Odstřižené:** načítání z `db_deals` (stránkování po 1 000, joiny, profily makléřů,
RPC `kanban_deal_counts`), fast-path pro `?deal=`, filtry `brokerFilter` /
`dealFilter` / `vbPipeline`, `SaleDealDetail`, `VbDealDetail`, `DealFormDialog`,
`DealStageActionsDialog`, `recordDealStageKanbanWallPost`, provize a náklady
(`formatCzk`, `calculateDealNetCommission`), vlastník, tipař, makléř s avatarem,
škola, štítky z Kabinetu, typ akvizice, konec ZS, sdílení s kolegy, odkaz na
`/obchody`. Data přicházejí propsem `cards`, změna stavu jde přes `onMove` —
a kdo ji ukládá, zapíše `stav_zdroj = klik` (pravidlo 4).

**`@dnd-kit` místo nativního drag & drop.** CRM přetahuje přes `dataTransfer`,
což na dotyku nefunguje. Stack v `CLAUDE.md` říká `@dnd-kit (kanban)`, takže
`useDraggable` / `useDroppable` / `DragOverlay`; klik zůstává klikem díky prahu
6 px, na dotyku se tah spouští po 180 ms.

### Přihlášení (20. 9. 2026)

CRM mělo čtyři přihlašovací stránky podle role (makléř, klient, sysadmin,
whitelabel) a MFA jen pro sysadmin panel. Doktor má jednoho uživatele a MFA
povinné pro všechno (plán, oddíl 9) — z toho plyne většina rozhodnutí.

**Přeneseno:**

| Odkud | Kam | Poznámka |
|---|---|---|
| `integrations/supabase/{client,env}.ts` | `src/lib/supabase/{client,env}.ts` | `db.schema: "doktor"` místo `"crm"`; bez `createClient<Database>` — typy se generují až v K2 ze skutečného schématu; env podle `.env.example` (`VITE_SUPABASE_ANON_KEY`) |
| `lib/mfa.ts` | `src/lib/supabase/mfa.ts` | beze změny chování |
| `lib/passwordPolicy.ts`, `withAsyncTimeout.ts`, `networkErrors.ts` | `src/lib/supabase/passwordPolicy.ts`, `timeouts.ts` | texty do slovníku; anglická hláška se nepřebrala |
| `components/mfa/MfaChallengeForm.tsx`, `MfaManage.tsx` | `src/components/auth/` | `sonner` → `useToast`; barvy ikon z tokenů (`text-success`, `text-warning`) |
| `components/mfa/SysAdminMfaGate.tsx` | `src/components/auth/MfaGate.tsx` | brána pro celou aplikaci, ne jen pro sysadmin; obal přes `AuthShell` místo pevných zinc barev |
| `components/SysAdminGuard.tsx` | `src/components/auth/RequireAuth.tsx` | bez `profiles.is_sysadmin`; poslouchá `onAuthStateChange` (odhlášení v jiné kartě) |
| `pages/AdminAuth.tsx` + `pages/ClientAuth.tsx` | `src/pages/Login.tsx` | jeden formulář; obnova hesla přes `supabase.auth.resetPasswordForEmail` — CRM volalo edge funkci `send-password-reset-email` (Resend, šablony a log v `crm`) |
| `pages/ResetPassword.tsx` | `src/pages/ResetPassword.tsx` | obě varianty recovery flow (PKCE `?code=` i implicit hash) zůstaly |
| obal karty z `ClientAuth` | `src/components/auth/AuthShell.tsx` | nové: jeden obal pro všechny čtyři obrazovky |

**Nepřebráno:** `SysAdminLogin.tsx`, `PasswordChangeRequired.tsx` (vynucená
změna hesla po založení adminem — Doktor účty nezakládá), `OAuthCallback.tsx`,
`fetchEffectiveAppRoles` / `rolesIncludeCrmStaff` / `resolveClientEntry`
(role a přesměrování podle nich), `profiles.must_change_password`,
`playLoginJingle`, `ClientPortalLocaleContext`, `LoginAurora`, `VividbooksLogo`,
odkazy na zásady a obchodní podmínky.

**Routy** v `App.tsx`: `/prihlaseni` a `/reset-hesla` veřejné, všechno ostatní
za `RequireAuth` (session → MFA → obsah). Za přihlášením je zatím prázdná
stránka — obrazovky přijdou s dalšími řádky.

**Co si tohle žádá od Supabase (O3):** zapnuté TOTP MFA v Auth, `password_min_length = 12`
(stejně jako `MIN_PASSWORD_LENGTH`), redirect URL `<doména>/reset-hesla` v allow-listu
a e-mailovou šablonu obnovy hesla. Bez O3 a O4 se přihlásit nedá — zapsáno v `notes.md`.

### Podpisy (20. 9. 2026)

**Přeneseno:** `lib/emailSignature.ts` → `src/lib/email/signature.ts`
a `lib/emailSignaturePaste.ts` → `src/lib/email/signaturePaste.ts`, obojí beze změny
chování; `components/vividbooks/EmailSignatureEditor.tsx` →
`src/components/email/SignatureEditor.tsx`.

CRM má editory dva. Tabulka jmenuje ten z `vividbooks/` (novější, dva režimy Podpis ·
HTML kód, používá ho ProfilePage); starší `components/SignatureEditor.tsx` (tři režimy,
`useSignatureImageUpload` nad storage, jediný uživatel `.signature-surface`) se nebere.
Knihovna `emailSignaturePaste.ts` patřila k tomu staršímu — přebírá se stejně, protože
její `rehostSignatureImages` je lepší než `materializeImages` z novějšího editoru (umí
`blob:`, ruší `srcset`, má záložní chování bez úložiště), a editor ji teď používá.

| Bylo | Je | Proč |
|---|---|---|
| `supabase.storage.from("company-assets").upload(...)` | prop `onUploadImage: SignatureImageUploader` | kam se obrázky podpisu ukládají, rozhodne K3.3 (engine, nebo úložiště); bez propu zůstanou malé `data:` obrázky vložené, větší vypadnou s hláškou |
| `Segmented` z `components/reports/Viz.tsx` | `ToggleGroup` z kitu | primitivum z kitu místo vlastní komponenty (CLAUDE.md, „Čeho se vyvarovat") |
| `toast` ze `sonner` | `useToast` | sonner se nepřebral |
| texty včetně „z CRM (pracovní plocha, nabídky, hromadné oslovení)" | `cs.posta.podpis.*` | slovník |
| `profiles.email_signature` | `podpisy.html` (jen v komentářích) | schéma `doktor` |

Testy `emailSignature.test.ts` a `emailSignaturePaste.test.ts` zůstaly ve zdroji — repozitář
nemá testovací běh. Jsou to čisté funkce, přenesou se, až běh bude.

`EmailCompose` napojení už má: `signatureHtml={emailSignatureToEditorHtml(podpis.html)}`.
Výběr podpisu podle schránky (`vychozi_pro_schranku`, `odeslat_z`) je K3.3 a čeká na O5.

## Nepřebírat

- schéma `crm` (122 tabulek, organizace, billing, Kabinet, reality)
- datovou vrstvu úkolů (příspěvky na zdi obchodu) — úkoly mají vlastní tabulku
- `vb-assistant` a ostatní AI funkce přes API klíč
- `task_gcal_sync` — jen jako vzor
- embeddingy přes Gemini
- záložky Používání, Skóre, Obchody
- `api/email/imap.ts` **pro ÚVN** — se schránkou mluví jen engine. Pro další schránky
  zůstává jako možnost.

## Co CRM neumí a co musíme dodělat sami

Z průzkumu 20. 9.: jedna schránka na uživatele, přílohy base64 do 3 MB, hledání živě přes
IMAP, bez konceptů, kalendář jen Google, AI přes API klíč, žádné MCP. Sjednocená schránka,
přílohy odkazem, index s fulltextem, koncepty, tři vrstvy kalendářů a MCP jsou naše práce.

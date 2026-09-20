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
| Komponenty pošty | `src/components/email/*` (Inbox, Compose, RichEditor, FolderNav, Templates, SignaturePreview, WorkPanel, RecipientsInput) | `src/components/email/` | ☐ |
| Podpisy | `src/lib/emailSignature*.ts`, `components/vividbooks/EmailSignatureEditor.tsx` | `src/lib/email/signature*.ts`, `src/components/email/SignatureEditor.tsx` | ☐ |
| Karta kontaktu | `pages/VbPersonDetailPage.tsx`, `components/vividbooks/EntityDetailShell.tsx`, `ActivityTimeline.tsx`, `ActivityDialog.tsx`, `ActivityPanel.tsx`; z `EntityWall.tsx` koncept a části UI | `src/pages/ContactDetail.tsx`, `src/components/contacts/` | ☐ |
| Kontext u e-mailu | `components/vividbooks/CrmEmailContext.tsx` | `src/components/email/EmailContext.tsx` | ☐ |
| Úkoly | `pages/crm/VbTasksPage.tsx`, `components/tasks/*` | `src/pages/Tasks.tsx`, `src/components/tasks/` | ☐ |
| Kanban | `components/sales/SalesKanban*.tsx`, `components/kanban/*` | `src/components/kanban/` | ☐ |
| Dnes | `pages/HomePage.tsx`, `components/home/TodaySignals.tsx`, `EvidenceChips.tsx`; vzor `crm.today_signals()` | `src/pages/Today.tsx`, `src/components/home/` | ☐ |
| Zápisy | vzor `plaud-intake`, `crm.call_recordings`, `CallRecordingsInbox.tsx` | `src/components/notes/` | ☐ |
| Přehled práce agenta | `AgentRunsHistory.tsx`, vzor `agent_commands` | `src/components/runs/` | ☐ |
| Přihlášení | Supabase Auth, `components/mfa/*`, stránky Auth/Reset | `src/lib/supabase/`, `src/components/auth/` | ☐ |
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
`.signature-surface` (Podpisy), `.animate-fade-in-up` a `.home-surface*` (Dnes),
`.animate-task-complete-out` (Úkoly).

**Až se bude přebírat Úkoly a Pošta**, čeká na remapování na tokeny Doktora:
`TaskDetailDialogChrome.tsx` a `TaskContextPreviewCards.tsx` sahají na `--deal-*`,
`EmailCompose.tsx` na jednu barvu z `neon-*`.

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

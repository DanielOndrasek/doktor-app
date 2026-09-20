# Převzetí z vividbooks CRM

Zdroj: `vividbooks/vividbooks-ultra`, větev `crm/s0-skeleton`, **commit `831f9ae6`**.
Cesty ve sloupci „Odkud“ jsou vůči kořeni zdrojového repozitáře.

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
| UI kit | `src/components/ui/*` | `src/components/ui/` | ☐ |
| Vzhled, tokeny | `src/index.css`, `tailwind.config.ts`, `WhitelabelThemeHost` | `src/index.css`, `tailwind.config.ts`, `src/components/ThemeHost.tsx` | ☐ |
| Kontrakt pošty | `src/lib/email/types.ts` (`MailboxClient`) | `src/lib/email/types.ts` | ☐ |
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

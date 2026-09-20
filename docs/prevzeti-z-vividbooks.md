# Převzetí z vividbooks CRM

Zdroj: `vividbooks-ultra`, větev `crm/s0-skeleton`, **commit `831f9ae6`**.

**Kopie ke commitu, ne fork.** Soubory se zkopírují, přebarví a dál žijí vlastním životem.
Žádný upstream remote, žádné merge zpět. Kdo bude za rok hledat, proč se něco liší,
najde odpověď tady, ne v historii cizího repozitáře.

Při kopírování: odstřihnout závislosti na schématu `crm`, na organizacích a na billingu.
Co zbyde po odstřižení, musí dávat smysl samo — pokud ne, je to znamení, že se přebírá
špatná vrstva.

## Přebrat

| Oblast | Soubory | Hotovo |
|---|---|---|
| UI kit, vzhled | `src/components/ui/*`, `src/index.css` (tokeny), `tailwind.config.ts`, `WhitelabelThemeHost` | ☐ |
| Pošta | `src/lib/email/types.ts` (kontrakt `MailboxClient`), `gmailMailbox.ts`, `components/email/*` (Inbox, Compose, RichEditor, FolderNav, Templates, SignaturePreview, WorkPanel, RecipientsInput), `lib/emailSignature*.ts`, `components/vividbooks/EmailSignatureEditor.tsx` | ☐ |
| Karta kontaktu | `pages/VbPersonDetailPage.tsx`, `components/vividbooks/EntityDetailShell.tsx`, `ActivityTimeline.tsx`, `ActivityDialog.tsx`, `ActivityPanel.tsx`; z `EntityWall.tsx` koncept a části UI | ☐ |
| Kontext u e-mailu | `components/vividbooks/CrmEmailContext.tsx` | ☐ |
| Úkoly | `pages/crm/VbTasksPage.tsx`, `components/tasks/*`, kanban z `components/sales/SalesKanban*.tsx` + `components/kanban/*` | ☐ |
| Dnes | `pages/HomePage.tsx`, `components/home/TodaySignals.tsx`, `EvidenceChips.tsx`; vzor `crm.today_signals()` | ☐ |
| Zápisy | vzor `plaud-intake`, `crm.call_recordings`, `CallRecordingsInbox.tsx` | ☐ |
| Přehled práce agenta | `AgentRunsHistory.tsx`, vzor `agent_commands` | ☐ |
| Přihlášení | Supabase Auth, `components/mfa/*`, stránky Auth/Reset | ☐ |
| Disk | `components/google/*` (Picker, `drive.file`), funkce `drive-access-token` | ☐ |
| Gmail | funkce `gmail-auth`, `gmail-callback`, `gmail-*` (ověřený OAuth klient) | ☐ |

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

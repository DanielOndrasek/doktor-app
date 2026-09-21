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

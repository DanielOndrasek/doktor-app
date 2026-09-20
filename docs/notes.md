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
„Co se při kopírování rozhodlo". Dvě věci čekají na další řádky: `EmailCompose`
posílá přílohy jako `uploadIds` (ne base64), takže `engineMailbox.ts` (K3.2) musí
rozhodnout, jak se `upload_id` dostane do `send` — kontrakt `MailboxClient` na to
pole nemá. A `KanbanCard` je projekce řádku `ukoly`; mapování napíše obrazovka
Úkoly (K3.6), až budou typy z K2.

**20. 9. 2026 — šablony zpráv (K2).** Schéma `doktor` v plánu nemá tabulku šablon,
ale řádek Komponenty pošty nese `EmailTemplatesDialog`. Dialog je props-driven
(`EmailTemplate` v `lib/email/compose.ts`); kde se šablony uloží, je otázka pro K2
vedle `podpisy` a `pravidla`.

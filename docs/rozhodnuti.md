# Otevřená rozhodnutí

Živý seznam. Plán (`plan-doktor-aplikace.md`, oddíl 7) je snímek k 20. 9. 2026; rozhodnuté
věci se zapisují sem, ne do plánu. U každého rozhodnutí dopiš datum a jednu větu proč.

| # | Rozhodnutí | Kdo | Blokuje | Stav |
|---|---|---|---|---|
| O1 | Uvolnit pravidlo „data jen z téhož vlákna“ na tři úrovně (vlákno · týž pacient se shodou dvou údajů · slabá shoda jen v panelu) | Š | K4.7 | **rozhodnuto 21. 9.** |
| O2 | Karty pacientů ne; vlákna o pacientovi jako „případ“ pod odesílajícím lékařem | Š | K4.1 | **rozhodnuto 21. 9.** |
| O3 | Databáze: Supabase EU, nebo vše na Hetzneru | D | K2.1 | otevřeno — návrh níže |
| O4 | Doména aplikace pod ověřeným Google OAuth projektem → **Gmail bez OAuth?** | D + Š | K2.1 | otevřeno — návrh níže |
| O5 | Seznam a názvy podpisů (podklad z K1.7) | Š | K3.3 | otevřeno |
| O6 | Sjednotit úkoly s „Rozdělanou prací“ do jedné tabulky | Š + D | K2.5 | otevřeno |
| O7 | Povolit úpravu a mazání vlastních událostí v kalendáři | Š | K5 | otevřeno |
| O8 | API pojistka pro spadlý ranní běh, měsíční strop | D | K5 | otevřeno |
| O9 | Které složky Disku sdílet se služebním účtem | Š | K4.4 | otevřeno |

**O3 a O4 blokují všechno ostatní v této aplikaci** — bez databáze a bez domény pod
ověřeným OAuth projektem nemá K3 kam ukládat a kam se přihlašovat.

## Rozhodnuto

**O1 — uvolnit na tři úrovně** (Š, 21. 9. 2026). Podklady k odpovědi se skládají ze tří
úrovní: (1) totéž vlákno vždy, (2) týž pacient při shodě dvou údajů, (3) slabá shoda jen
v bočním panelu jako nabídka, ne do návrhu. Proč: pravidlo „jen totéž vlákno" nechávalo
návrhy bez kontextu u pacientů, o kterých se píše ve více vláknech. Dopad: K4.7 a nástroj
`podklady_k_odpovedi` na enginu — úroveň musí být ve výstupu vidět.

**O2 — ano, případy** (Š, 21. 9. 2026). Karty pacientů nevzniknou; vlákna o jednom
pacientovi se drží jako „případ" (`pripady`) pod odesílajícím lékařem (`kontakty`). Proč:
pacient není kontakt aplikace a nemá v ní mít vlastní záznam — rodné číslo nikdy do
aplikace (pravidlo 7). Dopad: K4.1 (karta kontaktu ukazuje případy), schéma `pripady`
v K2.2 zůstává podle oddílu 3 plánu.

## Návrh k O3

**Supabase EU (Frankfurt), samostatný projekt.** Auth + TOTP MFA + RLS + zálohy jsou
hotové a přihlášení na nich stojí; v Supabase jsou jen metadata (pravidlo 5), těla, přílohy
a rodná čísla zůstávají na enginu. Hetzner by znamenal provozovat Postgres, auth a zálohy
vlastními silami před K1/K2. Podmínky: region EU, DPA se Supabase, a ověřit, jestli ÚVN
nemá politiku k cloudu u dat se jmény pacientů. Čeká na ano od D.

## Návrh k O4

**Zadání se změnilo (21. 9.):** Štěpán má osobní @gmail.com, ne účet ve Workspace. Interní
aplikace (jak jede CRM) je tím pádem mimo — interní aplikaci může použít jen účet z téže
organizace. Externí projekt s restricted scope (`gmail.modify`) vyžaduje ověření a CASA,
kterým neprošel ani Vividbooks, ani Nemo. Režim Testing zneplatňuje refresh token po 7 dnech.
Žádná OAuth cesta tedy bez ověření nevede.

**Návrh: Gmail přes IMAP/SMTP s heslem aplikace, na enginu — stejně jako ÚVN.**

- Štěpán si v Google účtu zapne dvoufázové ověření a vygeneruje **heslo aplikace**
  (16 znaků). Žádný Cloud projekt, žádný consent screen, žádné ověření, žádná CASA.
- Engine přidá druhý IMAP účet (`imap.gmail.com:993`, `smtp.gmail.com:465`). Jeden
  zapisovač zůstává (pravidlo 1), index, `mail_move` s `novy_ref`, `mail_get` HTML,
  přílohy odkazem — všechno z K1 platí i pro Gmail beze změny kontraktu. Aplikace nic
  nepozná: `engineMailbox` se `schranka = gmail`.
- Gmail specifika, která engine řeší jednou: štítky jsou složky (`_Triage/Vyřízeno` = štítek),
  archiv = odebrat z `INBOX` (přesun do `[Gmail]/All Mail`), vlákna přes rozšíření
  `X-GM-THRID`, odeslané přes SMTP se samy ukládají do Sent.

**Dopad na tabulku převzetí:** řádky „Gmail klient" (`gmailMailbox.ts`) a „Gmail OAuth"
(`gmail-auth`, `gmail-callback`) přecházejí do **Nepřebírat** — byly pro OAuth cestu.
Tím padá i původní znění O4 (doména pod ověřeným projektem): subdoménu Doktor potřebuje
jen pro Vercel a Supabase redirect, ne pro Google.

**Rizika, poctivě:** (1) heslo aplikace je plný přístup ke schránce — musí být jen v tajemstvích
enginu, nikdy v aplikaci ani v Supabase; (2) Google doporučuje OAuth a hesla aplikací může
u osobních účtů časem omezit — dnes (2026) jsou dostupná a IMAP/SMTP se neruší; kdyby se to
změnilo, zbývá jen ověření externího projektu; (3) hesla aplikací nejsou k dispozici, když je
2FA jen přes bezpečnostní klíč nebo Advanced Protection.

Čeká na ano od D a od Š (Š musí heslo vygenerovat).

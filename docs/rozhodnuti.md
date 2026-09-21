# Otevřená rozhodnutí

Živý seznam. Plán (`plan-doktor-aplikace.md`, oddíl 7) je snímek k 20. 9. 2026; rozhodnuté
věci se zapisují sem, ne do plánu. U každého rozhodnutí dopiš datum a jednu větu proč.

| # | Rozhodnutí | Kdo | Blokuje | Stav |
|---|---|---|---|---|
| O1 | Uvolnit pravidlo „data jen z téhož vlákna“ na tři úrovně (vlákno · týž pacient se shodou dvou údajů · slabá shoda jen v panelu) | Š | K4.7 | **rozhodnuto 21. 9.** |
| O2 | Karty pacientů ne; vlákna o pacientovi jako „případ“ pod odesílajícím lékařem | Š | K4.1 | **rozhodnuto 21. 9.** |
| O3 | Databáze: Supabase EU, nebo vše na Hetzneru | D | K2.1 | otevřeno — návrh níže |
| O4 | Doména aplikace pod ověřeným Google OAuth projektem | D | K2.1 | **rozhodnuto 21. 9.** |
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

**O4 — interní aplikace ve Workspace Vividbooks** (D, 21. 9. 2026). Stejně jako CRM:
OAuth consent screen typu *Internal* v Cloud projektu pod organizací Workspace Vividbooks,
subdoména `doktor.vividbooks.com`. Interní aplikace nepotřebuje ověření ani CASA a tokeny
neexpirují po 7 dnech; restricted scope `gmail.modify` je povolený. Proč: ověření externího
projektu s restricted scopes je 4–12 týdnů a laboratoř každý rok; interní cesta je hodina
práce a CRM na ní už běží.

**Podmínka, bez které to nefunguje:** interní aplikaci může použít jen účet Google Workspace
z téže organizace. Gmail schránka Štěpána tedy musí být účet ve Workspace Vividbooks —
osobní @gmail.com do interní aplikace nepustí. Pokud Štěpán účet v organizaci nemá, dostane
ho, a rozhodnout, jak se k němu dostane pošta z dosavadní adresy (přesměrování), musí on.
Dopad: řádek „Gmail OAuth" v `prevzeti-z-vividbooks.md` (funkce `gmail-auth`,
`gmail-callback`) se přebírá beze změny; nastavení je v `notes.md`.

## Návrh k O3

**Supabase EU (Frankfurt), samostatný projekt.** Auth + TOTP MFA + RLS + zálohy jsou
hotové a přihlášení na nich stojí; v Supabase jsou jen metadata (pravidlo 5), těla, přílohy
a rodná čísla zůstávají na enginu. Hetzner by znamenal provozovat Postgres, auth a zálohy
vlastními silami před K1/K2. Podmínky: region EU, DPA se Supabase, a ověřit, jestli ÚVN
nemá politiku k cloudu u dat se jmény pacientů. Čeká na ano od D.

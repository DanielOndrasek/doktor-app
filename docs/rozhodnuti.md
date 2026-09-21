# Otevřená rozhodnutí

Živý seznam. Plán (`plan-doktor-aplikace.md`, oddíl 7) je snímek k 20. 9. 2026; rozhodnuté
věci se zapisují sem, ne do plánu. U každého rozhodnutí dopiš datum a jednu větu proč.

| # | Rozhodnutí | Kdo | Blokuje | Stav |
|---|---|---|---|---|
| O1 | Uvolnit pravidlo „data jen z téhož vlákna“ na tři úrovně (vlákno · týž pacient se shodou dvou údajů · slabá shoda jen v panelu) | Š | K4.7 | **rozhodnuto 21. 9.** |
| O2 | Karty pacientů ne; vlákna o pacientovi jako „případ“ pod odesílajícím lékařem | Š | K4.1 | **rozhodnuto 21. 9.** |
| O3 | Databáze: Supabase EU, nebo vše na Hetzneru | D | K2.1 | otevřeno |
| O4 | Doména aplikace pod ověřeným Google OAuth projektem | D | K2.1 | otevřeno |
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

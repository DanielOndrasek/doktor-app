# Převzaté kontrakty chování

Testy a popisy chování, které vznikly nad artefaktem „Schránka“ a **musí platit i v aplikaci**.
Nejsou to testy tohoto repozitáře — běžely proti kódu artefaktu. Jsou tu jako zadání:
až se dané chování přepíše do aplikace, přepíše se i test, ale pravidla, která popisuje,
se měnit nesmějí.

## `t22-vratit-zpet.test.js` — Vrátit zpět po ✓ (K0.1 → K3.2)

Co test drží, případ po případu:

1. **Odškrtnutí a hned Vrátit zpět** nesmí sáhnout na schránku vůbec. Deset sekund je
   odpočet, ne odložený přesun — dokud běží, zpráva se nehýbe a stav se vrátí na `nove`.
2. **Když odpočet doběhne**, zpráva se přesune do `_Triage/Vyřízeno` a uloží se `novy_ref`,
   který vrátil server. Ne ten původní, ne dopočítaný — ten ze serveru (ÚKOL 35).
3. **Návrat z archivu**, když server `novy_ref` nevrátil: `mail_najdi` selže, dohledá se
   přes index podle odesílatele a data, přesune se zpět do `INBOX` a `uvn_ref` se obnoví
   na to, co `mail_najdi` najde po přesunu.
4. **Když se zpráva dohledat nedá**, stav se přesto vrátí na `nove`, uživatel dostane
   varování a **žádný přesun se nezkouší naslepo**.
5. **Gmail** se řeší štítky: `INBOX` zpět, „Vyřízeno“ pryč. Pořadí operací je součást
   kontraktu.
6. **Když přesun selže**, příznak `presun_ceka` zůstane, pokus se započte a chyba se
   propíše nahoru. Nic se nepředstírá.
7. **Dodatečný úklid po načtení** proběhne jen u čekajících položek, jen jednou, a má
   strop pokusů. Dvojí spuštění nesmí poslat dva přesuny.
8. **Kliknutí na lištu** dělá totéž co volání přímo, včetně hlášky „vráceno“.

Pravidlo za tím vším: dokud odpočet běží, schránka o ničem neví; jakmile doběhne, zdrojem
pravdy o umístění zprávy je odpověď serveru, ne to, co si aplikace pamatuje.

# CLAUDE.md — Doktor (aplikace)

Pokyny pro Claude Code v tomto repozitáři. Čti tento soubor před každou změnou.

---

## Co stavíme

Aplikace, která nahradí artefakt „Schránka“. Dává dohromady e-mailovou schránku ÚVN a Gmail
s tříděním a návrhy odpovědí, CRM kontaktů s historií, úkoly s kanbanem, události, přílohy
a most do Clauda přes MCP. **Nemá nahradit Apple Mail** — má dát třídění, kontext, CRM a most
do Clauda.

**Kompletní plán: `docs/plan-doktor-aplikace.md`.** Tento repozitář je „CC-A“ z tabulky rolí
v oddílu 1 plánu, tedy aplikace. Server (`uvn-mail-mcp`, engine) je samostatná věc a jeho
zadání je v `docs/zadani-serveru-doktor-k1.md` — sem se kód enginu nepíše.

Aktuální fáze: **K3 — Aplikace v1.** Nikdy neimplementuj mimo aktuální etapu; pokud narazíš
na něco z K4 nebo K5, poznamenej to do `docs/notes.md` a pokračuj. K3 stojí na hotovém
K1 a K2 na enginu — dokud REST `/api/v1` nestojí, píše se proti kontraktu, ne proti fantazii
o tom, co engine vrátí.

---

## Stack

```
React 19 · Vite · TypeScript strict
Tailwind CSS · shadcn/ui (kopie UI kitu z vividbooks)
@supabase/supabase-js (Auth + MFA, RLS)
TanStack Query v5 · date-fns (cs) · lucide-react · @dnd-kit (kanban)
Deploy: Vercel
```

Nepřidávej další závislosti bez ptaní. Zejména: žádný state manager navíc (React state +
TanStack Query stačí), žádné CSS-in-JS, žádná AI knihovna a žádné volání modelu z aplikace —
přemýšlení je v Claude, hledání na enginu.

---

## Nepřekročitelná pravidla

Vycházejí ze zásad v oddílu 1 plánu a z rizik v oddílu 9. Neobcházej je ani dočasně při ladění.

1. **Jeden zapisovač nad schránkou.** Se schránkami mluví **jen engine**. Aplikace nikdy
   neotevírá IMAP, SMTP ani Gmail API napřímo. Vercel handler `api/email/imap.ts` z CRM
   se pro ÚVN nepoužije.

2. **Příloha se předává odkazem, nikdy jako base64.** Ani přes Clauda, ani přes prohlížeč.
   Nahrání jde multipartem na engine a vrací `upload_id`.

3. **Nic se nemaže.** `trashMessage`, `deleteFolder` a `createFolder` se nevystavují —
   ani v UI, ani v datové vrstvě.

4. **Stav se odvozuje ze schránky**, ne jen z kliknutí. Zdroj stavu se zapisuje
   (`stav_zdroj`: klik, schranka, beh) a odpověď odeslaná z Mailu nebo iPhonu položku
   uzavírá stejně jako odeslání z aplikace.

5. **Těla zpráv, bajty příloh a text příloh zůstávají na enginu.** V Supabase jen metadata.

6. **RLS je zapnutá na všech tabulkách** schématu `doktor` a každá tabulka má `user_id`,
   i když je uživatel zatím jeden. Přístup sekretariátu přijde později.

7. **Rodné číslo nikdy do těla zprávy.** Jména pacientů se píší normálně. Maskování má
   jedinou implementaci na enginu — v aplikaci se nekopíruje.

8. **Nic se neodesílá samo.** Odeslání vždy za potvrzením. „Odeslat z“ jiné schránky
   než té, do které zpráva přišla, hlásí varování.

9. **Kopie z vividbooks je kopie ke commitu `831f9ae6` (větev `crm/s0-skeleton`), ne fork.**
   Žádné sledování upstreamu, žádné merge zpět. Co se přebírá a co ne, je v oddílu 2 plánu
   a odškrtává se v `docs/prevzeti-z-vividbooks.md`.

10. **Migrace jsou jen dopředné.** Nikdy needituj už aplikovanou migraci, vždy přidej novou
    do `supabase/migrations/`.

---

## Struktura

```
src/
  components/        UI kit (shadcn), doménové komponenty: email, tasks, contacts, home
  pages/             obrazovky: Dnes, Pošta, Úkoly, Události, Kontakty, Nastavení
  lib/
    email/           kontrakt MailboxClient + engineMailbox.ts (třetí implementace)
    supabase/        klient, auth, MFA
    i18n/cs.ts       VŠECHNY UI texty
supabase/migrations/ SQL migrace schématu doktor
docs/                plán, zadání enginu, rozhodnutí, poznámky, převzaté kontrakty
```

---

## Konvence

**Jazyk.** UI je česky. **Žádný uživatelsky viditelný text nepiš přímo do komponenty** —
vždy přes `src/lib/i18n/cs.ts`. Kód, názvy proměnných a komentáře jsou anglicky; komentář
k byznys pravidlu smí být česky, pokud je to srozumitelnější.

**Databáze je česky.** Schéma `doktor` (oddíl 3 plánu) má české názvy tabulek a sloupců
(`polozky`, `ukoly`, `kontakty`, `stav_zdroj`, `navrh_telo`, …). Je to dané plánem —
nepřejmenovávej je a nepřidávej sloupce navíc. Typy generuj, nepiš ručně:
`supabase gen types typescript > src/types/database.ts`.

**Stavy úkolu** jsou přesně `todo, probiha, ceka, hotovo, odlozeno, zruseno`. Kanban má
sloupce TODO · V procesu · Čekám · Hotovo · Odloženo. Nevymýšlej varianty.

**Datum a čas.** V DB `timestamptz`. V UI relativně („za 3 dny“) s absolutním datem
v `title`. Formátuj jen přes `date-fns` s `cs` locale, nikdy `toLocaleString`.

**Idempotence.** Každý zápis, který může přijít víckrát (z běhu, z Clauda, ze synchronizace),
nese `zdroj_id` s unikátním indexem.

---

## Čeho se vyvarovat

- Volat schránku odjinud než z enginu.
- Držet tělo zprávy nebo přílohu v Supabase „jen pro rychlost“.
- Počítat oprávnění v klientu jako bezpečnostní opatření. Skutečná ochrana je RLS
  a validace JWT na enginu.
- Přepsat rozepsaný text uživatele výsledkem běhu (E3 v kontrolním seznamu).
- Zapsat cokoli do kalendáře jinak než na kliknutí.
- Vytvářet vlastní komponenty tam, kde stačí primitivum z převzatého UI kitu.
- Přebírat z vividbooks to, co je v plánu vypsané jako **nepřebírat** (schéma `crm`,
  billing, `vb-assistant`, embeddingy, datová vrstva úkolů přes zeď obchodu).

---

## Kontrola před dokončením etapy

```bash
npx tsc --noEmit          # bez chyb
npm run lint              # bez chyb
npm run build             # projde
```

Pak ručně: přihlásit se s MFA, projít Poštu, Úkoly a Dnes a ověřit proti kontrolnímu
seznamu v oddílu 6 plánu, že žádná funkce Schránky nezmizela.

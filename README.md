# Doktor — aplikace

Vlastní aplikace pro e-mailovou schránku, CRM kontaktů, úkoly a přílohy, která nahrazuje
artefakt „Schránka“ a propojuje poštu s Claudem přes MCP.

Repozitář odpovídá roli **CC-A** z plánu: aplikace (frontend + schéma databáze). Serverový
engine `uvn-mail-mcp` je samostatný a jeho zadání pro fázi K1 je zde jen pro referenci.

## Stav

| Fáze | Co | Kde se dělá | Stav |
|---|---|---|---|
| K0 | Opravy Schránky, které nečekají | artefakt | probíhá |
| K1 | Engine: `novy_ref`, HTML tělo, přílohy, párování stavu, profil ze Sent | server | zadáno |
| K2 | Databáze `doktor`, REST `/api/v1`, MCP nástroje | server + Supabase | O3, O4 rozhodnuto — může začít |
| **K3** | **Aplikace v1: Pošta, Podpisy, Přílohy, Dnes, Úkoly, Události, Kontext** | **tento repozitář** | **převzato: UI kit, vzhled, kontrakt pošty, komponenty pošty, kanban, přihlášení, podpisy, kontext, Dnes, zápisy, běhy** |
| K4 | Aplikace v2: Kontakty, pohledy, sklad příloh, Disk, CardDAV | tento repozitář | — |
| K5 | Dotažení, vypnutí artefaktu | — | — |

Artefakt „Schránka“ se vypíná až po týdnu běhů bez ručních oprav v této aplikaci.

## Dokumentace

- [`docs/plan-doktor-aplikace.md`](docs/plan-doktor-aplikace.md) — celý plán: architektura,
  datový model, rozhraní, fáze, měřítka, rizika. Zdroj pravdy.
- [`docs/zadani-serveru-doktor-k1.md`](docs/zadani-serveru-doktor-k1.md) — zadání enginu
  pro K1 (ÚKOLy 35–41). Aplikace na něm stojí.
- [`docs/zadani-serveru-doktor-gmail.md`](docs/zadani-serveru-doktor-gmail.md) — Gmail jako
  druhý IMAP účet na enginu (ÚKOLy 42–46), z rozhodnutí O4.
- [`docs/rozhodnuti.md`](docs/rozhodnuti.md) — otevřená rozhodnutí O1–O9 a co blokují.
- [`docs/prevzeti-z-vividbooks.md`](docs/prevzeti-z-vividbooks.md) — co se kopíruje
  z vividbooks CRM a co se z něj naopak nebere.
- [`docs/prevzato/`](docs/prevzato/) — kontrakty chování převzaté ze Schránky (testy).
- [`docs/notes.md`](docs/notes.md) — poznámky k věcem mimo aktuální etapu.
- [`CLAUDE.md`](CLAUDE.md) — pravidla pro práci v tomto repozitáři.

## Nastavení

```bash
cp .env.example .env.local   # doplnit adresy a klíče
npm install
npm run dev
```

Kontrola před dokončením etapy (viz `CLAUDE.md`):

```bash
npx tsc --noEmit
npm run lint
npm run build
```

Build projde. Aplikace má přihlášení s MFA (`/prihlaseni`, `/reset-hesla`), za ním
Dnes (`/`), Úkoly (`/ukoly`, kanban) a Události (`/udalosti`) nad prázdnými zdroji
a Poštu (`/posta`) nad klientem enginu — bez `VITE_ENGINE_URL` a bez K2 ukáže, že engine není propojený.
Kontext a zápisy čekají na své obrazovky. Přihlášení a data čekají na rozhodnutí O3 (kde bude databáze) a O4
(doména pod ověřeným OAuth projektem), viz `docs/rozhodnuti.md`.

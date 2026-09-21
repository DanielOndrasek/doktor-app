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
| K2 | Databáze `doktor`, REST `/api/v1`, MCP nástroje | server + Supabase | K2.2 schéma aplikováno v Supabase (10 migrací, typy vygenerované); K2.3 REST čeká na engine |
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
- [`docs/zadani-k2-schema-a-rest.md`](docs/zadani-k2-schema-a-rest.md) — K2.2 schéma
  `doktor` s RLS a K2.3 REST `/api/v1`; co aplikace už má připravené.
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
Dnes (`/`) nad `dnes()`, Úkoly (`/ukoly`: kanban, seznam po termínech, kalendář, detail a zakládání) nad tabulkou `ukoly`, Události
(`/udalosti`) nad `udalosti` se zápisem do kalendáře přes engine a Poštu (`/posta`) nad klientem enginu — bez `VITE_ENGINE_URL` a bez K2 ukáže, že engine není propojený.
Kontext a zápisy čekají na své obrazovky. Databáze je Supabase projekt `doktor` (EU, `eu-west-1`);
veřejné hodnoty pro `.env` jsou v `.env.example`, schéma v `supabase/migrations/`, typy
v `src/types/database.ts`. `TodaySource`, `TaskSource` a `EventSource` čtou a zapisují `dnes()`, `ukoly`
a `udalosti`; podpisy, adresář a kontext v Poště čekají na REST enginu (K2.3).

-- Poznámky, vazby dokumentů, pohledy, pravidla (oddíl 3 plánu) a šablony
-- (navíc proti plánu, odsouhlaseno 21. 9. — komponenty pošty je mají).

create table doktor.poznamky (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  kontakt_id uuid references doktor.kontakty (id) on delete set null,
  pripad_id uuid references doktor.pripady (id) on delete set null,
  text text not null,
  druh text not null default 'poznamka' check (druh in ('poznamka', 'zapis', 'hovor')),
  zdroj text not null default 'rucne' check (zdroj in ('plaud', 'rucne', 'claude')),
  zdroj_id text
);
create unique index poznamky_zdroj_id_uq on doktor.poznamky (user_id, zdroj_id) where zdroj_id is not null;
create index poznamky_kontakt_idx on doktor.poznamky (kontakt_id, vytvoreno desc);

create table doktor.vazby_dokumentu (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  kontakt_id uuid not null references doktor.kontakty (id) on delete cascade,
  zdroj text not null check (zdroj in ('priloha', 'disk')),
  -- odkaz do skladu příloh enginu (SHA-256), ne bajty
  priloha_sha text,
  disk_file_id text,
  nazev text,
  check (
    (zdroj = 'priloha' and priloha_sha is not null and disk_file_id is null) or
    (zdroj = 'disk' and disk_file_id is not null and priloha_sha is null)
  )
);
create index vazby_dokumentu_kontakt_idx on doktor.vazby_dokumentu (kontakt_id);

create table doktor.pohledy (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  nazev text not null,
  -- {kontakty: uuid[], dotaz: text, obdobi: {od, do}, schranky: text[]}
  filtr jsonb not null default '{}'::jsonb,
  pripnuto boolean not null default false
);

-- Převzato ze Schránky; přesnou sadu sloupců doplní přenos dat (K2.5).
create table doktor.pravidla (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  text text not null,
  kategorie text,
  aktivni boolean not null default true,
  zdroj text
);

-- Šablony zpráv pro okno psaní (`EmailTemplate` v src/lib/email/compose.ts).
create table doktor.sablony (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  nazev text not null,
  predmet text,
  telo_html text,
  zarazeni text,
  pouzito integer not null default 0
);

call doktor.zapni_rls('poznamky');
call doktor.zapni_rls('vazby_dokumentu');
call doktor.zapni_rls('pohledy');
call doktor.zapni_rls('pravidla');
call doktor.zapni_rls('sablony');

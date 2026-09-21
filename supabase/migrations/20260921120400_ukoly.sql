-- Úkoly (oddíl 3 plánu). Stavy přesně: todo, probiha, ceka, hotovo, odlozeno, zruseno.
-- Navíc proti plánu (odsouhlaseno 21. 9., zadání K2 část A.3):
--   stav_zmenen  — „X dní ve sloupci" na kartě kanbanu, drží trigger
--   stav_zdroj   — pravidlo 4 platí i pro úkoly: klik, schránka, běh

create table doktor.ukoly (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  nazev text not null,
  popis text,
  stav text not null default 'todo'
    check (stav in ('todo', 'probiha', 'ceka', 'hotovo', 'odlozeno', 'zruseno')),
  stav_zmenen timestamptz not null default now(),
  stav_zdroj text not null default 'klik' check (stav_zdroj in ('klik', 'schranka', 'beh')),
  odlozeno_do date,
  priorita text,
  termin date,
  cas time,
  druh text,
  oblast text,
  zdroj text not null default 'rucne' check (zdroj in ('email', 'claude', 'rucne', 'plaud')),
  -- idempotence: zápis z běhu, z Clauda nebo z Plaudu smí přijít víckrát
  zdroj_id text,
  claude_projekt text,
  polozka_id uuid references doktor.polozky (id) on delete set null,
  kontakt_id uuid references doktor.kontakty (id) on delete set null,
  kal_uid text,
  poradi integer not null default 0
);
create unique index ukoly_zdroj_id_uq on doktor.ukoly (user_id, zdroj_id) where zdroj_id is not null;
create index ukoly_stav_idx on doktor.ukoly (user_id, stav, poradi);
create index ukoly_termin_idx on doktor.ukoly (user_id, termin);
create index ukoly_kontakt_idx on doktor.ukoly (kontakt_id);

create or replace function doktor.ukoly_stav_zmenen()
returns trigger
language plpgsql
as $$
begin
  if new.stav is distinct from old.stav then
    new.stav_zmenen := now();
  end if;
  return new;
end;
$$;

create trigger ukoly_stav_zmenen
  before update on doktor.ukoly
  for each row execute function doktor.ukoly_stav_zmenen();

call doktor.zapni_rls('ukoly');

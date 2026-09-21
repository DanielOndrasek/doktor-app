-- Události (oddíl 3 plánu): návrhy z mailů, kolize, zápis do kalendáře jen na kliknutí.
-- Navíc proti plánu (odsouhlaseno 21. 9.): zdroj_id — běh navrhne tutéž událost
-- z téže zprávy v 7:00 i ve 13:00; bez klíče by vznikly dva návrhy.

create table doktor.udalosti (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  polozka_id uuid references doktor.polozky (id) on delete set null,
  nazev text not null,
  zacatek timestamptz not null,
  konec timestamptz,
  celodenni boolean not null default false,
  misto text,
  -- id kalendáře z `cal_calendars` (jedna ze tří vrstev)
  kalendar text,
  stav text not null default 'novy' check (stav in ('novy', 'pridano', 'zamitnuto')),
  -- vyplní se až po `cal_pridat` — tedy po kliknutí, nikdy z běhu
  kal_uid text,
  -- [{nazev, zacatek, konec, kalendar}] z `cal_free`
  kolize jsonb not null default '[]'::jsonb,
  zdroj_id text,
  check (konec is null or konec >= zacatek)
);
create unique index udalosti_zdroj_id_uq on doktor.udalosti (user_id, zdroj_id) where zdroj_id is not null;
create index udalosti_stav_idx on doktor.udalosti (user_id, stav, zacatek);

call doktor.zapni_rls('udalosti');

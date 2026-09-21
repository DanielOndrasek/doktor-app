-- Kontakty, organizace, adresy, telefony, štítky, případy (oddíl 3 plánu; O2 = ano).

create table doktor.organizace (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  nazev text not null,
  domena text
);
create unique index organizace_domena_uq on doktor.organizace (user_id, domena) where domena is not null;

create table doktor.kontakty (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  jmeno text,
  prijmeni text,
  tituly text,
  organizace_id uuid references doktor.organizace (id) on delete set null,
  role text,
  poznamka text,
  zdroj text,
  -- {osloveni, tykani, podpis, paticka, jazyk, odesilat_z, spocteno} — z kontakt_profil (ÚKOL 40)
  profil_psani jsonb,
  ulozit_do_kontaktu boolean not null default false,
  carddav_uid text,
  sloucen_do uuid references doktor.kontakty (id) on delete set null
);
create index kontakty_jmeno_idx on doktor.kontakty (user_id, prijmeni, jmeno);

create table doktor.kontakt_adresy (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  kontakt_id uuid not null references doktor.kontakty (id) on delete cascade,
  -- vždy malými písmeny, ať shoda s hlavičkou From nezávisí na velikosti
  hodnota text not null check (hodnota = lower(hodnota)),
  primarni boolean not null default false,
  unique (user_id, hodnota)
);
create index kontakt_adresy_kontakt_idx on doktor.kontakt_adresy (kontakt_id);

create table doktor.kontakt_telefony (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  kontakt_id uuid not null references doktor.kontakty (id) on delete cascade,
  hodnota text not null,
  primarni boolean not null default false,
  unique (user_id, hodnota)
);

create table doktor.stitky (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  nazev text not null,
  unique (user_id, nazev)
);

create table doktor.kontakt_stitky (
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  kontakt_id uuid not null references doktor.kontakty (id) on delete cascade,
  stitek_id uuid not null references doktor.stitky (id) on delete cascade,
  primary key (kontakt_id, stitek_id)
);

-- Případ = vlákna o jednom pacientovi pod odesílajícím lékařem (O2).
-- Pacient tu nemá záznam; jeho jméno je jen v `nazev` (pravidlo 7: rodné číslo nikdy).
create table doktor.pripady (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  nazev text not null,
  kontakt_id uuid references doktor.kontakty (id) on delete set null
);
create index pripady_kontakt_idx on doktor.pripady (user_id, kontakt_id);

call doktor.zapni_rls('organizace');
call doktor.zapni_rls('kontakty');
call doktor.zapni_rls('kontakt_adresy');
call doktor.zapni_rls('kontakt_telefony');
call doktor.zapni_rls('stitky');
call doktor.zapni_rls('kontakt_stitky');
call doktor.zapni_rls('pripady');

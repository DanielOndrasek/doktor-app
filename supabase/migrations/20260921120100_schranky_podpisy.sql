-- Schránky a podpisy (oddíl 3 plánu). Odkazují na sebe navzájem, proto
-- v jedné migraci; cizí klíč se přidá až po obou tabulkách.

create table doktor.schranky (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  typ text not null check (typ in ('uvn', 'gmail', 'mediendo')),
  adresa text not null,
  vychozi_podpis_id uuid,
  aktivni boolean not null default true,
  unique (user_id, adresa)
);

create table doktor.podpisy (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  nazev text not null,
  jazyk text,
  html text,
  text text,
  vychozi_pro_schranku uuid references doktor.schranky (id) on delete set null
);

alter table doktor.schranky
  add constraint schranky_vychozi_podpis_fk
  foreign key (vychozi_podpis_id) references doktor.podpisy (id) on delete set null;

call doktor.zapni_rls('schranky');
call doktor.zapni_rls('podpisy');

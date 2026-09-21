-- Učení a provoz (oddíl 3 plánu): opravy, poučení, fronta pro Clauda, audit.
-- Audit je insert-only — ani vlastník ho nemění ani nemaže.

create table doktor.opravy (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  polozka_id uuid references doktor.polozky (id) on delete set null,
  navrh text,
  odeslano_ref text,
  podobnost numeric(4, 3) check (podobnost between 0 and 1),
  -- {osloveni, podpis, delka_pomer, pridane_vety[], vypustene_vety[]} z opravy_sber (ÚKOL 39)
  rozdil jsonb,
  zpracovano boolean not null default false
);
create index opravy_zpracovano_idx on doktor.opravy (user_id, zpracovano);

create table doktor.pouceni (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  text text not null,
  stav text not null default 'navrh' check (stav in ('navrh', 'schvaleno', 'zamitnuto')),
  zdroj_opravy uuid[] not null default '{}'
);

create table doktor.fronta_claude (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  druh text not null,
  vstup jsonb not null default '{}'::jsonb,
  stav text not null default 'ceka' check (stav in ('ceka', 'bezi', 'hotovo', 'chyba')),
  vysledek jsonb
);
create index fronta_claude_stav_idx on doktor.fronta_claude (user_id, stav, vytvoreno);

create table doktor.audit (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  kdo text not null check (kdo in ('app', 'claude', 'beh')),
  nastroj text not null,
  vstup_hash text,
  vysledek text,
  cas timestamptz not null default now()
);
create index audit_cas_idx on doktor.audit (user_id, cas desc);

call doktor.zapni_rls('opravy');
call doktor.zapni_rls('pouceni');
call doktor.zapni_rls('fronta_claude');
call doktor.zapni_rls('audit', jen_zapis => true);

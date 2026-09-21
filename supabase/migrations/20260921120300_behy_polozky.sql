-- Běhy a položky pošty (oddíl 3 plánu). Položka je metadata zprávy — tělo
-- zůstává na enginu (pravidlo 5). Běhy první, položky na ně odkazují.

create table doktor.behy (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  zacatek timestamptz not null default now(),
  konec timestamptz,
  stav text not null default 'bezi' check (stav in ('bezi', 'hotovo', 'chyba')),
  schranky text[] not null default '{}',
  -- {zpravy: 12, navrhy: 5, ukoly: 2, ...} — počty podle druhu
  pocty jsonb not null default '{}'::jsonb,
  chyba text
);
create index behy_zacatek_idx on doktor.behy (user_id, zacatek desc);

create table doktor.polozky (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  schranka_id uuid not null references doktor.schranky (id) on delete restrict,
  message_id text not null,
  vlakno text,
  -- poslední známý `ref` enginu; zdroj pravdy o umístění je engine (ÚKOL 35)
  ref_cache text,
  od text,
  od_email text,
  predmet text,
  datum timestamptz,
  kategorie text,
  priorita smallint check (priorita between 1 and 3),
  stav text not null default 'nove',
  -- odkud stav přišel: klik v aplikaci, schránka (odpověď z Mailu/iPhonu), běh (pravidlo 4)
  stav_zdroj text not null default 'beh' check (stav_zdroj in ('klik', 'schranka', 'beh')),
  co_resit text,
  navrh_predmet text,
  navrh_telo text,
  -- rozepsaná odpověď uživatele; běh ji nikdy nepřepíše (E3)
  rozepsano_telo text,
  komu text[] not null default '{}',
  kopie text[] not null default '{}',
  podpis_id uuid references doktor.podpisy (id) on delete set null,
  odeslat_z text,
  -- jen metadata: [{nazev, typ, velikost, sha}] — bajty a text na enginu
  prilohy_meta jsonb not null default '[]'::jsonb,
  kontakt_id uuid references doktor.kontakty (id) on delete set null,
  pripad_id uuid references doktor.pripady (id) on delete set null,
  beh_id uuid references doktor.behy (id) on delete set null,
  -- idempotence: táž zpráva z téže schránky je položka jen jednou
  unique (schranka_id, message_id)
);
create index polozky_stav_idx on doktor.polozky (user_id, stav, priorita);
create index polozky_datum_idx on doktor.polozky (user_id, datum desc);
create index polozky_kontakt_idx on doktor.polozky (kontakt_id);
create index polozky_vlakno_idx on doktor.polozky (user_id, vlakno);

call doktor.zapni_rls('behy');
call doktor.zapni_rls('polozky');

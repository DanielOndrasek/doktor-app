-- Dnes (K3.5): odložené signály a funkce dnes() / signal_odlozit().
-- Tvar výstupu je `Signal` v src/lib/today.ts. Texty se skládají tady, česky;
-- aplikace je jen zobrazí. Navíc proti plánu (odsouhlaseno 21. 9.).

create table doktor.signaly_odlozene (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  klic text not null,
  akce text not null check (akce in ('done', 'snoozed', 'irrelevant')),
  -- null = navždy (done, irrelevant); snoozed = +7 dní
  do_kdy timestamptz,
  unique (user_id, klic)
);

call doktor.zapni_rls('signaly_odlozene');

-- Kolik pracovních dní (po–pá) uplynulo od okamžiku; svátky se neřeší.
create or replace function doktor.pracovni_dny_od(od timestamptz)
returns integer
language sql
stable
as $$
  select count(*)::integer
  from generate_series(od::date + 1, current_date, interval '1 day') d
  where extract(isodow from d) < 6;
$$;

-- Zapíše odložení: done a irrelevant navždy, snoozed na 7 dní.
create or replace function doktor.signal_odlozit(p_klic text, p_akce text)
returns void
language sql
security invoker
as $$
  insert into doktor.signaly_odlozene (user_id, klic, akce, do_kdy)
  values (
    auth.uid(),
    p_klic,
    p_akce,
    case when p_akce = 'snoozed' then now() + interval '7 days' else null end
  )
  on conflict (user_id, klic) do update
    set akce = excluded.akce, do_kdy = excluded.do_kdy;
$$;

-- Čemu se dnes věnovat. RLS platí (security invoker), takže se vrátí jen
-- vlastní řádky. Naléhavost 1–4, kategorie p1 · termin · udalost · odpoved.
create or replace function doktor.dnes()
returns table (
  klic text,
  urg smallint,
  kat text,
  nazev text,
  proc text,
  dukazy text[],
  akce jsonb,
  termin date,
  href text
)
language sql
stable
security invoker
as $$
  with odlozene as (
    select s.klic
    from doktor.signaly_odlozene s
    where s.do_kdy is null or s.do_kdy > now()
  ),
  p1 as (
    select
      'polozka:' || p.id as klic,
      1::smallint as urg,
      'p1' as kat,
      coalesce(p.predmet, '(bez předmětu)') as nazev,
      coalesce(p.co_resit, 'Priorita 1 – ' || coalesce(p.od, p.od_email, '')) as proc,
      array_remove(array[
        coalesce(p.od, p.od_email),
        case when p.datum is not null then 'přišlo ' || to_char(p.datum, 'FMDD. FMMM.') end
      ], null) as dukazy,
      jsonb_build_array(jsonb_build_object('popisek', 'Otevřít', 'ikona', 'mail', 'href', '/posta?polozka=' || p.id)) as akce,
      null::date as termin,
      '/posta?polozka=' || p.id as href
    from doktor.polozky p
    where p.priorita = 1 and p.stav not in ('hotovo', 'zamitnuto')
  ),
  odpoved as (
    select
      'ceka:' || p.id as klic,
      case when doktor.pracovni_dny_od(p.upraveno) >= 5 then 2 else 3 end::smallint as urg,
      'odpoved' as kat,
      coalesce(p.predmet, '(bez předmětu)') as nazev,
      'Čeká na odpověď ' || doktor.pracovni_dny_od(p.upraveno) || ' pracovních dní' as proc,
      array_remove(array[coalesce(p.od, p.od_email)], null) as dukazy,
      jsonb_build_array(jsonb_build_object('popisek', 'Odpovědět', 'ikona', 'reply', 'href', '/posta?polozka=' || p.id)) as akce,
      null::date as termin,
      '/posta?polozka=' || p.id as href
    from doktor.polozky p
    where p.stav = 'ceka' and doktor.pracovni_dny_od(p.upraveno) > 2
  ),
  po_terminu as (
    select
      'ukol:' || u.id as klic,
      case when u.termin < current_date - 7 then 1 else 2 end::smallint as urg,
      'termin' as kat,
      u.nazev,
      'Termín ' || to_char(u.termin, 'FMDD. FMMM.') || ' – po termínu ' || (current_date - u.termin) || ' dní' as proc,
      array_remove(array[u.oblast, u.priorita], null) as dukazy,
      jsonb_build_array(jsonb_build_object('popisek', 'Otevřít úkol', 'ikona', 'task', 'href', '/ukoly?ukol=' || u.id)) as akce,
      u.termin,
      '/ukoly?ukol=' || u.id as href
    from doktor.ukoly u
    where u.termin < current_date and u.stav not in ('hotovo', 'zruseno')
  ),
  dnesni as (
    select
      'udalost:' || e.id as klic,
      case when jsonb_array_length(e.kolize) > 0 then 2 else 3 end::smallint as urg,
      'udalost' as kat,
      e.nazev,
      case
        when e.celodenni then 'Dnes celý den'
        else 'Dnes ' || to_char(e.zacatek, 'HH24:MI')
      end || coalesce(' · ' || e.misto, '') as proc,
      case when jsonb_array_length(e.kolize) > 0
        then array[jsonb_array_length(e.kolize) || ' kolize']
        else '{}'::text[]
      end as dukazy,
      jsonb_build_array(jsonb_build_object('popisek', 'Zobrazit', 'ikona', 'event', 'href', '/udalosti?udalost=' || e.id)) as akce,
      e.zacatek::date as termin,
      '/udalosti?udalost=' || e.id as href
    from doktor.udalosti e
    where e.stav = 'novy' and e.zacatek::date = current_date
  ),
  vse as (
    select * from p1
    union all select * from odpoved
    union all select * from po_terminu
    union all select * from dnesni
  )
  select v.*
  from vse v
  where v.klic not in (select o.klic from odlozene o)
  order by v.urg, v.termin nulls last, v.nazev;
$$;

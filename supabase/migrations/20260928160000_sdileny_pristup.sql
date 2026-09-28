-- Sdílený přístup k datům (28. 9. 2026).
--
-- Aplikace má jednoho vlastníka dat (účet, pod kterým zapisuje engine a všechny
-- běhy). Druhý účet — Štěpán, suchanekstepan@gmail.com — má vidět a upravovat
-- totéž. Plán (oddíl 9) počítal s přístupem sekretariátu až v K5; tohle je
-- nejmenší varianta téhož mechanismu, aby se nemusela měnit ani aplikace, ani
-- engine:
--
--   1. `doktor.pristup` — kdo (clen_id) má přístup k datům koho (user_id).
--      Zápis jen přes SQL (service role); z aplikace se řádky jen čtou.
--   2. `doktor.pristupne_ucty()` — auth.uid() plus vlastníci, kteří mu dali
--      přístup. Politiky všech tabulek se přepíšou z `user_id = auth.uid()`
--      na `user_id in (select doktor.pristupne_ucty())`.
--   3. `doktor.vlastnik()` a trigger `zapis_pod_vlastnika` — zápis z aplikace
--      nese `user_id` přihlášeného; u člena se uloží pod vlastníka, aby data
--      zůstala v jedné sadě (engine, běhy i oba účty vidí totéž). Service role
--      (engine, auth.uid() je null) se netýká.
--   4. `signal_odlozit` odkládá signály pod vlastníka ze stejného důvodu.
--
-- Dopředná migrace — předchozí soubory se needitují (CLAUDE.md, pravidlo 10).

-- 1. Tabulka přístupů ----------------------------------------------------------

create table doktor.pristup (
  id uuid primary key default gen_random_uuid(),
  -- vlastník dat (řádky ostatních tabulek mají tohle user_id)
  user_id uuid not null references auth.users (id) on delete cascade,
  -- kdo k nim má přístup
  clen_id uuid not null references auth.users (id) on delete cascade,
  poznamka text,
  vytvoreno timestamptz not null default now(),
  upraveno timestamptz not null default now(),
  unique (user_id, clen_id),
  check (user_id <> clen_id)
);

create index pristup_clen_idx on doktor.pristup (clen_id);

alter table doktor.pristup enable row level security;
alter table doktor.pristup force row level security;

-- Z aplikace jen čtení: vlastník i člen vidí, komu / od koho přístup je.
-- Přidání a odebrání přístupu je správcovská věc (SQL pod service role).
create policy pristup_select on doktor.pristup
  for select to authenticated
  using (user_id = (select auth.uid()) or clen_id = (select auth.uid()));

create trigger pristup_upraveno
  before update on doktor.pristup
  for each row execute function doktor.nastav_upraveno();

grant select on doktor.pristup to authenticated;
grant all on doktor.pristup to service_role;

-- 2. Účty, ke kterým má přihlášený přístup --------------------------------------

-- security definer: čte doktor.pristup bez ohledu na politiku (jinak by se
-- politika tabulky odkazovala sama na sebe).
create or replace function doktor.pristupne_ucty()
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select auth.uid()
  union
  select p.user_id
  from doktor.pristup p
  where p.clen_id = auth.uid();
$$;

-- Pod koho se ukládá zápis z aplikace: první vlastník, který dal přihlášenému
-- přístup; jinak přihlášený sám.
create or replace function doktor.vlastnik()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.user_id from doktor.pristup p where p.clen_id = auth.uid() order by p.vytvoreno limit 1),
    auth.uid()
  );
$$;

create or replace function doktor.zapis_pod_vlastnika()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Aplikace posílá user_id přihlášeného (RLS to dosud vyžadovalo). Člen ho
  -- ukládá pod vlastníka; vlastníkovi se nic nemění; service role se netýká.
  if auth.uid() is not null and new.user_id = auth.uid() then
    new.user_id := doktor.vlastnik();
  end if;
  return new;
end;
$$;

revoke execute on function doktor.pristupne_ucty() from public, anon;
revoke execute on function doktor.vlastnik() from public, anon;
revoke execute on function doktor.zapis_pod_vlastnika() from public, anon;
grant execute on function doktor.pristupne_ucty() to authenticated, service_role;
grant execute on function doktor.vlastnik() to authenticated, service_role;

-- 3. Politiky: vlastník nebo člen ----------------------------------------------

create or replace procedure doktor.zapni_rls(tabulka text, jen_zapis boolean default false)
language plpgsql
set search_path = ''
as $$
begin
  execute format('alter table doktor.%I enable row level security', tabulka);
  execute format('alter table doktor.%I force row level security', tabulka);

  execute format('drop policy if exists %I on doktor.%I', tabulka || '_select', tabulka);
  execute format('drop policy if exists %I on doktor.%I', tabulka || '_insert', tabulka);
  execute format('drop policy if exists %I on doktor.%I', tabulka || '_update', tabulka);
  execute format('drop policy if exists %I on doktor.%I', tabulka || '_delete', tabulka);

  execute format(
    'create policy %I on doktor.%I for select to authenticated using (user_id in (select doktor.pristupne_ucty()))',
    tabulka || '_select', tabulka);
  execute format(
    'create policy %I on doktor.%I for insert to authenticated with check (user_id in (select doktor.pristupne_ucty()))',
    tabulka || '_insert', tabulka);
  if not jen_zapis then
    execute format(
      'create policy %I on doktor.%I for update to authenticated using (user_id in (select doktor.pristupne_ucty())) with check (user_id in (select doktor.pristupne_ucty()))',
      tabulka || '_update', tabulka);
    execute format(
      'create policy %I on doktor.%I for delete to authenticated using (user_id in (select doktor.pristupne_ucty()))',
      tabulka || '_delete', tabulka);
  end if;

  execute format('drop trigger if exists %I on doktor.%I', tabulka || '_upraveno', tabulka);
  execute format(
    'create trigger %I before update on doktor.%I for each row execute function doktor.nastav_upraveno()',
    tabulka || '_upraveno', tabulka);

  -- Zápis člena z aplikace jde pod vlastníka (viz zapis_pod_vlastnika).
  execute format('drop trigger if exists %I on doktor.%I', tabulka || '_vlastnik', tabulka);
  execute format(
    'create trigger %I before insert on doktor.%I for each row execute function doktor.zapis_pod_vlastnika()',
    tabulka || '_vlastnik', tabulka);
end;
$$;

-- Všechny dosavadní tabulky schématu znovu (audit zůstává jen na zápis).
do $$
declare
  t text;
begin
  for t in
    select tablename from pg_tables
    where schemaname = 'doktor' and tablename <> 'pristup'
    order by tablename
  loop
    call doktor.zapni_rls(t, t = 'audit');
  end loop;
end;
$$;

-- 4. Odložení signálu pod vlastníka ---------------------------------------------

create or replace function doktor.signal_odlozit(p_klic text, p_akce text)
returns void
language sql
set search_path = ''
as $$
  insert into doktor.signaly_odlozene (user_id, klic, akce, do_kdy)
  values (
    doktor.vlastnik(),
    p_klic,
    p_akce,
    case when p_akce = 'snoozed' then now() + interval '7 days' else null end
  )
  on conflict (user_id, klic) do update
    set akce = excluded.akce, do_kdy = excluded.do_kdy;
$$;

-- 5. První přístup: vlastník dat → Štěpán ---------------------------------------

insert into doktor.pristup (user_id, clen_id, poznamka)
select v.id, c.id, 'Štěpán — sdílený přístup k datům aplikace (28. 9. 2026)'
from auth.users v, auth.users c
where v.email = 'ondrasek@activato.cz' and c.email = 'suchanekstepan@gmail.com'
on conflict (user_id, clen_id) do nothing;

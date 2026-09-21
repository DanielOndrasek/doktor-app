-- Schéma `doktor` a společné pomůcky pro všechny tabulky.
-- Zadání: docs/zadani-k2-schema-a-rest.md, část A.1. Pravidla: CLAUDE.md.
--
-- Každá tabulka: id, user_id (auth.users), vytvoreno, upraveno, RLS na user_id.
-- Migrace jsou jen dopředné — tenhle soubor se po aplikaci needituje.

create schema if not exists doktor;

-- Přístup: přihlášený uživatel (RLS) a service role (engine, běhy). Anonym nic.
grant usage on schema doktor to authenticated, service_role;
alter default privileges in schema doktor grant all on tables to authenticated, service_role;
alter default privileges in schema doktor grant all on sequences to authenticated, service_role;
alter default privileges in schema doktor grant execute on functions to authenticated, service_role;

-- `upraveno` drží trigger, ne aplikace.
create or replace function doktor.nastav_upraveno()
returns trigger
language plpgsql
as $$
begin
  new.upraveno := now();
  return new;
end;
$$;

-- Jedna sada politik pro všechny tabulky: vlastník vidí a mění jen své řádky.
-- `jen_zapis = true` = tabulka je insert-only (audit): update a delete nejde
-- ani vlastníkovi.
create or replace procedure doktor.zapni_rls(tabulka text, jen_zapis boolean default false)
language plpgsql
as $$
begin
  execute format('alter table doktor.%I enable row level security', tabulka);
  execute format('alter table doktor.%I force row level security', tabulka);
  execute format(
    'create policy %I on doktor.%I for select to authenticated using (user_id = auth.uid())',
    tabulka || '_select', tabulka);
  execute format(
    'create policy %I on doktor.%I for insert to authenticated with check (user_id = auth.uid())',
    tabulka || '_insert', tabulka);
  if not jen_zapis then
    execute format(
      'create policy %I on doktor.%I for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      tabulka || '_update', tabulka);
    execute format(
      'create policy %I on doktor.%I for delete to authenticated using (user_id = auth.uid())',
      tabulka || '_delete', tabulka);
  end if;
  execute format(
    'create trigger %I before update on doktor.%I for each row execute function doktor.nastav_upraveno()',
    tabulka || '_upraveno', tabulka);
end;
$$;

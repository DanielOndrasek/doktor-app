-- Oprava nálezů Supabase advisorů po aplikaci schématu (21. 9.).
-- Dopředná migrace — předchozí soubory se needitují (CLAUDE.md, pravidlo 10).
--
-- 1. security: function_search_path_mutable — všech 6 funkcí/procedur dostane
--    pevný search_path = ''. Těla už používají plně kvalifikovaná jména
--    (doktor.*, auth.uid()); pg_catalog se hledá vždy implicitně.
-- 2. performance: auth_rls_initplan — politiky z doktor.zapni_rls() volají
--    auth.uid() pro každý řádek. Přepis na (select auth.uid()) ho vyhodnotí
--    jednou na dotaz. Procedura se přepíše a všechny politiky se vytvoří znovu.
-- 3. performance: unindexed_foreign_keys — 21 indexů nad cizími klíči.
--    (unused_index se neřeší: databáze je prázdná, nic se ještě nepoužilo.)

-- 1. Pevný search_path -------------------------------------------------------

alter function doktor.nastav_upraveno() set search_path = '';
alter procedure doktor.zapni_rls(text, boolean) set search_path = '';
alter function doktor.ukoly_stav_zmenen() set search_path = '';
alter function doktor.pracovni_dny_od(timestamptz) set search_path = '';
alter function doktor.signal_odlozit(text, text) set search_path = '';
alter function doktor.dnes() set search_path = '';

-- 2. Politiky s (select auth.uid()) -------------------------------------------

-- Idempotentní varianta: politiky i trigger se nejdřív zahodí, takže procedura
-- jde volat opakovaně (další migrace ji použijí pro nové tabulky stejně).
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
    'create policy %I on doktor.%I for select to authenticated using (user_id = (select auth.uid()))',
    tabulka || '_select', tabulka);
  execute format(
    'create policy %I on doktor.%I for insert to authenticated with check (user_id = (select auth.uid()))',
    tabulka || '_insert', tabulka);
  if not jen_zapis then
    execute format(
      'create policy %I on doktor.%I for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()))',
      tabulka || '_update', tabulka);
    execute format(
      'create policy %I on doktor.%I for delete to authenticated using (user_id = (select auth.uid()))',
      tabulka || '_delete', tabulka);
  end if;

  execute format('drop trigger if exists %I on doktor.%I', tabulka || '_upraveno', tabulka);
  execute format(
    'create trigger %I before update on doktor.%I for each row execute function doktor.nastav_upraveno()',
    tabulka || '_upraveno', tabulka);
end;
$$;

-- Znovu pro všechny existující tabulky; audit zůstává insert-only.
do $$
declare
  t text;
begin
  for t in
    select c.relname
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'doktor' and c.relkind = 'r'
    order by c.relname
  loop
    call doktor.zapni_rls(t, t = 'audit');
  end loop;
end;
$$;

-- 3. Indexy nad cizími klíči ----------------------------------------------------

create index kontakt_stitky_stitek_idx on doktor.kontakt_stitky (stitek_id);
create index kontakt_stitky_user_idx on doktor.kontakt_stitky (user_id);
create index kontakt_telefony_kontakt_idx on doktor.kontakt_telefony (kontakt_id);
create index kontakty_organizace_idx on doktor.kontakty (organizace_id);
create index kontakty_sloucen_do_idx on doktor.kontakty (sloucen_do);
create index opravy_polozka_idx on doktor.opravy (polozka_id);
create index podpisy_user_idx on doktor.podpisy (user_id);
create index podpisy_vychozi_pro_schranku_idx on doktor.podpisy (vychozi_pro_schranku);
create index pohledy_user_idx on doktor.pohledy (user_id);
create index polozky_beh_idx on doktor.polozky (beh_id);
create index polozky_podpis_idx on doktor.polozky (podpis_id);
create index polozky_pripad_idx on doktor.polozky (pripad_id);
create index pouceni_user_idx on doktor.pouceni (user_id);
create index poznamky_pripad_idx on doktor.poznamky (pripad_id);
create index pravidla_user_idx on doktor.pravidla (user_id);
create index pripady_kontakt_fk_idx on doktor.pripady (kontakt_id);
create index sablony_user_idx on doktor.sablony (user_id);
create index schranky_vychozi_podpis_idx on doktor.schranky (vychozi_podpis_id);
create index udalosti_polozka_idx on doktor.udalosti (polozka_id);
create index ukoly_polozka_idx on doktor.ukoly (polozka_id);
create index vazby_dokumentu_user_idx on doktor.vazby_dokumentu (user_id);

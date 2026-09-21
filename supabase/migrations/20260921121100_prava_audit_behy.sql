-- Práva na tabulky: `audit` a `behy` nedostaly výchozí práva (default privileges
-- ze schema_doktor se na ně nepropsala), takže engine při kopii auditu se service
-- role dostával „permission denied for table audit" (21. 9. 2026, PostgREST 42501).
-- Jednou provždy explicitně a idempotentně pro všechny tabulky schématu.

grant usage on schema doktor to authenticated, service_role;
grant all on all tables in schema doktor to authenticated, service_role;
grant all on all sequences in schema doktor to authenticated, service_role;

-- Audit je insert-only i pro service role (engine, Claude): číst a přidávat ano,
-- měnit a mazat ne. Pro authenticated to už hlídá RLS (zapni_rls jen_zapis), tady
-- to platí i mimo RLS.
revoke update, delete, truncate on doktor.audit from authenticated, service_role;

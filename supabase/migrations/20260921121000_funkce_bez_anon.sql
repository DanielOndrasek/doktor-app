-- Funkce ve schématu doktor smí volat jen přihlášený uživatel a service role.
-- Postgres dává EXECUTE roli public automaticky; anon sice nemá USAGE na schéma,
-- ale právo tam být nemá vůbec (kontrola 21. 9. po vystavení schématu v API).

revoke execute on all functions in schema doktor from public, anon;
revoke execute on all procedures in schema doktor from public, anon;
alter default privileges in schema doktor revoke execute on functions from public;

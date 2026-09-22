-- Karty pacientů (rozhodnutí O2 změněno 22. 9. 2026, `docs/rozhodnuti.md`):
-- „případ" = karta pacienta pod odesílajícím lékařem. Navrhuje ji běh třídění,
-- schvaluje nebo zamítá lékař v aplikaci (Pacienti). Sloupce navíc proti plánu,
-- každý s důvodem (vzor A.3 v `docs/zadani-k2-schema-a-rest.md`):
--   stav, stav_zdroj — návrh vs. schváleno, klik má přednost před během (pravidlo 4)
--   shrnuti          — o co jde, jednou dvěma větami; bez rodného čísla (pravidlo 7)
--   zdroj_id         — idempotence (`vlakno:<vlakno>` nebo `email:<message_id>`)
--   beh_id           — z kterého běhu návrh vznikl (přehled běhů na Dnes)
--   posledni_zprava  — kdy k případu naposledy něco přišlo (řazení)
-- `nazev` = jméno pacienta, jak stojí ve vlákně. Rodné číslo se nezapisuje nikam.

alter table doktor.pripady
  add column stav text not null default 'navrh' check (stav in ('navrh', 'schvaleno', 'zamitnuto')),
  add column stav_zdroj text not null default 'beh' check (stav_zdroj in ('klik', 'beh')),
  add column shrnuti text,
  add column zdroj_id text,
  add column beh_id uuid references doktor.behy (id) on delete set null,
  add column posledni_zprava timestamptz;

alter table doktor.pripady add constraint pripady_zdroj_unique unique (user_id, zdroj_id);
create index pripady_stav_idx on doktor.pripady (user_id, stav, posledni_zprava desc);

comment on column doktor.pripady.nazev is 'Jméno pacienta z vlákna; rodné číslo nikdy (pravidlo 7)';
comment on column doktor.pripady.stav is 'navrh (z běhu) → schvaleno / zamitnuto (klik lékaře)';

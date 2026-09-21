import type { KanbanCardData } from "@/components/kanban";
import { cs } from "@/lib/i18n/cs";
import { supabase } from "@/lib/supabase/client";
import { toCard } from "@/lib/tasks";
import type { Database } from "@/types/database";

/**
 * Adresář kontaktů s minimálním CRM (K4.1, přitaženo do K3 na přání 21. 9.):
 * seznam se serverovým filtrem, karta s údaji, adresami, telefony,
 * organizací, poznámkami (`poznamky`) a otevřenými úkoly (`ukoly`).
 * E-maily ke kontaktu přijdou z enginu (`mail_search` podle adres, K2.3),
 * případy (O2) a dokumenty jsou další záložky K4.
 *
 * Vše přes supabase-js pod RLS; `user_id` se bere ze session jen při
 * zakládání (`with check`).
 */

type Row = Database["doktor"]["Tables"];

export interface ContactAddress {
  id: string;
  value: string;
  primary: boolean;
}

export interface ContactPhone {
  id: string;
  value: string;
  primary: boolean;
}

export interface ContactListItem {
  id: string;
  firstName: string | null;
  lastName: string | null;
  titles: string | null;
  organization: string | null;
  primaryEmail: string | null;
  role: string | null;
}

export interface ContactDetail extends ContactListItem {
  organizationId: string | null;
  note: string | null;
  source: string | null;
  addresses: ContactAddress[];
  phones: ContactPhone[];
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

/** Co jde v kartě upravit. Prázdný řetězec = null. */
export interface ContactDraft {
  firstName: string;
  lastName: string;
  titles: string;
  role: string;
  note: string;
  organizationName: string;
}

export interface ContactNote {
  id: string;
  text: string;
  kind: "poznamka" | "zapis" | "hovor";
  source: "plaud" | "rucne" | "claude";
  createdAt: string;
}

export interface Organization {
  id: string;
  name: string;
  domain: string | null;
}

export interface ContactSource {
  list: (search: string) => Promise<ContactListItem[]>;
  get: (id: string) => Promise<ContactDetail | null>;
  create: (draft: ContactDraft, email?: string) => Promise<ContactDetail>;
  update: (contact: ContactDetail, draft: ContactDraft) => Promise<ContactDetail>;
  addAddress: (contactId: string, value: string) => Promise<void>;
  addPhone: (contactId: string, value: string) => Promise<void>;
  notes: (contactId: string) => Promise<ContactNote[]>;
  addNote: (contactId: string, text: string) => Promise<ContactNote>;
  openTasks: (contactId: string) => Promise<KanbanCardData[]>;
  organizations: () => Promise<Organization[]>;
}

/** Zobrazované jméno: „Jméno Příjmení", jinak e-mail, jinak pomlčka. */
export function contactDisplayName(c: Pick<ContactListItem, "firstName" | "lastName" | "primaryEmail">): string {
  const name = [c.firstName, c.lastName].filter(Boolean).join(" ").trim();
  return name || c.primaryEmail || "—";
}

export function draftOfContact(c: ContactDetail): ContactDraft {
  return {
    firstName: c.firstName ?? "",
    lastName: c.lastName ?? "",
    titles: c.titles ?? "",
    role: c.role ?? "",
    note: c.note ?? "",
    organizationName: c.organization ?? "",
  };
}

export const EMPTY_CONTACT_DRAFT: ContactDraft = { firstName: "", lastName: "", titles: "", role: "", note: "", organizationName: "" };

const LIST_COLUMNS = "id, jmeno, prijmeni, tituly, role, organizace (nazev), kontakt_adresy (hodnota, primarni)" as const;
const DETAIL_COLUMNS =
  "id, jmeno, prijmeni, tituly, role, poznamka, zdroj, organizace_id, vytvoreno, upraveno, organizace (nazev), kontakt_adresy (id, hodnota, primarni), kontakt_telefony (id, hodnota, primarni), kontakt_stitky (stitky (nazev))" as const;

type ListRow = Pick<Row["kontakty"]["Row"], "id" | "jmeno" | "prijmeni" | "tituly" | "role"> & {
  organizace: Pick<Row["organizace"]["Row"], "nazev"> | null;
  kontakt_adresy: Pick<Row["kontakt_adresy"]["Row"], "hodnota" | "primarni">[];
};

type DetailRow = Pick<Row["kontakty"]["Row"], "id" | "jmeno" | "prijmeni" | "tituly" | "role" | "poznamka" | "zdroj" | "organizace_id" | "vytvoreno" | "upraveno"> & {
  organizace: Pick<Row["organizace"]["Row"], "nazev"> | null;
  kontakt_adresy: Pick<Row["kontakt_adresy"]["Row"], "id" | "hodnota" | "primarni">[];
  kontakt_telefony: Pick<Row["kontakt_telefony"]["Row"], "id" | "hodnota" | "primarni">[];
  kontakt_stitky: { stitky: Pick<Row["stitky"]["Row"], "nazev"> | null }[];
};

function primaryOf<T extends { hodnota: string; primarni: boolean }>(rows: T[]): string | null {
  return (rows.find((r) => r.primarni) ?? rows[0])?.hodnota ?? null;
}

function toListItem(row: ListRow): ContactListItem {
  return {
    id: row.id,
    firstName: row.jmeno,
    lastName: row.prijmeni,
    titles: row.tituly,
    organization: row.organizace?.nazev ?? null,
    primaryEmail: primaryOf(row.kontakt_adresy),
    role: row.role,
  };
}

function toDetail(row: DetailRow): ContactDetail {
  const byPrimary = <T extends { primarni: boolean }>(a: T, b: T) => Number(b.primarni) - Number(a.primarni);
  return {
    ...toListItem(row),
    organizationId: row.organizace_id,
    note: row.poznamka,
    source: row.zdroj,
    addresses: [...row.kontakt_adresy].sort(byPrimary).map((a) => ({ id: a.id, value: a.hodnota, primary: a.primarni })),
    phones: [...row.kontakt_telefony].sort(byPrimary).map((t) => ({ id: t.id, value: t.hodnota, primary: t.primarni })),
    tags: row.kontakt_stitky.map((s) => s.stitky?.nazev).filter((n): n is string => !!n),
    createdAt: row.vytvoreno,
    updatedAt: row.upraveno,
  };
}

const orNull = (v: string): string | null => v.trim() || null;

/** Escapování pro `ilike` — `%` a `_` v dotazu jsou znaky, ne zástupky. */
function likePattern(search: string): string {
  return `%${search.trim().replace(/[%_\\]/g, (m) => `\\${m}`)}%`;
}

export function createSupabaseContactSource(client: typeof supabase = supabase): ContactSource {
  async function userId(): Promise<string> {
    const {
      data: { session },
    } = await client.auth.getSession();
    if (!session) throw new Error(cs.engine.neprihlasen);
    return session.user.id;
  }

  /** Organizace podle názvu: existující, nebo nová. Prázdný název = bez organizace. */
  async function organizationId(name: string, uid: string): Promise<string | null> {
    const nazev = name.trim();
    if (!nazev) return null;
    const { data: found, error } = await client.from("organizace").select("id").ilike("nazev", nazev).limit(1).maybeSingle();
    if (error) throw new Error(error.message);
    if (found) return found.id;
    const { data: created, error: insErr } = await client.from("organizace").insert({ user_id: uid, nazev }).select("id").single();
    if (insErr) throw new Error(insErr.message);
    return created.id;
  }

  async function getDetail(id: string): Promise<ContactDetail | null> {
    const { data, error } = await client.from("kontakty").select(DETAIL_COLUMNS).eq("id", id).maybeSingle();
    if (error) throw new Error(error.message);
    return data ? toDetail(data) : null;
  }

  return {
    async list(search) {
      let query = client.from("kontakty").select(LIST_COLUMNS).is("sloucen_do", null).order("prijmeni", { ascending: true, nullsFirst: false }).order("jmeno").limit(500);
      const q = search.trim();
      if (q) {
        const p = likePattern(q);
        // Shoda v adrese jde přes vztah: nejdřív id kontaktů podle adresy, pak jeden `or` nad kontakty.
        const { data: byAddress, error: aErr } = await client.from("kontakt_adresy").select("kontakt_id").ilike("hodnota", p).limit(200);
        if (aErr) throw new Error(aErr.message);
        const ids = [...new Set(byAddress.map((a) => a.kontakt_id))];
        const parts = [`jmeno.ilike.${p}`, `prijmeni.ilike.${p}`, `tituly.ilike.${p}`];
        if (ids.length) parts.push(`id.in.(${ids.join(",")})`);
        query = query.or(parts.join(","));
      }
      const { data, error } = await query;
      if (error) throw new Error(error.message);
      return data.map(toListItem);
    },

    get: getDetail,

    async create(draft, email) {
      const uid = await userId();
      if (!draft.firstName.trim() && !draft.lastName.trim() && !email?.trim()) throw new Error(cs.kontakty.detail.chybiJmeno);
      const { data, error } = await client
        .from("kontakty")
        .insert({
          user_id: uid,
          jmeno: orNull(draft.firstName),
          prijmeni: orNull(draft.lastName),
          tituly: orNull(draft.titles),
          role: orNull(draft.role),
          poznamka: orNull(draft.note),
          organizace_id: await organizationId(draft.organizationName, uid),
          zdroj: "rucne",
        })
        .select("id")
        .single();
      if (error) throw new Error(error.message);
      if (email?.trim()) {
        const { error: aErr } = await client.from("kontakt_adresy").insert({ user_id: uid, kontakt_id: data.id, hodnota: email.trim().toLowerCase(), primarni: true });
        if (aErr) throw new Error(aErr.message);
      }
      const detail = await getDetail(data.id);
      if (!detail) throw new Error(cs.kontakty.detail.ulozeniSelhalo);
      return detail;
    },

    async update(contact, draft) {
      const uid = await userId();
      const { error } = await client
        .from("kontakty")
        .update({
          jmeno: orNull(draft.firstName),
          prijmeni: orNull(draft.lastName),
          tituly: orNull(draft.titles),
          role: orNull(draft.role),
          poznamka: orNull(draft.note),
          organizace_id: await organizationId(draft.organizationName, uid),
        })
        .eq("id", contact.id);
      if (error) throw new Error(error.message);
      const detail = await getDetail(contact.id);
      if (!detail) throw new Error(cs.kontakty.detail.ulozeniSelhalo);
      return detail;
    },

    async addAddress(contactId, value) {
      const uid = await userId();
      const { count } = await client.from("kontakt_adresy").select("id", { count: "exact", head: true }).eq("kontakt_id", contactId);
      const { error } = await client.from("kontakt_adresy").insert({ user_id: uid, kontakt_id: contactId, hodnota: value.trim().toLowerCase(), primarni: !count });
      if (error) throw new Error(error.message);
    },

    async addPhone(contactId, value) {
      const uid = await userId();
      const { count } = await client.from("kontakt_telefony").select("id", { count: "exact", head: true }).eq("kontakt_id", contactId);
      const { error } = await client.from("kontakt_telefony").insert({ user_id: uid, kontakt_id: contactId, hodnota: value.trim(), primarni: !count });
      if (error) throw new Error(error.message);
    },

    async notes(contactId) {
      const { data, error } = await client
        .from("poznamky")
        .select("id, text, druh, zdroj, vytvoreno")
        .eq("kontakt_id", contactId)
        .order("vytvoreno", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);
      return data.map((n) => ({ id: n.id, text: n.text, kind: n.druh as ContactNote["kind"], source: n.zdroj as ContactNote["source"], createdAt: n.vytvoreno }));
    },

    async addNote(contactId, text) {
      const uid = await userId();
      const { data, error } = await client
        .from("poznamky")
        .insert({ user_id: uid, kontakt_id: contactId, text: text.trim(), druh: "poznamka", zdroj: "rucne" })
        .select("id, text, druh, zdroj, vytvoreno")
        .single();
      if (error) throw new Error(error.message);
      return { id: data.id, text: data.text, kind: data.druh as ContactNote["kind"], source: data.zdroj as ContactNote["source"], createdAt: data.vytvoreno };
    },

    async openTasks(contactId) {
      const { data, error } = await client
        .from("ukoly")
        .select("id, nazev, popis, stav, termin, cas, priorita, oblast, stav_zmenen, kontakty (jmeno, prijmeni)")
        .eq("kontakt_id", contactId)
        .not("stav", "in", "(hotovo,zruseno)")
        .order("termin", { ascending: true, nullsFirst: false });
      if (error) throw new Error(error.message);
      return data.map(toCard).filter((c): c is KanbanCardData => c !== null);
    },

    async organizations() {
      const { data, error } = await client.from("organizace").select("id, nazev, domena").order("nazev");
      if (error) throw new Error(error.message);
      return data.map((o) => ({ id: o.id, name: o.nazev, domain: o.domena }));
    },
  };
}

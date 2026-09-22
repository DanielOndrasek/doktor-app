import { cs } from "@/lib/i18n/cs";
import { supabase } from "@/lib/supabase/client";

/**
 * Podpisy e-mailu (`podpisy`, oddíl 3 plánu; K3.3): více podpisů, každý může být
 * výchozí pro jednu schránku (`vychozi_pro_schranku`). Okno psaní vloží podpis
 * schránky, ze které se odesílá; engine `podpis_id` nedostává, protože podpis
 * je už v těle (jinak by ho přidal dvakrát). Nic se nemaže — podpis jde přejmenovat
 * nebo vyprázdnit. Seznam a názvy podpisů jsou rozhodnutí O5 (Štěpán).
 */
export interface Signature {
  id: string;
  name: string;
  language: string | null;
  html: string | null;
  text: string | null;
  defaultForMailboxId: string | null;
}

export interface SignaturePatch {
  name?: string;
  language?: string | null;
  html?: string | null;
  text?: string | null;
  defaultForMailboxId?: string | null;
}

export interface SignatureSource {
  list: () => Promise<Signature[]>;
  create: (name: string) => Promise<Signature>;
  update: (id: string, patch: SignaturePatch) => Promise<Signature>;
}

const COLUMNS = "id, nazev, jazyk, html, text, vychozi_pro_schranku" as const;

/** Prostá textová podoba podpisu (`podpisy.text`) — pro klienty bez HTML. */
export function signatureHtmlToText(html: string): string {
  const withBreaks = html.replace(/<(br|\/p|\/div|\/tr|\/li|\/h[1-6])[^>]*>/gi, "$&\n");
  const doc = new DOMParser().parseFromString(withBreaks, "text/html");
  return (doc.body.textContent ?? "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function createSupabaseSignatureSource(client: typeof supabase = supabase): SignatureSource {
  const toSignature = (r: { id: string; nazev: string; jazyk: string | null; html: string | null; text: string | null; vychozi_pro_schranku: string | null }): Signature => ({
    id: r.id,
    name: r.nazev,
    language: r.jazyk,
    html: r.html,
    text: r.text,
    defaultForMailboxId: r.vychozi_pro_schranku,
  });

  return {
    async list() {
      const { data, error } = await client.from("podpisy").select(COLUMNS).order("nazev");
      if (error) throw new Error(error.message);
      return data.map(toSignature);
    },

    async create(name) {
      const {
        data: { session },
      } = await client.auth.getSession();
      if (!session) throw new Error(cs.engine.neprihlasen);
      const { data, error } = await client
        .from("podpisy")
        .insert({ user_id: session.user.id, nazev: name.trim() || cs.nastaveni.podpisy.novyNazev })
        .select(COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return toSignature(data);
    },

    async update(id, patch) {
      // Výchozí pro schránku je nejvýš jeden podpis — ostatním se vazba sundá.
      if (patch.defaultForMailboxId) {
        const { error } = await client.from("podpisy").update({ vychozi_pro_schranku: null }).eq("vychozi_pro_schranku", patch.defaultForMailboxId).neq("id", id);
        if (error) throw new Error(error.message);
      }
      const { data, error } = await client
        .from("podpisy")
        .update({
          ...(patch.name !== undefined ? { nazev: patch.name.trim() || cs.nastaveni.podpisy.novyNazev } : {}),
          ...(patch.language !== undefined ? { jazyk: patch.language || null } : {}),
          ...(patch.html !== undefined ? { html: patch.html || null } : {}),
          ...(patch.text !== undefined ? { text: patch.text || null } : {}),
          ...(patch.defaultForMailboxId !== undefined ? { vychozi_pro_schranku: patch.defaultForMailboxId || null } : {}),
        })
        .eq("id", id)
        .select(COLUMNS)
        .single();
      if (error) throw new Error(error.message);
      return toSignature(data);
    },
  };
}

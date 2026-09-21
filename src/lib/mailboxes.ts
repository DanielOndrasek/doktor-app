import { supabase } from "@/lib/supabase/client";

/** `schranky.typ` z plánu (oddíl 3). */
export type MailboxType = "uvn" | "gmail" | "mediendo";

const TYPES: MailboxType[] = ["uvn", "gmail", "mediendo"];

export interface Mailbox {
  id: string;
  typ: MailboxType;
  adresa: string;
}

/**
 * Aktivní schránky uživatele z `schranky` (RLS), v pořadí ÚVN · Gmail · Mediendo.
 * Odsud bere okno psaní nabídku „Odeslat z" (K3.3, pravidlo 8). Adresa musí být
 * ta, kterou engine zná — podle ní vybírá schránku odeslání (`odeslat_z`).
 */
export async function loadMailboxes(client = supabase): Promise<Mailbox[]> {
  const { data, error } = await client.from("schranky").select("id, typ, adresa").eq("aktivni", true);
  if (error) throw error;
  return (data ?? [])
    .flatMap((r) => (TYPES.includes(r.typ as MailboxType) ? [{ id: r.id, typ: r.typ as MailboxType, adresa: r.adresa }] : []))
    .sort((a, b) => TYPES.indexOf(a.typ) - TYPES.indexOf(b.typ));
}

import { supabase } from "./client";

/** JWT ze Supabase pro engine; `null` = nepřihlášen (RequireAuth sem bez session nepustí). */
export async function getAccessToken(): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.access_token ?? null;
}

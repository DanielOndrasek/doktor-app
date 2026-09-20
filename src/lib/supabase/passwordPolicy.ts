import { cs } from "@/lib/i18n/cs";

/**
 * Jednotná heslová politika. Platí pro NOVÁ hesla — přihlašovací formulář
 * minLength nevynucuje. Stejnou hodnotu musí mít `password_min_length`
 * v nastavení Supabase Auth.
 *
 * Převzato z `crm/src/lib/passwordPolicy.ts` (vividbooks CRM, `831f9ae6`).
 */
export const MIN_PASSWORD_LENGTH = 12;

export const PASSWORD_TOO_SHORT_MESSAGE = cs.prihlaseni.hesloKratke(MIN_PASSWORD_LENGTH);

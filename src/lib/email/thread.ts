import type { MailListMessage } from "@/lib/email/types";

/**
 * Zpráva ve vlákně (engine `mail_thread`): hlavička jako v seznamu a prostý
 * text těla z indexu. Vlákno skládá engine podle klíče `vlakno` (K3.2:
 * „čtečka s originálem" ukazuje i to, co předcházelo).
 */
export interface ThreadMessage extends MailListMessage {
  body: string;
}

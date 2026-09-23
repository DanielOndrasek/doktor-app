import { cs } from "@/lib/i18n/cs";

/**
 * Tenký klient REST `/api/v1` enginu `uvn-mail-mcp` (plán, oddíl 4.1;
 * zadání K2 část B). Každá operace je `POST /api/v1/{nástroj}` s JSON
 * tělem 1 : 1 s nástrojem enginu a odpovědí v obálce `{ok, duvod, chyba}`.
 * Ověření: JWT ze Supabase v `Authorization: Bearer`, engine ho kontroluje
 * přes JWKS a vyžaduje aal2.
 *
 * Nad ním stojí `engineMailbox` (pošta) a `createSupabaseEventSource`
 * (kalendáře, `cal_*`). Tady není nic o doméně — jen přenos a chyby.
 */

export type EngineErrorCode =
  | "unauthorized"
  | "not_configured"
  | "not_exposed"
  | "attachment_by_link"
  | "network"
  | "engine"
  | "bad_response";

export class EngineError extends Error {
  readonly code: EngineErrorCode;
  /** `duvod` z odpovědi enginu, když ho poslal. */
  readonly reason?: string;
  /** `kod` z odpovědi enginu (`neplatny_ref`, `rodne_cislo`, …), když ho poslal. */
  readonly kod?: string;

  constructor(code: EngineErrorCode, message: string, reason?: string, kod?: string) {
    super(message);
    this.name = "EngineError";
    this.code = code;
    this.reason = reason;
    this.kod = kod;
  }
}

/**
 * Zpráva je v indexu enginu, ale ve schránce už ne — smazaná nebo přesunutá v Mailu
 * (engine `neplatny_ref`). Obrazovka ji odebere ze seznamu místo hlášení chyby.
 */
export function isMessageGone(err: unknown): boolean {
  return err instanceof EngineError && err.kod === "neplatny_ref";
}

/** Obálka každé odpovědi enginu. */
export interface WireEnvelope {
  ok: boolean;
  duvod?: string;
  chyba?: string;
  kod?: string;
}

export interface EngineClientOptions {
  /** Základ REST, typicky `import.meta.env.VITE_ENGINE_URL`. */
  baseUrl: string;
  /** JWT ze Supabase — engine ho ověřuje přes JWKS. `null` = nepřihlášen. */
  getToken: () => Promise<string | null>;
  fetchImpl?: typeof fetch;
}

export interface EngineClient {
  /** `POST {base}/api/v1/{tool}` s JSON tělem. */
  call: <T extends WireEnvelope>(tool: string, payload?: Record<string, unknown>) => Promise<T>;
  /** `POST {base}/api/v1/{tool}` s multipartem — pro `upload` (příloha jde na engine, ne base64). */
  callMultipart: <T extends WireEnvelope>(tool: string, form: FormData) => Promise<T>;
}

function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function createEngineClient(options: EngineClientOptions): EngineClient {
  const base = trimSlash(options.baseUrl);
  const fetchImpl = options.fetchImpl ?? fetch;

  async function authHeader(): Promise<Record<string, string>> {
    if (!base) throw new EngineError("not_configured", cs.engine.chybiAdresa);
    const token = await options.getToken();
    if (!token) throw new EngineError("unauthorized", cs.engine.neprihlasen);
    return { Authorization: `Bearer ${token}` };
  }

  async function readEnvelope<T extends WireEnvelope>(response: Response): Promise<T> {
    const body = (await response.json().catch(() => null)) as T | null;
    if (!body || typeof body !== "object") {
      throw new EngineError("bad_response", cs.engine.neplatnaOdpoved);
    }
    if (!response.ok || !body.ok) {
      // Engine: `duvod` = kód (`mfa_required`, `neplatny_ref`, …), `chyba` = věta pro uživatele.
      const code: EngineErrorCode = response.status === 401 || response.status === 403 ? "unauthorized" : "engine";
      throw new EngineError(code, body.chyba ?? body.duvod ?? cs.engine.neplatnaOdpoved, body.duvod, body.kod);
    }
    return body;
  }

  async function post<T extends WireEnvelope>(tool: string, init: RequestInit): Promise<T> {
    let response: Response;
    try {
      response = await fetchImpl(`${base}/api/v1/${tool}`, { method: "POST", ...init });
    } catch (err) {
      throw new EngineError("network", err instanceof Error ? err.message : cs.engine.sit);
    }
    return readEnvelope<T>(response);
  }

  return {
    async call(tool, payload = {}) {
      const headers = { ...(await authHeader()), "Content-Type": "application/json" };
      return post(tool, { headers, body: JSON.stringify(payload) });
    },
    async callMultipart(tool, form) {
      const headers = await authHeader();
      return post(tool, { headers, body: form });
    },
  };
}

/** Klient z env; `null`, dokud `VITE_ENGINE_URL` není nastavené (engine není propojený). */
export function createEngineClientFromEnv(getToken: EngineClientOptions["getToken"]): EngineClient | null {
  const baseUrl = import.meta.env.VITE_ENGINE_URL?.trim();
  if (!baseUrl) return null;
  return createEngineClient({ baseUrl, getToken });
}

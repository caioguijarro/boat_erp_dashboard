/**
 * Cliente compartilhado da API Tiny/Olist v2.
 * Centraliza a chamada HTTP (`olistPost`) usada tanto pela sincronização
 * (`olistSync.ts`) quanto pelo módulo de CRM (`crm.ts`), além de expor uma
 * variante com retry/backoff para lidar com o rate limit da API v2.
 */

import { ENV } from "./_core/env.js";

export const OLIST_API_BASE = "https://api.tiny.com.br/api2";

export class OlistError extends Error {
  constructor(message: string, readonly retorno?: any) {
    super(message);
    this.name = "OlistError";
  }
}

/**
 * Executa um POST na API Tiny v2. Retorna `data.retorno`.
 * Lança `OlistError` quando o Tiny responde com status "Erro".
 */
export async function olistPost(endpoint: string, params: Record<string, string>): Promise<any> {
  const token = ENV.olistApiToken;
  if (!token) throw new OlistError("OLIST_API_TOKEN not configured");

  const body = new URLSearchParams({ token, formato: "JSON", ...params });
  const res = await fetch(`${OLIST_API_BASE}/${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
  if (!res.ok) throw new OlistError(`Olist API error: ${res.status} ${res.statusText}`);

  let data;
  try {
    data = await res.json();
  } catch {
    throw new OlistError("Olist API error: Invalid JSON response");
  }

  if (data?.retorno?.status === "Erro") {
    throw new OlistError(`Olist API error: ${JSON.stringify(data.retorno.erros)}`, data.retorno);
  }
  return data?.retorno;
}

/**
 * Heurística para detectar erros de rate limit da API Tiny v2.
 * A v2 responde com mensagens do tipo "API Bloqueada" / "bloqueada
 * temporariamente" quando o limite de requisições por minuto é excedido.
 */
function isRateLimitError(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err).toLowerCase();
  return msg.includes("bloquead") || msg.includes("rate") || msg.includes("limite") || msg.includes("429");
}

const sleep = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

/**
 * `olistPost` com retry e backoff exponencial (2s, 4s, 8s, …) para erros de
 * rate limit. Erros que não sejam de rate limit são propagados imediatamente.
 */
export async function olistPostWithRetry(
  endpoint: string,
  params: Record<string, string>,
  opts: { retries?: number; baseDelayMs?: number } = {},
): Promise<any> {
  const retries = opts.retries ?? 3;
  const baseDelay = opts.baseDelayMs ?? 2_000;

  let lastErr: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await olistPost(endpoint, params);
    } catch (err) {
      lastErr = err;
      if (attempt < retries && isRateLimitError(err)) {
        const delay = baseDelay * 2 ** attempt;
        console.warn(`[Olist] Rate limit em ${endpoint}, retry ${attempt + 1}/${retries} em ${delay}ms`);
        await sleep(delay);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

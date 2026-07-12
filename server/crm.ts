/**
 * Lógica de negócio do CRM de recompra que fala com a API Tiny/Olist v2.
 * - Enriquecimento de telefone (contatos.pesquisa.php)
 * - Leitura do cadastro completo (contato.obter.php)
 * - Write-back com merge preservando campos não editados
 *   (contato.alterar.php / contato.incluir.php)
 *
 * O write-back só toca no Tiny quando `ENV.olistWritebackEnabled` é verdadeiro;
 * caso contrário a alteração fica apenas no banco local (optimistic update).
 */

import { ENV } from "./_core/env.js";
import { insertWebhookLog } from "./db.js";
import { olistPostWithRetry } from "./olistClient.js";

// Campos do CRM → campos do cadastro de contato do Tiny.
export type ContatoChanges = {
  telefone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
};

function changesToTinyFields(changes: ContatoChanges): Record<string, string> {
  const out: Record<string, string> = {};
  if (changes.telefone !== undefined && changes.telefone !== null) out.fone = changes.telefone;
  if (changes.whatsapp !== undefined && changes.whatsapp !== null) out.celular = changes.whatsapp;
  if (changes.email !== undefined && changes.email !== null) out.email = changes.email;
  return out;
}

/**
 * Busca o id de um contato no Tiny a partir do CPF/CNPJ (ou nome).
 * Retorna o primeiro id encontrado ou null.
 */
export async function buscarContatoIdPorCpf(cpfCnpj?: string | null, nome?: string | null): Promise<string | null> {
  const pesquisa = (cpfCnpj || nome || "").trim();
  if (!pesquisa) return null;
  try {
    const retorno = await olistPostWithRetry("contatos.pesquisa.php", { pesquisa });
    const lista = Array.isArray(retorno?.contatos) ? retorno.contatos : [];
    const primeiro = lista[0]?.contato;
    return primeiro?.id ? String(primeiro.id) : null;
  } catch (err) {
    console.warn("[CRM] buscarContatoIdPorCpf falhou:", err);
    return null;
  }
}

/**
 * Extrai um telefone (fone ou celular) do cadastro do Tiny via pesquisa.
 * Usado como fallback quando o telefone não veio no rawData do pedido.
 */
export async function buscarTelefoneTiny(cpfCnpj?: string | null, nome?: string | null): Promise<string | null> {
  const pesquisa = (cpfCnpj || nome || "").trim();
  if (!pesquisa) return null;
  try {
    const retorno = await olistPostWithRetry("contatos.pesquisa.php", { pesquisa });
    const lista = Array.isArray(retorno?.contatos) ? retorno.contatos : [];
    const c = lista[0]?.contato;
    const tel = c?.celular || c?.fone || null;
    return tel ? String(tel).trim() : null;
  } catch (err) {
    console.warn("[CRM] buscarTelefoneTiny falhou:", err);
    return null;
  }
}

/**
 * Obtém o cadastro completo do contato no Tiny.
 * Aceita id direto ou resolve o id via CPF/CNPJ. Retorna o objeto `contato`
 * completo (com todos os campos) ou null se não existir.
 */
export async function obterContatoTiny(opts: { id?: string | null; cpfCnpj?: string | null; nome?: string | null }): Promise<any | null> {
  let id = opts.id ?? null;
  if (!id) id = await buscarContatoIdPorCpf(opts.cpfCnpj, opts.nome);
  if (!id) return null;
  try {
    const retorno = await olistPostWithRetry("contato.obter.php", { id: String(id) });
    return retorno?.contato ?? null;
  } catch (err) {
    console.warn("[CRM] obterContatoTiny falhou:", err);
    return null;
  }
}

/** Envia contato.alterar.php com o cadastro (já mesclado) em JSON. */
export async function alterarContatoTiny(contato: Record<string, any>): Promise<any> {
  return olistPostWithRetry("contato.alterar.php", { contato: JSON.stringify(contato) });
}

/** Envia contato.incluir.php criando um novo cadastro. */
export async function incluirContatoTiny(contato: Record<string, any>): Promise<any> {
  return olistPostWithRetry("contato.incluir.php", { contato: JSON.stringify(contato) });
}

export type WriteBackResult = {
  olist: "updated" | "created" | "skipped" | "error";
  contatoId?: string;
  error?: string;
};

/**
 * Write-back de telefone/e-mail no cadastro do cliente no Tiny/Olist.
 *
 * Fluxo:
 *  1. Se o write-back está desabilitado → retorna "skipped" (só local).
 *  2. Busca o cadastro completo (obter). Mescla APENAS os campos alterados,
 *     preservando todos os demais (endereço, IE, fantasia, etc.).
 *  3. Se existe → contato.alterar.php; se não existe → contato.incluir.php.
 *  4. Registra a operação em webhook_logs.
 */
export async function writeBackContato(params: {
  clienteKey: string;
  cpfCnpj?: string | null;
  olistContatoId?: string | null;
  nome?: string | null;
  changes: ContatoChanges;
}): Promise<WriteBackResult> {
  const { clienteKey, cpfCnpj, olistContatoId, nome, changes } = params;
  const tinyChanges = changesToTinyFields(changes);

  if (!ENV.olistWritebackEnabled) {
    await insertWebhookLog({
      tipo: "crm_writeback",
      evento: "writeback_skipped",
      payload: JSON.stringify({ clienteKey, changes: tinyChanges, reason: "OLIST_WRITEBACK_ENABLED=false" }),
      status: "ignorado",
    });
    return { olist: "skipped" };
  }

  if (Object.keys(tinyChanges).length === 0) {
    return { olist: "skipped" };
  }

  try {
    const existente = await obterContatoTiny({ id: olistContatoId, cpfCnpj, nome });

    if (existente) {
      // Merge: preserva todos os campos existentes, sobrescreve só os editados.
      const merged = { ...existente, ...tinyChanges };
      const retorno = await alterarContatoTiny(merged);
      const contatoId = String(existente.id ?? retorno?.registros?.registro?.id ?? "");
      await insertWebhookLog({
        tipo: "crm_writeback",
        evento: "contato_alterado",
        payload: JSON.stringify({ clienteKey, contatoId, changes: tinyChanges }),
        status: "processado",
      });
      return { olist: "updated", contatoId: contatoId || undefined };
    }

    // Não existe: cria um cadastro mínimo.
    const novo: Record<string, any> = { nome: nome ?? "Cliente", ...tinyChanges };
    if (cpfCnpj) novo.cpf_cnpj = cpfCnpj;
    const retorno = await incluirContatoTiny(novo);
    const contatoId = String(retorno?.registros?.registro?.id ?? retorno?.registro?.id ?? "");
    await insertWebhookLog({
      tipo: "crm_writeback",
      evento: "contato_incluido",
      payload: JSON.stringify({ clienteKey, contatoId, changes: tinyChanges }),
      status: "processado",
    });
    return { olist: "created", contatoId: contatoId || undefined };
  } catch (err) {
    const error = String((err as Error)?.message ?? err);
    await insertWebhookLog({
      tipo: "crm_writeback",
      evento: "writeback_erro",
      payload: JSON.stringify({ clienteKey, changes: tinyChanges }),
      status: "erro",
      erroMsg: error,
    });
    return { olist: "error", error };
  }
}

import { supabase } from "./client.js";

export async function listarTransacoes({ desde, ate } = {}) {
  let query = supabase
    .from("financeiro_transacoes")
    .select("*, financeiro_participacoes(*)")
    .order("data", { ascending: false });

  if (desde) query = query.gte("data", desde);
  if (ate) query = query.lte("data", ate);

  return await query;
}

export async function criarTransacao(transacao) {
  return await supabase
    .from("financeiro_transacoes")
    .insert(transacao)
    .select("*")
    .single();
}

export async function criarParticipacoes(participacoes) {
  if (!participacoes || !participacoes.length) return { data: [], error: null };
  return await supabase
    .from("financeiro_participacoes")
    .insert(participacoes)
    .select("*");
}

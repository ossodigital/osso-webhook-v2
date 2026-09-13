import { supabase } from "./client.js";

export async function listarOrcamentos({ phone } = {}) {
  let query = supabase
    .from("orcamentos")
    .select("*")
    .order("created_at", { ascending: false });

  if (phone) query = query.eq("lead_phone", phone);

  return await query;
}

export async function criarOrcamento(orcamento) {
  return await supabase
    .from("orcamentos")
    .insert(orcamento)
    .select("*")
    .single();
}

export async function atualizarOrcamento(id, patch) {
  return await supabase
    .from("orcamentos")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
}

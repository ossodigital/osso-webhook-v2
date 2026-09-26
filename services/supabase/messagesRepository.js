import { supabase } from "./client.js";

export async function inserirMensagem(messagePayload) {
  return await supabase
    .from("messages")
    .insert(messagePayload)
    .select()
    .single();
}

export async function buscarMensagensMaisRecentesQue(phone, createdAtIso) {
  return await supabase
    .from("messages")
    .select("*")
    .eq("phone", phone)
    .eq("role", "user")
    .gt("created_at", createdAtIso)
    .order("created_at", { ascending: false });
}

export async function listarMensagensRecentes(limit = 80) {
  return await supabase
    .from("messages")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function listarMensagensPorTelefone(phone, limit = 200) {
  return await supabase
    .from("messages")
    .select("*")
    .eq("phone", phone)
    .order("created_at", { ascending: true })
    .limit(limit);
}

// Últimas `limit` mensagens em ordem cronológica, para derivar o estado
// estruturado do atendimento (independente da janela curta do LLM).
export async function buscarMensagensParaEstado(phone, limit = 80) {
  const result = await supabase
    .from("messages")
    .select("role, content, created_at")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(limit);
  return { ...result, data: result.data ? [...result.data].reverse() : result.data };
}

export async function buscarUltimaMensagemAssistente(phone) {
  return await supabase
    .from("messages")
    .select("content, created_at")
    .eq("phone", phone)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function buscarHistoricoRecente(phone, limit = 4) {
  return await supabase
    .from("messages")
    .select("role, content")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(limit);
}

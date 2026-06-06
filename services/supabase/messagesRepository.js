import { supabase } from "./client.js";

export async function inserirMensagem(messagePayload) {
  return await supabase
    .from("messages")
    .insert(messagePayload);
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

export async function buscarHistoricoRecente(phone, limit = 4) {
  return await supabase
    .from("messages")
    .select("role, content")
    .eq("phone", phone)
    .order("created_at", { ascending: false })
    .limit(limit);
}

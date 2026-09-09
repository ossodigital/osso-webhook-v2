import { supabase } from "./client.js";

export async function contarLeadsTotal() {
  return await supabase
    .from("leads")
    .select("*", { count: "exact", head: true })
    .is("deleted_at", null);
}

export async function listarLeadsParaRelatorio(diasAtras = 30) {
  const desde = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000).toISOString();
  return await supabase
    .from("leads")
    .select("stage, created_at")
    .is("deleted_at", null)
    .gte("created_at", desde);
}

export async function listarMensagensParaTempoResposta(diasAtras = 30) {
  const desde = new Date(Date.now() - diasAtras * 24 * 60 * 60 * 1000).toISOString();
  return await supabase
    .from("messages")
    .select("phone, role, created_at")
    .gte("created_at", desde)
    .order("phone", { ascending: true })
    .order("created_at", { ascending: true });
}

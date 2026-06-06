import { supabase } from "./client.js";

export async function buscarLeadPorTelefone(phone) {
  return await supabase
    .from("leads")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();
}

export async function listarLeadsRecentes(limit = 50) {
  return await supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(limit);
}

export async function upsertLead(leadPayload) {
  return await supabase
    .from("leads")
    .upsert(leadPayload, { onConflict: "phone" });
}

export async function atualizarLeadPorTelefone(phone, updatePayload) {
  return await supabase
    .from("leads")
    .update(updatePayload)
    .eq("phone", phone);
}

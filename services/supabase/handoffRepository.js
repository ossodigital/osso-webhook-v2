import { supabase } from "./client.js";

export async function buscarHandoffAtivo(phone) {
  return await supabase.from("handoff_events").select("*").eq("phone", phone)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
}

export async function registrarHandoffEvent(event) {
  return await supabase.from("handoff_events").insert(event).select("*").single();
}

export async function listarHandoffsAtivosPorTelefones(phones = []) {
  if (!phones.length) return { data: [], error: null };
  const result = await supabase.from("handoff_events").select("*").in("phone", phones)
    .order("created_at", { ascending: false });
  if (result.error) return result;
  const latestByPhone = new Map();
  for (const event of result.data || []) {
    if (!latestByPhone.has(event.phone)) latestByPhone.set(event.phone, event);
  }
  return { data: [...latestByPhone.values()], error: null };
}

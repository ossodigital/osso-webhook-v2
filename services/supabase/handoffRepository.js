import { supabase } from "./client.js";

export async function buscarHandoffAtivo(phone) {
  return await supabase.from("handoff_events").select("*").eq("phone", phone)
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
}

export async function registrarHandoffEvent(event) {
  return await supabase.from("handoff_events").insert(event).select("*").single();
}

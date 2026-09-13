import { supabase } from "./client.js";

export async function listarSessions({ desde, ate } = {}) {
  let query = supabase
    .from("sessions")
    .select("*")
    .order("scheduled_at", { ascending: true });

  if (desde) query = query.gte("scheduled_at", desde);
  if (ate) query = query.lte("scheduled_at", ate);

  return await query;
}

export async function criarSession(session) {
  return await supabase
    .from("sessions")
    .insert(session)
    .select("*")
    .single();
}

export async function atualizarSession(id, patch) {
  return await supabase
    .from("sessions")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
}

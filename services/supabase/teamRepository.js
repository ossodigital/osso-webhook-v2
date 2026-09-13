import { supabase } from "./client.js";

export async function listarTeamMembers() {
  return await supabase
    .from("team_members")
    .select("*")
    .order("name", { ascending: true });
}

export async function criarTeamMember(member) {
  return await supabase
    .from("team_members")
    .insert(member)
    .select("*")
    .single();
}

export async function atualizarTeamMember(id, patch) {
  return await supabase
    .from("team_members")
    .update(patch)
    .eq("id", id)
    .select("*")
    .single();
}

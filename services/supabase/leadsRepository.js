import { supabase } from "./client.js";

export async function buscarLeadPorTelefone(phone) {
  return await supabase
    .from("leads")
    .select("*")
    .eq("phone", phone)
    .maybeSingle();
}

export async function listarLeadsRecentes({ limit = 50, offset = 0, search = "", stage = "" } = {}) {
  let query = supabase
    .from("leads")
    .select("*", { count: "exact" })
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .order("id", { ascending: false });

  if (stage) {
    query = query.eq("stage", stage);
  }

  if (search) {
    const termo = search.replace(/[%,]/g, "").trim();
    if (termo) {
      const padrao = `%${termo}%`;
      query = query.or(`name.ilike.${padrao},phone.ilike.${padrao},last_message.ilike.${padrao}`);
    }
  }

  return await query.range(offset, offset + limit - 1);
}

export async function contarLeadsPorStage() {
  const contagem = async (stage) => {
    let query = supabase.from("leads").select("*", { count: "exact", head: true }).is("deleted_at", null);
    if (stage) query = query.eq("stage", stage);
    return query;
  };

  const [total, humano, quente, agendamento] = await Promise.all([
    contagem(),
    contagem("humano"),
    contagem("quente"),
    contagem("agendamento")
  ]);

  const error = total.error || humano.error || quente.error || agendamento.error || null;
  if (error) return { data: null, error };

  return {
    data: {
      total: total.count ?? 0,
      humano: humano.count ?? 0,
      quente: quente.count ?? 0,
      agendamento: agendamento.count ?? 0
    },
    error: null
  };
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

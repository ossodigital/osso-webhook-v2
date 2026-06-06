import { buscarHistoricoRecente } from "../supabase/messagesRepository.js";

export async function carregarHistoricoConversa(phone, limit = 4) {
  const { data: history, error: historyError } = await buscarHistoricoRecente(phone, limit);

  return {
    history,
    historyError,
    conversationHistory: formatarHistoricoConversa(history)
  };
}

export function formatarHistoricoConversa(history = []) {
  return (history || [])
    .reverse()
    .map((item) => ({
      role: item.role,
      content: item.content
    }));
}

// Composição segura de mensagem humana no dashboard: digitar → revisar → enviar.
// Mensagem entregue no WhatsApp não pode ser apagada (Meta Cloud API não tem
// "apagar para todos"), então toda a proteção acontece ANTES do envio.

export const COMPOSER_SHORT_LIMIT = 3;
export const COMPOSER_DUPLICATE_WINDOW_MS = 30 * 1000;

export function validarRascunho(texto) {
  const limpo = String(texto ?? "").trim();
  if (!limpo) return { status: "vazio", texto: "" };
  if (limpo.length <= COMPOSER_SHORT_LIMIT) return { status: "curto", texto: limpo };
  return { status: "ok", texto: limpo };
}

// Enter nunca envia (mobile e desktop): quebra de linha é o comportamento
// nativo do textarea. Envio só por botão explícito.
export function acaoDaTecla() {
  return "nova_linha";
}

export function criarComposer({ enviar, confirmar = () => false, agora = () => Date.now() } = {}) {
  let revisado = null;
  let emEnvio = null;
  let ultimoEnviado = null;

  return {
    get revisado() {
      return revisado;
    },

    get enviando() {
      return Boolean(emEnvio);
    },

    revisar(texto) {
      const rascunho = validarRascunho(texto);
      if (rascunho.status === "vazio") {
        revisado = null;
        return { ok: false, motivo: "vazio" };
      }
      revisado = rascunho.texto;
      return { ok: true, texto: rascunho.texto, curto: rascunho.status === "curto" };
    },

    invalidarRevisao() {
      if (!emEnvio) revisado = null;
    },

    enviar(textoAtual) {
      // Duplo toque/clique: devolve o mesmo envio em andamento.
      if (emEnvio) return emEnvio;

      const rascunho = validarRascunho(textoAtual);
      if (rascunho.status === "vazio") return Promise.resolve({ ok: false, motivo: "vazio" });
      if (revisado === null || revisado !== rascunho.texto) return Promise.resolve({ ok: false, motivo: "revisar" });

      let confirmShort = false;
      if (rascunho.status === "curto") {
        if (!confirmar(`A mensagem tem só ${rascunho.texto.length} caractere(s): "${rascunho.texto}". Enviar mesmo assim?`)) {
          return Promise.resolve({ ok: false, motivo: "curto_cancelado" });
        }
        confirmShort = true;
      }

      let allowDuplicate = false;
      if (ultimoEnviado && ultimoEnviado.texto === rascunho.texto && agora() - ultimoEnviado.em < COMPOSER_DUPLICATE_WINDOW_MS) {
        if (!confirmar("Essa mesma mensagem acabou de ser enviada. Enviar de novo?")) {
          return Promise.resolve({ ok: false, motivo: "duplicada" });
        }
        allowDuplicate = true;
      }

      emEnvio = (async () => {
        try {
          const resultado = await enviar(rascunho.texto, { confirmShort, allowDuplicate });
          if (resultado?.ok) {
            ultimoEnviado = { texto: rascunho.texto, em: agora() };
            revisado = null;
          }
          return resultado;
        } finally {
          emEnvio = null;
        }
      })();
      return emEnvio;
    }
  };
}

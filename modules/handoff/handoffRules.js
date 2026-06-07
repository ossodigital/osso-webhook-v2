export function extrairTextoBasicoMensagem(msg) {
  if (msg.text?.body) {
    return msg.text.body.trim();
  }

  if (msg.audio?.id) {
    return "áudio recebido durante atendimento humano";
  }

  if (msg.image?.id) {
    return "imagem recebida durante atendimento humano";
  }

  return "mensagem recebida durante atendimento humano";
}

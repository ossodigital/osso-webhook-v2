export function prepararConteudoImagemReferencia(buffer) {
  const base64 = Buffer.from(buffer).toString("base64");

  return {
    userText: "cliente enviou imagem de referência de tattoo",
    userContent: [
      {
        type: "text",
        text: `O cliente enviou uma referência de tatuagem.

Analise a imagem e:
- identifique o estilo
- sugira tamanho ideal
- sugira possíveis locais do corpo
- peça apenas o que faltar para orçamento
- identifique o que o cliente já informou
- não repita perguntas
- seja direto, humano e profissional`
      },
      {
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${base64}`
        }
      }
    ]
  };
}

export function prepararFallbackImagemReferencia() {
  return {
    userText: "cliente enviou imagem de tattoo",
    userContent: [
      {
        type: "text",
        text: `Cliente enviou uma imagem de referência de tatuagem.

Ajude no atendimento:
- diga que recebeu a referência
- peça tamanho em cm se faltar
- peça local do corpo se faltar
- conduza para orçamento sem repetir perguntas`
      }
    ]
  };
}

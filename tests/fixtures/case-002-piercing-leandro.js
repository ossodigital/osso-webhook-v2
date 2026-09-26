// Caso real 002 (2026-09-25): cliente pergunta de piercing, agente perde o
// contexto, responde preço de tattoo e entra em loop prometendo confirmação.
// Texto das mensagens preservado; telefone omitido.
export const CASE_002_MESSAGES = Object.freeze([
  { role: "user", content: "olá tudo bom?", created_at: "2026-09-25T16:36:00Z" },
  { role: "assistant", content: "Claro! Antes de continuar, como posso te chamar? 😊", created_at: "2026-09-25T16:36:10Z" },
  { role: "user", content: "Leandro", created_at: "2026-09-25T16:36:20Z" },
  { role: "assistant", content: "Tudo certo, Leandro! Me conta, qual a ideia da tatuagem que você tem em mente?", created_at: "2026-09-25T16:36:30Z" },
  { role: "user", content: "vcs fazem pircing tbm?", created_at: "2026-09-25T16:37:00Z" },
  { role: "assistant", content: "Sim, fazemos! Aqui no estúdio, a Jennyfer (@jennyfertattoopierce) é especialista em piercings. Quer que eu confirme com ela a disponibilidade e valores para você?", created_at: "2026-09-25T16:37:10Z" },
  { role: "user", content: "sim.", created_at: "2026-09-25T16:37:20Z" },
  { role: "assistant", content: "Beleza, vou confirmar com a Jennyfer e já te dou um retorno sobre valores e disponibilidade!", created_at: "2026-09-25T16:37:30Z" },
  { role: "user", content: "ok", created_at: "2026-09-25T16:37:40Z" },
  { role: "assistant", content: "Assim que eu tiver a resposta da Jennyfer, te aviso! Se tiver mais alguma dúvida, é só falar.", created_at: "2026-09-25T16:37:50Z" },
  { role: "user", content: "blz*", created_at: "2026-09-25T16:38:00Z" },
  { role: "assistant", content: "Beleza! Se precisar de algo, é só chamar. 😊", created_at: "2026-09-25T16:38:10Z" },
  { role: "user", content: "oi, vcs atendem amanhã?", created_at: "2026-09-25T17:18:00Z" },
  { role: "assistant", content: "Sim, atendemos amanhã, mas sempre com horário agendado. Tem alguma ideia de tattoo ou piercing em mente?", created_at: "2026-09-25T17:18:10Z" },
  { role: "user", content: "sim, o segundo na orelha esquerda.", created_at: "2026-09-25T17:19:00Z" },
  { role: "assistant", content: "Fazemos sim! Vou confirmar com a Jennyfer a disponibilidade e o valor para o piercing. Quer que eu já encaminhe isso para ela?", created_at: "2026-09-25T17:19:10Z" },
  { role: "user", content: "sim.", created_at: "2026-09-25T17:19:20Z" },
  { role: "assistant", content: "Perfeito, vou encaminhar para a Jennyfer confirmar o valor e a disponibilidade. Ela já retorna para você!", created_at: "2026-09-25T17:19:30Z" },
  { role: "user", content: "ok", created_at: "2026-09-25T17:19:40Z" },
  { role: "assistant", content: "Qualquer outra dúvida, é só chamar! 😉", created_at: "2026-09-25T17:20:00Z" },
  { role: "user", content: "amanhã a tarde vcs atendem?", created_at: "2026-09-25T18:06:00Z" },
  { role: "assistant", content: "Sim, atendemos amanhã à tarde, mas apenas com horário agendado. Queremos garantir o melhor atendimento. Você já tem uma ideia do que gostaria de fazer?", created_at: "2026-09-25T18:06:10Z" },
  { role: "user", content: "qual é a média de preço?", created_at: "2026-09-25T18:10:00Z" },
  { role: "assistant", content: "A média de preço depende do tamanho, local do corpo, estilo e nível de detalhes da tattoo. Mas para referência, o valor mínimo é R$150, uma sessão de 3 horas custa R$650 e de 6 horas, R$1.200. Você já tem ideia do tamanho, local ou estilo?", created_at: "2026-09-25T18:10:10Z" },
  { role: "user", content: "mas pircing", created_at: "2026-09-25T18:10:30Z" },
  { role: "assistant", content: "Ah, entendi! Sim, fazemos piercing também, com a nossa profissional Jennyfer (@jennyfertattoopierce). Vou confirmar com ela a disponibilidade e o valor para você. Qual piercing você gostaria de fazer?", created_at: "2026-09-25T18:10:40Z" },
  { role: "user", content: "ola, conseguiu confirmar?", created_at: "2026-09-25T20:26:00Z" },
  { role: "assistant", content: "Vou encaminhar sua dúvida sobre piercing para a Jennyfer confirmar disponibilidade e valor. Ela vai te dar as informações certinhas!", created_at: "2026-09-25T20:26:10Z" },
  { role: "user", content: "ok", created_at: "2026-09-25T20:26:20Z" },
  { role: "assistant", content: "Perfeito, qualquer dúvida é só chamar!", created_at: "2026-09-25T20:27:00Z" },
  { role: "user", content: "tem alguma previsão de resposta sobre disponibilidade e valor?", created_at: "2026-09-25T21:06:00Z" }
]);

// Respostas do agente que NUNCA mais podem sair nesse contexto.
export const CASE_002_FORBIDDEN_REPLIES = Object.freeze([
  "A média de preço depende do tamanho, local do corpo, estilo e nível de detalhes da tattoo. Mas para referência, o valor mínimo é R$150, uma sessão de 3 horas custa R$650 e de 6 horas, R$1.200.",
  "Vou confirmar com a Jennyfer e te dou um retorno o mais rápido possível. Fique tranquilo que já estou cuidando disso!"
]);

export function extrairNome(userText = "") {
  const text = userText.trim();

  const match = text.match(/(?:meu nome é|me chamo|sou o|sou a|pode me chamar de|me chama de)\s+(.+)/i);
  if (match?.[1]) {
    return match[1].trim().split(/[,.!?]/)[0].trim();
  }

  const textoBaixo = text.toLowerCase();

  const palavrasInvalidas = [
    "oi",
    "olá",
    "ola",
    "bom dia",
    "boa tarde",
    "boa noite",
    "quero",
    "valor",
    "preço",
    "orcamento",
    "orçamento",
    "tattoo",
    "tatuagem",
    "agendar",
    "horário",
    "horario"
  ];

  if (palavrasInvalidas.includes(textoBaixo)) return null;

  if (text.length >= 2 && text.length <= 40 && /^[a-zA-ZÀ-ÿ\s'-]+$/.test(text)) {
    return text;
  }

  return null;
}

export function identificarLeadCurioso(userText = "") {
  const text = userText.toLowerCase().trim();

  return /calote|golpe|zoeira|brincadeira|kkk|kkkk/i.test(text);
}

export function identificarLeadQuente(userText = "") {
  const text = userText.toLowerCase().trim();

  return /pix|cartão|cartao|sinal|fechar|quero fazer|quero tatuar|vou fazer|vamos fazer/i.test(text);
}

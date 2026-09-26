// Estado estruturado de atendimento por lead.
//
// Derivado de forma determinística do log persistido de mensagens (tabela
// `messages`), e não da janela curta de histórico enviada ao LLM. Assim o
// assunto da conversa (ex.: piercing) sobrevive a qualquer número de mensagens
// e a mesma lógica serve o webhook, o prompt e o dashboard.

import { STUDIO_CATALOG, getPiercingProcedure } from "../../config/business/catalog.js";

export const SERVICE_TYPE = Object.freeze({ TATTOO: "tattoo", PIERCING: "piercing", UNKNOWN: "unknown" });

export const PRICE_STATUS = Object.freeze({
  NOT_APPLICABLE: "not_applicable",
  AVAILABLE: "available",
  INFORMED: "informed",
  REFERENCE_ONLY: "reference_only",
  NEEDS_HUMAN_CONFIRMATION: "needs_human_confirmation"
});

export const AVAILABILITY_STATUS = Object.freeze({
  NOT_REQUESTED: "not_requested",
  REQUESTED: "requested",
  NEEDS_HUMAN_CONFIRMATION: "needs_human_confirmation",
  RESOLVED: "resolved"
});

export const PENDING_ACTION = Object.freeze({
  CONFIRM_AVAILABILITY: "confirm_availability",
  CONFIRM_PRICE: "confirm_price",
  RESOLVE_PROMISE: "resolve_promise"
});

// UTC-3 fixo (Brasil sem horário de verão desde 2019).
const STUDIO_UTC_OFFSET_HOURS = -3;

export function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .replace(/º/gu, "o")
    .replace(/\s+/gu, " ")
    .trim();
}

const PIERCING_WORDS = /\b(piercing|piercings|pircing|pircings|pirsing|piercin|piercim|pierce|pearcing|furo|furos|furar|furinho|brinco|ponto de luz|argola|helix|tragus|septo|nostril|conch|industrial|lobulo|umbigo)\b/u;
const TATTOO_WORDS = /\b(tattoo|tattoos|tatoo|tatto|tatuagem|tatuagens|tatuar|tattos)\b/u;
const NEGATED_TATTOO = /\bnao (?:e|eh|quero|seria|sera|to falando de)? ?(?:uma |de )?(?:tattoo|tatoo|tatto|tatuagem)\b/u;
const NEGATED_PIERCING = /\bnao (?:e|eh|quero|seria|sera|to falando de)? ?(?:um |de )?(?:piercing|pircing|furo)\b/u;

const PIERCING_TYPES = [
  { key: "ponto_de_luz_micro", pattern: /\bponto de luz\b/u },
  { key: "terceiro_furo", pattern: /\b(terceiro|3o)\b/u, needsEarContext: true },
  { key: "segundo_furo", pattern: /\b(segundo|2o)\b/u, needsEarContext: true },
  { key: "primeiro_furo", pattern: /\b(primeiro|1o)\s+(furo|brinco)\b/u },
  { key: "helix", pattern: /\bhelix\b/u },
  { key: "tragus", pattern: /\btragus\b/u },
  { key: "conch", pattern: /\bconch\b/u },
  { key: "industrial", pattern: /\bindustrial\b/u },
  { key: "septo", pattern: /\bsepto\b/u },
  { key: "nostril", pattern: /\b(nostril|nariz)\b/u },
  { key: "umbigo", pattern: /\bumbigo\b/u },
  { key: "lingua", pattern: /\blingua\b/u },
  { key: "sobrancelha", pattern: /\bsobrancelha\b/u },
  { key: "labio", pattern: /\b(labio|labret|smiley)\b/u },
  { key: "mamilo", pattern: /\bmamilo\b/u }
];

const PIERCING_TYPE_LABELS = Object.freeze({
  primeiro_furo: "primeiro furo",
  terceiro_furo: "terceiro furo",
  helix: "helix",
  tragus: "tragus",
  conch: "conch",
  industrial: "industrial",
  septo: "septo",
  nostril: "nostril (nariz)",
  umbigo: "umbigo",
  lingua: "língua",
  sobrancelha: "sobrancelha",
  labio: "lábio",
  mamilo: "mamilo"
});

const LOCATIONS = [
  { key: "orelha", pattern: /\b(orelha|lobulo|cartilagem)\b/u },
  { key: "nariz", pattern: /\b(nariz|septo|nostril)\b/u },
  { key: "umbigo", pattern: /\bumbigo\b/u },
  { key: "lingua", pattern: /\blingua\b/u },
  { key: "sobrancelha", pattern: /\bsobrancelha\b/u },
  { key: "labio", pattern: /\blabio\b/u }
];

const MATERIALS = [
  { key: "titanio", pattern: /\btitanio\b/u },
  { key: "aco", pattern: /\b(aco|aco cirurgico)\b/u },
  { key: "ouro", pattern: /\bouro\b/u }
];

const WEEKDAYS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

const PRICE_QUESTION = /\b(quanto|quantos|valor|valores|preco|precos|custa|custo|custam|media de preco|tabela|cobra|cobram|orcamento)\b/u;
// Pedido de horário explícito vale sozinho; palavras genéricas ("atende",
// "funciona", "abre") só contam junto de um dia/período concreto.
const AVAILABILITY_STRONG = /\b(horario|horarios|disponivel|disponibilidade|vaga|vagas|agendar|marcar|encaixe|encaixar|consigo ir|posso ir|da pra ir)\b/u;
const AVAILABILITY_WEAK = /\b(atende|atendem|atendimento|agenda|abre|abrem|funciona|funcionam)\b/u;
const FOLLOW_UP = /\b(conseguiu|consegue|conseguiram) (confirmar|ver|verificar|falar|checar|saber)\b|\b(alguma|tem|teve|ha) (previsao|novidade|resposta|retorno|noticia)\b|\bja (confirmou|conseguiu|viu|falou|tem (a )?resposta|sabe)\b|\bprevisao\b|^e ai\b|\bcade (a )?(resposta|retorno|confirmacao)\b|\bconfirmou\b|\bficou de (me )?(confirmar|responder|retornar|avisar)\b/u;

// Promessa de ação externa (consultar alguém, retornar depois, encaminhar).
export const PROMISE_PATTERN = /\b(vou|irei|vamos|ja vou) (confirmar|verificar|consultar|checar|encaminhar|repassar|perguntar|ver com|falar com|alinhar|conferir|te retornar|te avisar|te responder)\b|\b(ja|logo) te (retorno|respondo|aviso|dou (um )?retorno)\b|\bte (dou|darei|trago) (um |o )?retorno\b|\bestou (verificando|confirmando|consultando|cuidando|checando)\b|\bja estou (cuidando|vendo|verificando)\b|\bassim que (eu )?(tiver|souber|ela|ele|receber)\b|\b(ela|ele|a jennyfer|o coringa|a equipe) (ja )?(vai|vao|ira) (te )?(responder|retornar|confirmar|entrar em contato|chamar|falar|passar)\b|\b(ela|ele) ja (te )?(retorna|responde)\b|\bquer que eu (confirme|encaminhe|verifique|consulte|pergunte)\b|\bte aviso\b/u;

// Resposta que efetivamente resolve a disponibilidade: um horário concreto
// ("15h", "14:30") ou confirmação explícita do agendamento. Faixa de
// funcionamento ("10h às 20h") e "com horário agendado" genérico não contam.
const CONCRETE_TIME = /\b\d{1,2}\s?(h|hs|:\d{2})\b/u;
const OPENING_HOURS_RANGE = /\b\d{1,2}\s?h\s?(as|a|-|ate)\s?\d{1,2}\s?h\b/u;
const EXPLICIT_CONFIRMATION = /\b(horario|agendamento|reserva|vaga)\s+(esta |ficou |foi )?(confirmad[oa]|reservad[oa]|garantid[oa])\b|\b(confirmado|agendado|marcado|reservado) (pra|para) (voce|vc|hoje|amanha|as|o dia)\b/u;

function resolvesAvailability(text) {
  if (EXPLICIT_CONFIRMATION.test(text)) return true;
  return CONCRETE_TIME.test(text) && !OPENING_HOURS_RANGE.test(text);
}

function detectService(text, currentService) {
  const piercing = PIERCING_WORDS.test(text) && !NEGATED_PIERCING.test(text);
  const tattoo = TATTOO_WORDS.test(text) && !NEGATED_TATTOO.test(text);
  if (piercing && !tattoo) return SERVICE_TYPE.PIERCING;
  if (tattoo && !piercing) return SERVICE_TYPE.TATTOO;
  if (piercing && tattoo) {
    if (currentService === SERVICE_TYPE.PIERCING || currentService === SERVICE_TYPE.TATTOO) return currentService;
    return text.search(PIERCING_WORDS) > text.search(TATTOO_WORDS) ? SERVICE_TYPE.PIERCING : SERVICE_TYPE.TATTOO;
  }
  // "não é tattoo" sem citar piercing só indica que não é tattoo.
  if (NEGATED_TATTOO.test(text) && currentService === SERVICE_TYPE.TATTOO) return SERVICE_TYPE.UNKNOWN;
  return null;
}

function detectPiercingType(text, serviceType) {
  const earContext = /\b(orelha|furo|brinco|lobulo)\b/u.test(text) || serviceType === SERVICE_TYPE.PIERCING;
  for (const type of PIERCING_TYPES) {
    if (!type.pattern.test(text)) continue;
    if (type.needsEarContext && !earContext) continue;
    return type.key;
  }
  return null;
}

function detectLocation(text) {
  const location = LOCATIONS.find((item) => item.pattern.test(text));
  if (!location) return null;
  const side = /\besquerd[oa]\b/u.test(text) ? "esquerda" : /\bdireit[oa]\b/u.test(text) ? "direita" : null;
  return side ? `${location.key} ${side}` : location.key;
}

function detectMaterial(text) {
  return MATERIALS.find((item) => item.pattern.test(text))?.key || null;
}

function studioDate(isoTimestamp) {
  const base = isoTimestamp ? new Date(isoTimestamp) : new Date();
  const time = Number.isNaN(base.getTime()) ? Date.now() : base.getTime();
  return new Date(time + STUDIO_UTC_OFFSET_HOURS * 3600 * 1000);
}

function isoDay(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  return new Date(date.getTime() + days * 86400 * 1000);
}

export function detectRequestedDate(text, sentAt = null) {
  const local = studioDate(sentAt);
  if (/\bdepois de amanha\b/u.test(text)) return { label: "depois de amanhã", date: isoDay(addDays(local, 2)) };
  if (/\bamanha\b/u.test(text)) return { label: "amanhã", date: isoDay(addDays(local, 1)) };
  if (/\bhoje\b/u.test(text)) return { label: "hoje", date: isoDay(local) };
  const explicit = text.match(/\b(\d{1,2})\/(\d{1,2})\b/u);
  if (explicit) {
    const day = Number(explicit[1]);
    const month = Number(explicit[2]);
    if (day >= 1 && day <= 31 && month >= 1 && month <= 12) {
      let year = local.getUTCFullYear();
      const candidate = new Date(Date.UTC(year, month - 1, day));
      if (candidate.getTime() < Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate())) year += 1;
      return { label: `${String(day).padStart(2, "0")}/${String(month).padStart(2, "0")}`, date: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` };
    }
  }
  const weekday = text.match(/\b(segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:-feira| feira)?\b/u);
  if (weekday && !/\bsegunda (na|da|no|do|orelha|furo)\b/u.test(text)) {
    const target = WEEKDAYS.indexOf(weekday[1]);
    let delta = (target - local.getUTCDay() + 7) % 7;
    if (delta === 0) delta = 7;
    const labels = { terca: "terça", sabado: "sábado" };
    return { label: labels[weekday[1]] || weekday[1], date: isoDay(addDays(local, delta)) };
  }
  return null;
}

export function detectRequestedPeriod(text) {
  // "amanha" contém "manha": remove o dia antes de procurar o período.
  if (/\bmanha\b/u.test(text.replace(/\b(depois de )?amanha\b/gu, " "))) return "manhã";
  if (/\btarde\b/u.test(text)) return "tarde";
  if (/\bnoite\b/u.test(text)) return "noite";
  const hour = text.match(/\b(?:as |a partir das |depois das )?(\d{1,2})\s?(?:h|hs|horas|:\d{2})\b/u);
  if (hour && Number(hour[1]) >= 0 && Number(hour[1]) <= 23) return `${hour[1].padStart(2, "0")}h`;
  return null;
}

export function analyzeUserMessage(content, { serviceType = SERVICE_TYPE.UNKNOWN, sentAt = null } = {}) {
  const text = normalizeText(content);
  const service = detectService(text, serviceType);
  const effectiveService = service && service !== SERVICE_TYPE.UNKNOWN ? service : serviceType;
  const requestedDate = detectRequestedDate(text, sentAt);
  const requestedPeriod = detectRequestedPeriod(text);
  const mentionsTime = Boolean(requestedDate || requestedPeriod);
  const asksAvailability = AVAILABILITY_STRONG.test(text)
    || (mentionsTime && (AVAILABILITY_WEAK.test(text) || effectiveService === SERVICE_TYPE.PIERCING));
  return {
    text,
    service,
    piercingType: detectPiercingType(text, effectiveService),
    location: detectLocation(text),
    material: detectMaterial(text),
    requestedDate,
    requestedPeriod,
    asksPrice: PRICE_QUESTION.test(text),
    asksAvailability,
    isFollowUp: FOLLOW_UP.test(text)
  };
}

export function isPromise(content) {
  return PROMISE_PATTERN.test(normalizeText(content));
}

function assistantInformedPiercingPrice(text) {
  const amounts = Object.values(STUDIO_CATALOG.piercing.procedures)
    .flatMap((procedure) => procedure.options.map((option) => option.amount));
  return amounts.some((amount) => new RegExp(`r\\$ ?${amount}\\b`, "u").test(text));
}

export function isPricedPiercingType(piercingType) {
  return Boolean(getPiercingProcedure(piercingType));
}

export function piercingTypeLabel(piercingType) {
  return getPiercingProcedure(piercingType)?.label || PIERCING_TYPE_LABELS[piercingType] || piercingType || null;
}

export function createEmptyAttendanceState() {
  return {
    service_type: SERVICE_TYPE.UNKNOWN,
    piercing_type: null,
    piercing_location: null,
    jewelry_material: null,
    requested_date: null,
    requested_period: null,
    price_requested: false,
    price_informed: false,
    availability_requested: false,
    availability_resolved: false,
    price_status: PRICE_STATUS.NOT_APPLICABLE,
    availability_status: AVAILABILITY_STATUS.NOT_REQUESTED,
    pending_action: null,
    human_handoff: false,
    unresolved_promises: 0,
    follow_ups_since_promise: 0,
    loop_detected: false,
    current: null
  };
}

function finalize(state) {
  if (state.service_type === SERVICE_TYPE.PIERCING) {
    if (state.piercing_type && !isPricedPiercingType(state.piercing_type)) {
      // Procedimento fora da tabela: preço só com confirmação humana.
      state.price_status = state.price_requested && !state.price_informed
        ? PRICE_STATUS.NEEDS_HUMAN_CONFIRMATION
        : PRICE_STATUS.NOT_APPLICABLE;
    } else {
      state.price_status = state.price_informed ? PRICE_STATUS.INFORMED : PRICE_STATUS.AVAILABLE;
    }
  } else if (state.service_type === SERVICE_TYPE.TATTOO) {
    state.price_status = PRICE_STATUS.REFERENCE_ONLY;
  } else {
    state.price_status = PRICE_STATUS.NOT_APPLICABLE;
  }

  if (!state.availability_requested) {
    state.availability_status = AVAILABILITY_STATUS.NOT_REQUESTED;
  } else if (state.availability_resolved) {
    state.availability_status = AVAILABILITY_STATUS.RESOLVED;
  } else if (state.service_type === SERVICE_TYPE.PIERCING && !STUDIO_CATALOG.piercing.availabilityLookup) {
    state.availability_status = AVAILABILITY_STATUS.NEEDS_HUMAN_CONFIRMATION;
  } else {
    state.availability_status = AVAILABILITY_STATUS.REQUESTED;
  }

  if (state.availability_status === AVAILABILITY_STATUS.NEEDS_HUMAN_CONFIRMATION) {
    state.pending_action = PENDING_ACTION.CONFIRM_AVAILABILITY;
  } else if (state.price_status === PRICE_STATUS.NEEDS_HUMAN_CONFIRMATION) {
    state.pending_action = PENDING_ACTION.CONFIRM_PRICE;
  } else if (state.unresolved_promises > 0) {
    state.pending_action = PENDING_ACTION.RESOLVE_PROMISE;
  } else {
    state.pending_action = null;
  }

  state.loop_detected = state.unresolved_promises >= 2
    || (state.unresolved_promises >= 1 && state.follow_ups_since_promise >= 1);
  return state;
}

/**
 * @param {Array<{role: string, content: string, created_at?: string}>} messages em ordem cronológica
 * @param {{ humanHandoff?: boolean }} options
 */
export function deriveAttendanceState(messages = [], { humanHandoff = false } = {}) {
  const state = createEmptyAttendanceState();
  state.human_handoff = Boolean(humanHandoff);

  for (const message of messages || []) {
    if (!message || typeof message.content !== "string") continue;

    if (message.role === "user") {
      const analysis = analyzeUserMessage(message.content, { serviceType: state.service_type, sentAt: message.created_at });

      if (analysis.service && analysis.service !== state.service_type) {
        const switchingAway = state.service_type !== SERVICE_TYPE.UNKNOWN;
        state.service_type = analysis.service;
        if (switchingAway) {
          // Mudança explícita de assunto: dados do serviço anterior não valem mais.
          Object.assign(state, {
            piercing_type: null, piercing_location: null, jewelry_material: null,
            price_requested: false, price_informed: false,
            availability_requested: false, availability_resolved: false,
            unresolved_promises: 0, follow_ups_since_promise: 0
          });
        }
      }

      if (analysis.piercingType && state.service_type !== SERVICE_TYPE.TATTOO) {
        state.piercing_type = analysis.piercingType;
        if (state.service_type === SERVICE_TYPE.UNKNOWN) state.service_type = SERVICE_TYPE.PIERCING;
      }
      if (analysis.location && state.service_type === SERVICE_TYPE.PIERCING) state.piercing_location = analysis.location;
      if (analysis.material && state.service_type !== SERVICE_TYPE.TATTOO) state.jewelry_material = analysis.material;
      if (analysis.requestedDate) state.requested_date = analysis.requestedDate;
      if (analysis.requestedPeriod) state.requested_period = analysis.requestedPeriod;
      if (analysis.asksPrice) state.price_requested = true;
      if (analysis.asksAvailability) {
        state.availability_requested = true;
        state.availability_resolved = false;
      }
      if (analysis.isFollowUp && state.unresolved_promises > 0) state.follow_ups_since_promise += 1;

      state.current = {
        asksPrice: analysis.asksPrice,
        asksAvailability: analysis.asksAvailability,
        isFollowUp: analysis.isFollowUp,
        mentionsMaterial: Boolean(analysis.material),
        mentionsPiercingType: Boolean(analysis.piercingType),
        switchedService: Boolean(analysis.service)
      };
      continue;
    }

    if (message.role === "assistant") {
      const text = normalizeText(message.content);
      let resolved = false;
      const informedOffTablePrice = state.piercing_type && !isPricedPiercingType(state.piercing_type) && /r\$ ?\d/u.test(text);
      if (state.service_type === SERVICE_TYPE.PIERCING && (assistantInformedPiercingPrice(text) || informedOffTablePrice)) {
        state.price_informed = true;
        resolved = true;
      }
      if (state.availability_requested && resolvesAvailability(text) && !PROMISE_PATTERN.test(text)) {
        state.availability_resolved = true;
        resolved = true;
      }
      if (resolved) {
        state.unresolved_promises = 0;
        state.follow_ups_since_promise = 0;
      }
      if (PROMISE_PATTERN.test(text)) state.unresolved_promises += 1;
    }
  }

  return finalize(state);
}

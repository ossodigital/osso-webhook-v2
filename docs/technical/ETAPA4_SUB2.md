# ETAPA 4 - SUBETAPA 2

Data: 2026-06-07

Objetivo:
- mapear regras de handoff humano antes da extracao;
- nao alterar comportamento;
- nao alterar IA, Supabase, Dashboard ou WhatsApp;
- nao executar extracao nesta rodada.

Observacao importante:
- `modules/handoff/` ainda nao foi criado nesta subetapa;
- este documento e o mapa preparatorio solicitado antes da extracao.

## 1. Onde o handoff esta hoje

### `modules/stages/stageDetector.js`

Responsabilidade atual:
- detectar quando uma mensagem deve virar stage `humano`.

Regra atual:
- `detectarStage(userText, existingStage)` retorna `humano` quando identifica intencao de fechamento, pagamento, reserva ou pedido de humano/Coringa.

Gatilhos atuais:
- `quero reservar`
- `reservar horario`
- `reservar tattoo`
- `quero marcar`
- `marcar tattoo`
- `marcar tatuagem`
- `quero agendar`
- `pode agendar`
- `quero fechar`
- `fechar agora`
- `vamos fechar`
- `vou pagar`
- `manda pix`
- `manda o pix`
- `atendimento humano`
- `falar com humano`
- `falar com coringa`
- `chama o coringa`

Leitura tecnica:
- o handoff nasce como stage;
- nao existe ainda um modulo separado de handoff;
- `stageDetector` mistura classificacao comercial com gatilho operacional de humano.

### `api/meta.js`

O handoff operacional esta em tres pontos principais.

#### Ponto 1: humano ja ativo

Regra:
- se `existingLead?.stage === "humano"`, a IA e bloqueada.

Fluxo:
- extrai texto basico com `extrairTextoBasicoMensagem(msg)`;
- salva mensagem do usuario com `inserirMensagem()`;
- atualiza lead com `atualizarLeadPorTelefone()`;
- registra log `ATENDIMENTO HUMANO ATIVO — IA BLOQUEADA`;
- retorna `handoff_humano`;
- nao chama OpenAI;
- nao envia resposta automatica ao cliente.

#### Ponto 2: nova mensagem vira humano

Regra:
- depois da IA gerar uma resposta, o controller calcula `newStage = detectarStage(userText, stage)`;
- se `newStage === "humano"`, a resposta da IA e substituida por resposta fixa de encaminhamento ao Coringa.

Resposta fixa:
- `Perfeito, ${leadName}!`
- `Vou encaminhar seu atendimento direto pro Coringa finalizar certinho com voce.`

#### Ponto 3: alerta admin

Regra:
- se `newStage === "humano"` e `existingLead?.stage !== "humano"`, chama `alertarAdminLeadHumano()`.

Objetivo:
- avisar administradores apenas quando o lead entra em humano pela primeira vez naquele fluxo.

## 2. Quais dependencias possui

### Dependencias de stage

O handoff depende de:
- `detectarStage(userText, existingStage)`;
- valor de stage atual salvo no lead;
- valor `humano`.

Pontos criticos:
- `existingLead?.stage === "humano"` bloqueia IA;
- `newStage === "humano"` sobrescreve resposta da IA;
- `existingLead?.stage !== "humano"` evita alerta duplicado.

### Dependencias de Supabase

O handoff depende dos repositories:

- `buscarLeadPorTelefone(phone)`
  - necessario para saber se o lead ja esta em `humano`.

- `inserirMensagem(messagePayload)`
  - usado para registrar mensagem recebida durante atendimento humano;
  - usado para salvar resposta final da assistente quando ha transicao.

- `atualizarLeadPorTelefone(phone, updatePayload)`
  - usado para atualizar `last_message`;
  - usado para persistir `stage: "humano"`;
  - usado para atualizar `updated_at`.

Observacao:
- a logica de handoff nao deve executar Supabase diretamente em uma primeira extracao segura;
- o modulo pode retornar decisoes e payloads, mantendo `api/meta.js` como executor.

### Dependencias de WhatsApp

O handoff depende de:
- `enviarWhatsApp(phone, reply)` para enviar a resposta fixa ao cliente;
- `enviarWhatsApp(adminPhone, mensagemAdmin)` dentro de `alertarAdminLeadHumano()`.

Pontos criticos:
- o ramo `existingLead?.stage === "humano"` nao envia WhatsApp;
- a transicao para humano envia resposta final ao cliente;
- o alerta admin usa o mesmo client WhatsApp.

### Dependencias de admin config

O alerta depende de:
- `env.ADMIN_PHONES`;
- fallback `env.ADMIN_PHONE`;
- split por virgula;
- trim;
- filtro de vazios.

Funcao atual:
- `getAdminPhones()`.

### Dependencias de IA

O handoff atual se relaciona com IA, mas nao depende dela para decidir.

Pontos:
- quando lead ja esta em `humano`, a IA e bloqueada antes de chamar OpenAI;
- quando a mensagem atual vira `humano`, a IA ainda e chamada antes do `newStage`;
- depois, a resposta da IA e sobrescrita pela resposta fixa.

Importante:
- isso e comportamento atual;
- nao deve ser alterado na extracao sem decisao explicita.

## 3. O que pode ser extraido sem risco

### Baixo risco: `extrairTextoBasicoMensagem(msg)`

Motivo:
- funcao pura;
- nao chama Supabase;
- nao chama WhatsApp;
- nao chama IA;
- nao altera stage;
- apenas transforma mensagem Meta em texto basico quando atendimento humano ja esta ativo.

Destino recomendado:
- `modules/handoff/handoffRules.js`
- ou `modules/handoff/humanMessage.js`

Assinatura recomendada:
- `extrairTextoBasicoMensagem(msg)`

Comportamento a preservar:
- texto normal: `msg.text.body.trim()`;
- audio: `audio recebido durante atendimento humano`;
- imagem: `imagem recebida durante atendimento humano`;
- fallback: `mensagem recebida durante atendimento humano`.

### Baixo a medio risco: decisao de humano ativo

Regra extraivel:
- `leadEstaEmAtendimentoHumano(existingLead)`

Retorno esperado:
- booleano.

Comportamento:
- retornar `true` apenas quando `existingLead?.stage === "humano"`.

Motivo:
- regra simples;
- nao executa efeito colateral.

Risco:
- se a regra mudar, a IA pode responder durante atendimento humano.

### Medio risco: decisao de transicao para humano

Regra extraivel:
- `deveEntrarEmHandoff(newStage)`

Retorno esperado:
- booleano quando `newStage === "humano"`.

Motivo:
- regra simples;
- mas influencia resposta final e alerta admin.

Risco:
- se errar, pode deixar de encaminhar lead quente.

### Medio risco: decisao de alerta admin

Regra extraivel:
- `deveAlertarAdminHandoff(newStage, existingLead)`

Retorno esperado:
- `true` quando `newStage === "humano"` e `existingLead?.stage !== "humano"`.

Motivo:
- preserva a condicao anti-duplicidade.

Risco:
- alerta duplicado ou ausencia de alerta.

### Nao extrair ainda: execucao do handoff

Nao extrair nesta primeira rodada:
- inserts no Supabase;
- updates no Supabase;
- envio de WhatsApp;
- chamada de `alertarAdminLeadHumano()`;
- mudanca no `stageDetector`.

Motivo:
- esses sao efeitos colaterais;
- devem continuar no controller ate as regras puras estarem validadas.

## 4. Impacto comercial

### Mais seguranca operacional

Separar handoff reduz o risco de IA continuar vendendo quando o cliente ja quer humano.

Impacto:
- melhora confianca do cliente final;
- reduz perda de lead quente;
- protege atendimento humano do Coringa/admin.

### Base para takeover manual

Hoje o takeover e apenas stage `humano`.

Com regras isoladas, fica mais facil evoluir para:
- botao de assumir atendimento no dashboard;
- liberacao manual da IA;
- historico claro de quem assumiu;
- motivos de handoff.

### Base para SaaS multiempresa

Handoff isolado permite configurar por cliente:
- quando chamar humano;
- quais admins recebem alerta;
- qual texto enviar ao cliente;
- quais stages bloqueiam IA;
- qual equipe assume o atendimento.

### Melhor funil comercial

O handoff e o ponto onde lead vira oportunidade humana.

Separar essa regra permite medir:
- quantos leads chegaram em humano;
- quantos vieram por pagamento;
- quantos vieram por agendamento;
- quantos pediram humano diretamente.

## 5. Riscos da migracao

### Risco alto: IA responder em atendimento humano ativo

Causa:
- alterar a regra `existingLead?.stage === "humano"`.

Mitigacao:
- extrair regra pura com mesmo retorno;
- manter retorno antecipado em `api/meta.js`;
- nao mover efeitos colaterais inicialmente.

### Risco alto: alerta admin duplicado

Causa:
- perder a condicao `existingLead?.stage !== "humano"`.

Mitigacao:
- criar regra pura `deveAlertarAdminHandoff(newStage, existingLead)`;
- preservar exatamente a condicao atual.

### Risco alto: alerta admin nao enviado

Causa:
- separar transicao para humano de forma errada.

Mitigacao:
- manter chamada a `alertarAdminLeadHumano()` no controller na primeira extracao;
- apenas mover decisao booleana.

### Risco medio: mudar resposta final de handoff

Causa:
- mover texto fixo para modulo e alterar texto acidentalmente.

Mitigacao:
- primeiro manter texto no `api/meta.js`;
- se extrair depois, copiar texto literalmente.

### Risco medio: mexer em `stageDetector`

Causa:
- tentar separar handoff alterando gatilhos de `humano`.

Mitigacao:
- nao alterar `modules/stages/stageDetector.js` nesta subetapa;
- consumir apenas `newStage === "humano"`.

### Risco medio: mudar comportamento atual da IA

Causa:
- antecipar o bloqueio de IA quando a mensagem atual ja indica humano.

Contexto:
- hoje a IA ainda e chamada antes do `newStage`;
- depois a resposta e sobrescrita.

Mitigacao:
- preservar essa ordem na primeira extracao;
- qualquer otimizacao de custo deve ser etapa futura separada.

## 6. Ordem recomendada para extracao futura

### Passo 1: criar `modules/handoff/`

Arquivos possiveis:
- `modules/handoff/handoffRules.js`

Sem mover efeitos colaterais.

### Passo 2: extrair funcoes puras

Funcoes:
- `extrairTextoBasicoMensagem(msg)`
- `leadEstaEmAtendimentoHumano(existingLead)`
- `deveEntrarEmHandoff(newStage)`
- `deveAlertarAdminHandoff(newStage, existingLead)`

### Passo 3: trocar chamadas no controller

`api/meta.js` continua executando:
- `inserirMensagem()`;
- `atualizarLeadPorTelefone()`;
- `alertarAdminLeadHumano()`;
- `enviarWhatsApp()`;
- resposta HTTP.

### Passo 4: validar sintaxe

Comandos:
- `node --check api/meta.js`
- `node --check modules/handoff/handoffRules.js`

### Passo 5: documentar subetapa executada

Relatorio futuro:
- funcoes migradas;
- linhas removidas;
- riscos;
- confirmacao de comportamento preservado.

## 7. Resumo executivo

O handoff hoje esta dividido entre:
- `stageDetector`, que transforma intencao de fechamento em stage `humano`;
- `api/meta.js`, que bloqueia IA, registra mensagens humanas, sobrescreve resposta, atualiza lead e alerta admin.

O que pode ser extraido com menor risco:
- `extrairTextoBasicoMensagem(msg)`;
- regras booleanas de humano ativo, entrada em handoff e alerta admin.

O que nao deve ser extraido ainda:
- execucao Supabase;
- envio WhatsApp;
- alteracao de `stageDetector`;
- alteracao na ordem da chamada de IA.

Decisao recomendada:
- primeiro criar modulo de handoff com funcoes puras;
- deixar `api/meta.js` como executor dos efeitos colaterais;
- preservar exatamente o comportamento atual.

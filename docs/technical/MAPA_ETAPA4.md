# MAPA ETAPA 4

Data: 2026-06-06

Objetivo:
- preparar a Etapa 4 sem alterar codigo;
- mapear regras de qualification, handoff, takeover humano e admin alerts;
- indicar dependencias, duplicacoes, ordem segura de extracao e riscos.

Fontes analisadas:
- `docs/technical/MAPA_ATUAL_V2.md`
- `docs/technical/INVENTARIO_MODULOS.md`
- `docs/technical/PLANO_MIGRACAO.md`
- `docs/technical/RESUMO_EXECUTIVO.md`
- `api/meta.js`
- `modules/stages/stageDetector.js`

## 1. Funcoes e regras de handoff existentes

### Gatilhos de handoff por texto

Onde esta hoje:
- `modules/stages/stageDetector.js`

Regra:
- `detectarStage(userText, existingStage)` retorna `humano` quando o texto contem intencao clara de fechamento, pagamento, reserva ou atendimento humano.

Gatilhos observados:
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

Dependencias:
- depende apenas de texto e `existingStage`;
- nao depende de Supabase;
- nao depende de WhatsApp;
- nao depende de IA.

Observacao:
- a decisao inicial de handoff esta acoplada ao conceito de stage, porque o handoff e representado pelo stage `humano`.

### Handoff quando lead ja esta em humano

Onde esta hoje:
- `api/meta.js`

Regra:
- se `existingLead?.stage === "humano"`, a IA nao responde.

Fluxo atual:
- extrai texto basico com `extrairTextoBasicoMensagem(msg)`;
- insere mensagem do usuario via `inserirMensagem()`;
- atualiza lead via `atualizarLeadPorTelefone()`;
- registra log `ATENDIMENTO HUMANO ATIVO — IA BLOQUEADA`;
- retorna HTTP `200` com texto `handoff_humano`.

Dependencias:
- depende de Supabase repositories:
  - `buscarLeadPorTelefone()`
  - `inserirMensagem()`
  - `atualizarLeadPorTelefone()`
- nao depende de WhatsApp para responder ao cliente;
- depende do stage salvo no lead.

### Handoff quando nova mensagem vira humano

Onde esta hoje:
- `api/meta.js`
- `modules/stages/stageDetector.js`

Regra:
- `api/meta.js` calcula `newStage = detectarStage(userText, stage)`;
- se `newStage === "humano"`, sobrescreve a resposta da IA com texto fixo de encaminhamento ao Coringa;
- atualiza lead com `stage: "humano"`;
- se o lead ainda nao estava em humano, chama `alertarAdminLeadHumano()`.

Dependencias:
- depende de `detectarStage()`;
- depende de Supabase para atualizar lead e salvar mensagem da assistente;
- depende de WhatsApp para enviar a resposta final;
- depende de WhatsApp para alertar admin.

## 2. Funcoes e regras de takeover humano

### Takeover passivo por stage `humano`

Onde esta hoje:
- `api/meta.js`

Regra:
- `existingLead?.stage === "humano"` e o mecanismo de takeover atual.
- Enquanto o lead esta em `humano`, toda mensagem recebida e registrada, mas a IA e bloqueada.

Comportamento:
- nao existe endpoint dedicado de takeover manual;
- nao existe botao/controlador de takeover documentado no backend;
- o takeover atual e inferido pelo stage persistido no lead.

Dependencias:
- depende do Supabase para ler `existingLead.stage`;
- depende do Supabase para registrar mensagens recebidas durante humano;
- nao depende de WhatsApp para responder ao cliente nesse ramo;
- nao depende da IA.

### Takeover ativo por intencao do cliente

Onde esta hoje:
- `modules/stages/stageDetector.js`
- `api/meta.js`

Regra:
- quando o cliente pede humano/Coringa ou demonstra fechamento, `detectarStage()` retorna `humano`;
- `api/meta.js` aplica a resposta fixa e alerta admin.

Dependencias:
- depende de stageDetector;
- depende de Supabase;
- depende de WhatsApp para resposta final e alerta.

## 3. Funcoes de captura de nome

### `extrairNome(userText = "")`

Onde esta hoje:
- `api/meta.js`

Responsabilidade:
- tentar extrair nome do texto do usuario.

Regras:
- aceita padroes como:
  - `meu nome e`
  - `me chamo`
  - `sou o`
  - `sou a`
  - `pode me chamar de`
  - `me chama de`
- remove pontuacao simples apos o nome;
- rejeita palavras invalidas como saudacoes, preco, orcamento, tattoo, agendar etc.;
- aceita texto curto entre 2 e 40 caracteres com letras, espacos, apostrofo e hifen.

Dependencias:
- nao depende de stageDetector diretamente;
- nao depende de Supabase;
- nao depende de WhatsApp.

### Captura quando lead esta em `captando_nome`

Onde esta hoje:
- `api/meta.js`

Regra:
- se nao existe `leadName` e `existingLead?.stage === "captando_nome"`, chama `extrairNome(userText)`;
- se capturar nome, define `leadName`;
- recalcula stage com `detectarStage(userText, "novo")`.

Dependencias:
- depende de Supabase indiretamente, porque precisa de `existingLead.stage`;
- depende de stageDetector para recalcular stage apos capturar nome.

### Pedido de nome quando lead nao tem nome

Onde esta hoje:
- `api/meta.js`

Regra:
- se `!leadName`, define `leadPayload.stage = "captando_nome"`;
- salva lead e mensagem do usuario;
- salva mensagem da assistente com resposta fixa;
- envia WhatsApp com resposta fixa;
- retorna `ok` antes de chamar a IA.

Resposta fixa:
- `Claro! Antes de continuar, como posso te chamar? 😊`

Dependencias:
- depende de Supabase:
  - `upsertLead()`
  - `inserirMensagem()`
- depende de WhatsApp:
  - `enviarWhatsApp()`
- bloqueia chamada da IA enquanto nao ha nome.

## 4. Funcoes de qualificacao de lead

### Qualificacao basica por nome

Onde esta hoje:
- `api/meta.js`

Regra:
- nome e obrigatorio antes da conversa com IA continuar;
- enquanto nao ha nome, o stage vira `captando_nome`;
- a IA nao e chamada.

Dependencias:
- depende de `leadName`;
- depende de Supabase para persistir lead/mensagens;
- depende de WhatsApp para perguntar nome.

### Qualificacao por stage

Onde esta hoje:
- `modules/stages/stageDetector.js`
- `api/meta.js`

Regra:
- `detectarStage(userText, existingLead?.stage)` classifica lead em:
  - `curioso`
  - `humano`
  - `quente`
  - `agendamento`
  - `orcamento`
  - `novo` ou stage existente

Dependencias:
- stageDetector nao depende de Supabase;
- `api/meta.js` depende de Supabase para salvar o stage no lead.

### Reset de follow-up quando lead responde

Onde esta hoje:
- `api/meta.js`

Regra:
- se `existingLead.stage` esta em `followup_1`, `followup_2` ou `encerrado`, zera:
  - `followup_count`
  - `last_followup_at`

Ocorre em dois payloads:
- `leadPayload`, antes do upsert;
- `updatePayload`, antes do update final.

Dependencias:
- depende do stage vindo do Supabase;
- depende dos repositories de lead para persistir.

Observacao:
- embora nao seja handoff, e regra de qualificacao/funil e precisa ser preservada durante a Etapa 4.

## 5. Alertas enviados ao administrador

### `getAdminPhones()`

Onde esta hoje:
- `api/meta.js`

Responsabilidade:
- ler `env.ADMIN_PHONES` ou `env.ADMIN_PHONE`;
- separar multiplos telefones por virgula;
- remover espacos;
- filtrar valores vazios.

Dependencias:
- depende de `config/env.js`;
- nao depende de Supabase;
- nao depende de stageDetector;
- nao envia WhatsApp diretamente.

### `alertarAdminLeadHumano({ leadName, phone, userText, stage })`

Onde esta hoje:
- `api/meta.js`

Responsabilidade:
- avisar administradores quando lead entra em `humano`.

Mensagem enviada:
- titulo `LEAD PRONTO PRA FECHAR`;
- nome do lead;
- telefone;
- mensagem;
- stage;
- instrucao para assumir atendimento manualmente.

Dependencias:
- depende de `getAdminPhones()`;
- depende de `enviarWhatsApp()` de `services/meta/whatsapp.js`;
- nao depende diretamente de Supabase;
- depende do fluxo de handoff para ser chamada.

### Debug `admin-test`

Onde esta hoje:
- `api/meta.js`

Responsabilidade:
- enviar mensagem de teste para admins configurados.

Dependencias:
- depende de `validarDashboardToken(req)`;
- depende de `getAdminPhones()`;
- depende de `enviarWhatsApp()`.

Observacao:
- nao e handoff, mas usa a mesma infraestrutura de admin phones e WhatsApp.

## 6. Regras que bloqueiam a IA

### Bloqueio por atendimento humano ativo

Onde esta hoje:
- `api/meta.js`

Regra:
- se `existingLead?.stage === "humano"`, retorna antes de montar `userContent`, antes de chamar IA e antes de enviar resposta automatica.

Dependencias:
- depende de Supabase para carregar lead;
- depende de messages repository para salvar mensagem do usuario;
- nao depende de WhatsApp;
- nao depende de OpenAI.

### Bloqueio por ausencia de nome

Onde esta hoje:
- `api/meta.js`

Regra:
- se `!leadName`, pergunta o nome e retorna antes de carregar memoria e chamar IA.

Dependencias:
- depende de Supabase para salvar lead e mensagens;
- depende de WhatsApp para enviar a pergunta de nome;
- nao depende de stageDetector para bloquear, mas pode ter definido stage `captando_nome`.

### Bloqueio indireto por novo handoff

Onde esta hoje:
- `api/meta.js`

Regra:
- a IA ainda e chamada antes do `newStage`;
- depois, se `newStage === "humano"`, a resposta da IA e sobrescrita por resposta fixa de handoff.

Dependencias:
- depende de stageDetector;
- depende de WhatsApp para enviar resposta final;
- depende de Supabase para atualizar stage.

Risco:
- nao bloqueia a chamada de IA antes do handoff quando o texto atual ja indica `humano`;
- apenas bloqueia a resposta final automatica da IA.
- Isso e comportamento atual e nao deve ser mudado sem decisao explicita.

## 7. Regras duplicadas ou sobrepostas

### Handoff duplicado entre stage e controller

Locais:
- `modules/stages/stageDetector.js`
- `api/meta.js`

Duplicacao/sobreposicao:
- `stageDetector` decide que o stage e `humano`;
- `api/meta.js` interpreta `humano` como handoff, bloqueio futuro de IA, resposta fixa e alerta admin.

Risco:
- mudar os gatilhos de `humano` altera handoff automaticamente.

### Handoff no prompt vs handoff no codigo

Locais:
- `services/ai/prompts.js`
- `api/meta.js`
- `modules/stages/stageDetector.js`

Duplicacao/sobreposicao:
- prompt instrui a IA a encaminhar para Coringa quando cliente quer fechar;
- stageDetector tambem detecta intencao de fechamento como `humano`;
- `api/meta.js` sobrescreve a resposta se `newStage === "humano"`.

Risco:
- a IA pode formular handoff, mas o codigo pode substituir por resposta fixa.
- A resposta fixa do codigo prevalece quando `newStage === "humano"`.

### Captura de nome vs stage `captando_nome`

Locais:
- `api/meta.js`

Duplicacao/sobreposicao:
- `leadPayload.stage = "captando_nome"` quando nao ha nome;
- tambem ha logica separada para tentar capturar nome se `existingLead.stage === "captando_nome"`.

Risco:
- se a extracao separar mal captura e persistencia, lead pode ficar preso em `captando_nome` ou pedir nome repetidamente.

### Reset de follow-up duplicado em dois payloads

Locais:
- `api/meta.js`

Duplicacao:
- reset aparece antes do `upsertLead(leadPayload)`;
- reset aparece antes do `atualizarLeadPorTelefone(phone, updatePayload)`.

Risco:
- remover uma ocorrencia sem entender o fluxo pode mudar comportamento de follow-up.

## 8. Dependencias por regra

### Dependem de `stageDetector`

- gatilhos de handoff para `humano`;
- classificacao de `quente`, `agendamento`, `orcamento`, `curioso`;
- recalculo de stage apos capturar nome;
- `newStage` antes da resposta final;
- decisao de sobrescrever resposta com handoff quando `newStage === "humano"`.

### Dependem de Supabase

- carregar `existingLead`;
- verificar `existingLead.stage === "humano"`;
- saber se lead esta em `captando_nome`;
- saber nome existente;
- salvar lead com `stage`;
- salvar mensagens de usuario;
- salvar mensagens da assistente;
- atualizar `last_message`;
- resetar follow-up;
- persistir stage `humano`.

### Dependem de WhatsApp

- pergunta de nome;
- resposta final da assistente;
- alerta admin;
- debug `admin-test`.

### Dependem de IA

- nenhum bloqueio de IA depende da IA;
- prompt contem instrucao de handoff, mas a decisao operacional de handoff nao deve depender da IA.

## 9. Ordem mais segura para extracao

### Passo 1: extrair captura de nome pura

Destino sugerido:
- `modules/qualification/nameCapture.js`

Mover primeiro:
- `extrairNome(userText)`

Motivo:
- funcao pura;
- nao depende de Supabase;
- nao depende de WhatsApp;
- menor risco.

Cuidados:
- preservar lista de palavras invalidas;
- preservar regex e limites de tamanho.

### Passo 2: extrair helper de mensagem humana

Destino sugerido:
- `modules/handoff/humanMessage.js`

Mover:
- `extrairTextoBasicoMensagem(msg)`

Motivo:
- funcao pura;
- nao depende de Supabase;
- nao depende de WhatsApp;
- usada apenas no ramo de humano ativo.

Cuidados:
- preservar textos para audio/imagem/mensagem generica.

### Passo 3: extrair admin phones

Destino sugerido:
- `modules/adminAlerts/adminPhones.js`

Mover:
- `getAdminPhones()`

Motivo:
- leitura simples de env;
- nao envia nada;
- prepara admin alerts.

Cuidados:
- preservar fallback `ADMIN_PHONES || ADMIN_PHONE`;
- preservar split por virgula.

### Passo 4: extrair admin alert

Destino sugerido:
- `modules/adminAlerts/adminAlerts.js`

Mover:
- `alertarAdminLeadHumano()`

Motivo:
- ja depende de WhatsApp client extraido;
- nao depende diretamente de Supabase.

Cuidados:
- preservar mensagem enviada ao admin;
- preservar retorno por admin;
- preservar comportamento quando nenhum admin esta configurado.

### Passo 5: extrair regras de qualification

Destino sugerido:
- `modules/qualification/qualificationRules.js`

Mover:
- decisao `!leadName`;
- stage `captando_nome`;
- regra de tentar capturar nome quando `existingLead.stage === "captando_nome"`.

Motivo:
- ja tera `extrairNome()` isolado;
- prepara funil por nicho.

Cuidados:
- nao mudar ordem do upsert, insert de mensagem e envio WhatsApp;
- inicialmente retornar decisoes/payloads, nao executar Supabase nem WhatsApp dentro do modulo.

### Passo 6: extrair handoff rules

Destino sugerido:
- `modules/handoff/handoffRules.js`

Mover:
- verificacao de humano ativo;
- regra de bloqueio de IA;
- regra de transicao para humano;
- regra de alerta apenas quando `existingLead.stage !== "humano"`.

Motivo:
- maior risco;
- deve vir depois de helpers puros e admin alert.

Cuidados:
- preservar stage `humano`;
- preservar retorno `handoff_humano`;
- preservar que a IA nao responde quando lead ja estava em humano;
- preservar alerta apenas na transicao para humano.

## 10. Riscos da migracao

### Risco alto: IA responder durante atendimento humano

Causa possivel:
- extrair handoff ativo antes de preservar `existingLead.stage === "humano"`.

Mitigacao:
- manter esse bloqueio no controller ate o modulo estar validado;
- testar caminho humano ativo primeiro.

### Risco alto: alerta admin duplicado

Causa possivel:
- perder condicao `existingLead?.stage !== "humano"`.

Mitigacao:
- regra de alertar admin deve receber stage anterior e novo stage;
- alertar somente na transicao para `humano`.

### Risco medio: lead preso em `captando_nome`

Causa possivel:
- mover captura de nome sem preservar recalculo de stage apos nome capturado.

Mitigacao:
- preservar chamada equivalente a `detectarStage(userText, "novo")` apos nome capturado.

### Risco medio: pedir nome repetidamente

Causa possivel:
- nao preservar `existingLead?.name`;
- nao preservar `leadName = existingLead?.name || null`.

Mitigacao:
- qualification deve receber lead atual e texto, nao tentar decidir sem contexto.

### Risco medio: quebrar follow-up

Causa possivel:
- mover qualification e remover reset de `followup_count`/`last_followup_at`.

Mitigacao:
- manter reset no controller inicialmente;
- so extrair depois com teste especifico.

### Risco medio: alterar gatilhos de handoff

Causa possivel:
- mexer em `stageDetector` durante a Etapa 4.

Mitigacao:
- nao alterar `modules/stages/stageDetector.js` nesta etapa;
- modulo de handoff deve inicialmente consumir `newStage === "humano"`.

### Risco baixo: admin phones vazio

Causa possivel:
- alterar fallback `ADMIN_PHONES || ADMIN_PHONE`.

Mitigacao:
- preservar exatamente fallback, split, trim e filter.

## 11. Recomendacao final

A Etapa 4 deve ser dividida em subetapas pequenas:

1. Extrair funcoes puras:
   - `extrairNome()`
   - `extrairTextoBasicoMensagem()`

2. Extrair admin helpers:
   - `getAdminPhones()`
   - `alertarAdminLeadHumano()`

3. Extrair qualification rules sem executar efeitos colaterais:
   - captura de nome;
   - stage `captando_nome`;
   - decisao de pedir nome.

4. Extrair handoff rules por ultimo:
   - humano ativo;
   - transicao para humano;
   - bloqueio de IA;
   - alerta na transicao.

Principio:
- os novos modulos devem primeiro retornar decisoes;
- `api/meta.js` deve continuar executando Supabase e WhatsApp ate a regra estar validada;
- nao alterar `stageDetector` durante a primeira extracao da Etapa 4.

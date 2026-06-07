# ETAPA 4 - SUBETAPA 3

Data: 2026-06-07

Objetivo:
- analisar a ordem de extracao das regras de handoff;
- nao alterar codigo;
- nao criar `modules/handoff`;
- nao modificar `api/meta.js`, `stageDetector`, IA ou Supabase.

Fonte:
- `docs/technical/ETAPA4_SUB2.md`

## 1. Qual regra de handoff deve ser extraida primeiro

A primeira regra a extrair deve ser:

- `extrairTextoBasicoMensagem(msg)`

Motivo:
- e uma funcao pura;
- nao executa Supabase;
- nao envia WhatsApp;
- nao chama IA;
- nao altera stage;
- nao muda a decisao de handoff;
- apenas transforma mensagem recebida em texto basico quando o lead ja esta em atendimento humano.

Destino futuro recomendado:
- `modules/handoff/handoffRules.js`
- ou `modules/handoff/humanMessage.js`

Comportamento a preservar:
- texto: `msg.text.body.trim()`;
- audio: `audio recebido durante atendimento humano`;
- imagem: `imagem recebida durante atendimento humano`;
- fallback: `mensagem recebida durante atendimento humano`.

## 2. Qual regra possui menor risco

A regra de menor risco e:

- `extrairTextoBasicoMensagem(msg)`

Por que e a menor:
- nao decide se a IA deve responder;
- nao muda stage;
- nao altera alerta admin;
- nao muda resposta ao cliente;
- so padroniza conteudo para persistencia durante atendimento humano.

Segunda regra de menor risco:

- `leadEstaEmAtendimentoHumano(existingLead)`

Regra esperada:
- retornar `true` apenas quando `existingLead?.stage === "humano"`.

Observacao:
- apesar de simples, essa segunda regra ja participa do bloqueio da IA, entao tem risco maior que `extrairTextoBasicoMensagem`.

## 3. Qual regra pode quebrar atendimento humano

A regra mais perigosa e:

- `leadEstaEmAtendimentoHumano(existingLead)`

Motivo:
- ela controla o bloqueio da IA quando o atendimento humano ja esta ativo.

Se quebrar:
- a IA pode responder durante atendimento humano;
- mensagens do cliente podem nao ser registradas corretamente;
- o fluxo pode deixar de retornar `handoff_humano`;
- o admin/Coringa pode perder controle do atendimento.

Outras regras sensiveis:

- `deveAlertarAdminHandoff(newStage, existingLead)`
  - se errar, pode duplicar alertas ou deixar de avisar admin.

- `deveEntrarEmHandoff(newStage)`
  - se errar, pode deixar de encaminhar lead pronto para fechamento.

- texto fixo de handoff
  - se alterado, muda a experiencia do cliente no momento mais comercial do fluxo.

## 4. Qual regra impede escalabilidade SaaS

A principal trava para SaaS e o handoff estar representado apenas como stage fixo `humano` dentro do fluxo do webhook.

Hoje:
- `stageDetector` decide `humano`;
- `api/meta.js` interpreta `humano` como bloqueio de IA;
- `api/meta.js` tambem decide resposta fixa;
- `api/meta.js` tambem decide alerta admin;
- admin phones ainda sao globais por env.

O que isso impede:
- configurar criterios de handoff por empresa;
- configurar equipes/admins por cliente;
- medir motivo do handoff;
- separar handoff comercial de takeover manual;
- criar regras diferentes por nicho;
- liberar ou bloquear IA por cliente;
- criar dashboard de takeover com seguranca.

Regra mais importante para SaaS:

- `deveAlertarAdminHandoff(newStage, existingLead)`

Motivo:
- no SaaS, alerta humano precisa ser configuravel por empresa, equipe e regra comercial.

Regra estrutural mais importante:

- `leadEstaEmAtendimentoHumano(existingLead)`

Motivo:
- e a base do takeover manual e do bloqueio de IA por empresa.

## 5. Qual ordem ideal de extracao

### 1. Extrair texto basico de mensagem humana

Funcao:
- `extrairTextoBasicoMensagem(msg)`

Risco:
- baixo.

Por que primeiro:
- funcao pura;
- sem efeitos colaterais;
- reduz `api/meta.js` sem mudar decisao operacional.

### 2. Extrair regra de humano ativo

Funcao:
- `leadEstaEmAtendimentoHumano(existingLead)`

Risco:
- medio.

Por que segundo:
- regra simples;
- mas deve ser validada com cuidado porque bloqueia IA.

### 3. Extrair regra de entrada em handoff

Funcao:
- `deveEntrarEmHandoff(newStage)`

Risco:
- medio.

Por que terceiro:
- depende apenas de `newStage`;
- preserva `newStage === "humano"`;
- prepara futura separacao entre stage e handoff.

### 4. Extrair regra de alerta admin

Funcao:
- `deveAlertarAdminHandoff(newStage, existingLead)`

Risco:
- medio a alto.

Por que quarto:
- precisa preservar anti-duplicidade;
- deve continuar alertando apenas quando entra em `humano`.

### 5. Extrair texto fixo de handoff

Funcao futura possivel:
- `montarMensagemHandoffCliente(leadName)`

Risco:
- medio.

Por que depois:
- muda superficie visivel ao cliente se houver qualquer diferenca;
- melhor deixar para depois das regras booleanas.

### 6. Extrair execucao de handoff

Funcao futura possivel:
- `processarHandoffHumano(...)`

Risco:
- alto.

Por que por ultimo:
- envolve Supabase;
- envolve WhatsApp;
- envolve resposta HTTP;
- envolve alerta admin;
- envolve bloqueio real da IA.

## 6. Quais funcoes devem ir para `modules/handoff`

Primeiro grupo, seguro:

- `extrairTextoBasicoMensagem(msg)`
- `leadEstaEmAtendimentoHumano(existingLead)`
- `deveEntrarEmHandoff(newStage)`
- `deveAlertarAdminHandoff(newStage, existingLead)`

Segundo grupo, depois de validar o primeiro:

- `montarMensagemHandoffCliente(leadName)`
- `montarMotivoHandoff(userText, newStage)` se o produto passar a medir motivo
- `normalizarStageHandoff(stage)` se futuramente houver mais de um stage humano

Nao devem ir agora:

- chamadas `inserirMensagem()`;
- chamadas `atualizarLeadPorTelefone()`;
- chamadas `enviarWhatsApp()`;
- chamada `alertarAdminLeadHumano()`;
- validacao HTTP;
- retorno `res.status(200).send("handoff_humano")`.

Principio:
- `modules/handoff` deve comecar como modulo de decisao;
- os efeitos colaterais devem continuar em `api/meta.js` ate uma etapa futura.

## 7. Quais funcoes devem permanecer em `api/meta.js`

Devem permanecer no controller nesta fase:

- handler HTTP principal;
- leitura da mensagem Meta;
- busca do lead com `buscarLeadPorTelefone(phone)`;
- insert da mensagem recebida durante humano com `inserirMensagem()`;
- update do lead com `atualizarLeadPorTelefone()`;
- retorno `handoff_humano`;
- chamada de `detectarStage()`;
- sobrescrita da resposta quando `newStage === "humano"`;
- chamada `alertarAdminLeadHumano()`;
- envio da resposta final com `enviarWhatsApp()`;
- logs operacionais.

Devem permanecer porque:
- executam efeitos colaterais;
- dependem de `res`;
- dependem de Supabase;
- dependem de WhatsApp;
- afetam diretamente atendimento humano real.

Tambem deve permanecer por enquanto:

- `alertarAdminLeadHumano()`

Motivo:
- embora seja candidato a modulo proprio, depende de `getAdminPhones()` e `enviarWhatsApp()`;
- e melhor extrair admin alerts em subetapa separada.

## Resumo executivo

Primeira regra a extrair:
- `extrairTextoBasicoMensagem(msg)`.

Menor risco:
- `extrairTextoBasicoMensagem(msg)`.

Maior risco para atendimento humano:
- `leadEstaEmAtendimentoHumano(existingLead)`.

Maior trava SaaS:
- handoff acoplado ao stage fixo `humano`, admin global por env e efeitos colaterais dentro de `api/meta.js`.

Ordem ideal:
1. `extrairTextoBasicoMensagem(msg)`
2. `leadEstaEmAtendimentoHumano(existingLead)`
3. `deveEntrarEmHandoff(newStage)`
4. `deveAlertarAdminHandoff(newStage, existingLead)`
5. `montarMensagemHandoffCliente(leadName)`
6. execucao completa de handoff apenas em etapa futura.

Decisao:
- criar `modules/handoff` somente na proxima execucao, com funcoes puras e sem mover Supabase, WhatsApp, IA ou `stageDetector`.

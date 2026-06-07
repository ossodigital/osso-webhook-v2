# ETAPA 4 - SUBETAPA 4

Data: 2026-06-07

Objetivo:
- executar a menor extracao possivel de handoff;
- preservar comportamento atual;
- nao alterar IA, Supabase, WhatsApp, Dashboard ou `stageDetector`.

## 1. O que foi extraido

Foi extraida somente a funcao pura:

- `extrairTextoBasicoMensagem(msg)`

Origem:
- `api/meta.js`

Destino:
- `modules/handoff/handoffRules.js`

Comportamento preservado:
- se `msg.text?.body`, retorna `msg.text.body.trim()`;
- se `msg.audio?.id`, retorna `audio recebido durante atendimento humano`;
- se `msg.image?.id`, retorna `imagem recebida durante atendimento humano`;
- caso contrario, retorna `mensagem recebida durante atendimento humano`.

Uso atual:
- continua sendo chamada apenas no ramo em que `existingLead?.stage === "humano"`;
- continua servindo para registrar mensagem recebida durante atendimento humano;
- nao altera a decisao de handoff.

## 2. Quantas linhas sairam de `api/meta.js`

Resultado do diff desta subetapa:

- 16 linhas removidas de `api/meta.js`;
- 1 linha adicionada de import em `api/meta.js`.

Remocao realizada:
- funcao local `extrairTextoBasicoMensagem(msg)`.

Nada foi removido de:
- Supabase;
- WhatsApp;
- IA;
- `stageDetector`;
- alerta admin;
- resposta fixa de handoff;
- logica de bloqueio da IA.

## 3. Validacoes executadas

Comandos executados:

- `node --check api/meta.js`
- `node --check modules/handoff/handoffRules.js`

Resultado:
- ambos passaram.

## 4. Impacto comercial

Esta extracao e pequena, mas importante para produto.

Ganhos:
- inicia a separacao de handoff da camada webhook;
- cria base para regras de takeover humano;
- prepara futuro painel de atendimento manual;
- reduz acoplamento entre recebimento de mensagem e logica de handoff;
- permite evoluir para metricas de mensagens recebidas durante humano.

Impacto SaaS:
- `modules/handoff/` passa a existir como destino de regras de atendimento humano;
- abre caminho para configurar bloqueio de IA por empresa;
- prepara futuras regras por equipe, admin ou nicho;
- ajuda a transformar o handoff de comportamento fixo em componente reutilizavel.

## 5. Riscos remanescentes

### Regra de humano ativo ainda esta no controller

Permanece em `api/meta.js`:
- `existingLead?.stage === "humano"`.

Risco:
- ainda e o ponto critico que bloqueia a IA durante atendimento humano.

### Transicao para humano ainda esta no controller

Permanece em `api/meta.js`:
- `newStage === "humano"`;
- sobrescrita da resposta;
- update do lead;
- alerta admin.

Risco:
- qualquer alteracao futura pode duplicar alerta ou deixar de alertar.

### `stageDetector` ainda decide handoff

Permanece em:
- `modules/stages/stageDetector.js`.

Risco:
- mudar gatilhos de `humano` muda handoff.

### Efeitos colaterais continuam no controller

Permanecem em `api/meta.js`:
- `inserirMensagem()`;
- `atualizarLeadPorTelefone()`;
- `alertarAdminLeadHumano()`;
- `enviarWhatsApp()`;
- retorno HTTP `handoff_humano`.

Risco:
- ainda nao existe isolamento completo do processo de handoff.

## 6. Proximo passo recomendado

Proxima extracao segura:

- `leadEstaEmAtendimentoHumano(existingLead)`

Cuidados:
- deve retornar `true` apenas quando `existingLead?.stage === "humano"`;
- nao deve mover Supabase;
- nao deve mover WhatsApp;
- nao deve alterar retorno `handoff_humano`;
- deve preservar o bloqueio da IA.

## 7. Status

Status da subetapa:
- pronta para commit.

Escopo preservado:
- IA nao alterada;
- Supabase nao alterado;
- WhatsApp nao alterado;
- Dashboard nao alterado;
- `stageDetector` nao alterado;
- comportamento operacional preservado.

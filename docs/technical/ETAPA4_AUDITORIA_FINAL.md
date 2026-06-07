# Auditoria Final da Etapa 4

Data: 2026-06-07

Escopo: auditoria tecnica apos as extracoes de qualificacao e da menor regra de handoff humano. Este documento nao altera codigo; apenas registra o estado atual da modularizacao.

## 1. O que ainda permanece em api/meta.js

`api/meta.js` ainda concentra a orquestracao principal do webhook:

- Entrada HTTP do webhook Meta, incluindo validacao `GET`, tratamento `POST`, leitura de `messages`, `contacts`, `phone` e corpo da mensagem.
- Rotas auxiliares de debug e dashboard, incluindo validacao por token em `validarDashboardToken(req)`.
- Leitura de administradores em `getAdminPhones()`.
- Envio de alertas administrativos em `alertarAdminLeadHumano(...)`.
- Execucao do fluxo de handoff humano:
  - deteccao de lead em `stage === "humano"`;
  - bloqueio da IA quando o atendimento humano esta ativo;
  - gravacao da mensagem recebida durante atendimento humano;
  - atualizacao de `last_message_at`;
  - resposta final `handoff_humano`.
- Transicao para atendimento humano quando `detectarStage(...)` retorna `humano`.
- Decisao de quando avisar o administrador sobre novo handoff humano.
- Orquestracao da captura de nome:
  - uso de `extrairNome(...)`;
  - estado `captando_nome`;
  - pergunta padrao solicitando nome;
  - persistencia do nome no lead.
- Chamadas ao `detectarStage(...)` antes e depois da IA.
- Reset de `follow_up_sent` quando o lead volta a interagir.
- Persistencia de mensagens e leads por meio dos repositories Supabase.
- Chamada ao WhatsApp via `enviarWhatsApp(...)`.
- Fluxo principal da IA:
  - leitura de historico;
  - montagem de prompt;
  - envio para OpenAI/Azure;
  - sanitizacao da resposta;
  - persistencia da resposta;
  - envio ao usuario.
- Funcoes locais de midia Meta:
  - `getMediaUrl(mediaId)`;
  - `downloadMedia(url)`.

Em resumo, `api/meta.js` ja deixou de conter boa parte dos detalhes internos, mas ainda e o controlador central de regras, efeitos externos e decisao de fluxo.

## 2. O que ja esta modularizado

Os seguintes blocos ja foram extraidos:

- `modules/stages/stageDetector.js`
  - Deteccao de stage do lead.
  - Regras de classificacao como `humano`, `quente`, `curioso` e demais estados comerciais.

- `modules/qualification/qualificationRules.js`
  - Captura de nome com `extrairNome(...)`.
  - Identificacao de lead quente.
  - Identificacao de curioso.

- `modules/handoff/handoffRules.js`
  - Extracao basica do texto recebido durante atendimento humano com `extrairTextoBasicoMensagem(...)`.

- `services/meta/whatsapp.js`
  - Client de envio WhatsApp/Meta com `enviarWhatsApp(phone, body)`.
  - Uso do endpoint Graph API v19.0 e variaveis globais de ambiente.

- `services/supabase/client.js`
  - Criacao centralizada do client Supabase.

- `services/supabase/leadsRepository.js`
  - Busca, listagem, criacao e atualizacao de leads.

- `services/supabase/messagesRepository.js`
  - Insercao e listagem de mensagens.
  - Busca de historico recente.

- `services/ai/prompts.js`
  - Montagem do prompt do sistema.
  - Sanitizacao de links da resposta.

- `services/ai/memory.js`
  - Carregamento e formatacao de historico de conversa.

- `services/ai/openai.js`
  - Geracao de resposta de atendimento.
  - Transcricao de audio.

- `services/ai/media.js`
  - Preparacao de conteudo de imagem para a IA.
  - Fallback de imagem de referencia.

## 3. O que ainda impede multiempresa

O sistema ainda nao esta pronto para multiempresa porque as configuracoes centrais continuam globais:

- Credenciais WhatsApp/Meta sao globais via `process.env.PHONE_NUMBER_ID` e `process.env.WHATSAPP_TOKEN`.
- Administradores sao globais via `ADMIN_WHATSAPP` ou `ADMIN_WHATSAPP_LIST`.
- Prompt, regras comerciais, handoff e stages nao sao parametrizados por empresa.
- Repositories Supabase nao recebem `company_id`, `tenant_id` ou outro escopo de isolamento.
- Leads e mensagens sao consultados sem filtro por empresa.
- Rotas de dashboard/debug nao possuem escopo por empresa.
- Nao existe modelo de configuracao por cliente, como horario de atendimento, canais, administradores, prompt, limites e plano.

Enquanto essas informacoes ficarem em variaveis globais ou regras fixas, cada nova empresa exigira duplicacao de ambiente, codigo ou deploy.

## 4. O que ainda impede onboarding automatico

O onboarding automatico ainda e bloqueado por ausencia de configuracao persistida e parametrizavel:

- Nao existe cadastro de empresa/tenant.
- Nao existe fluxo para registrar credenciais WhatsApp por cliente.
- Nao existe API ou tela para configurar administradores.
- O prompt da IA ainda e fixo, nao configuravel por nicho ou empresa.
- Nao ha modelo de templates iniciais por tipo de negocio.
- Nao ha validacao automatica de numero, token, phone number id e webhook.
- Nao ha provisionamento automatico de regras comerciais, stages, handoff e dashboard.
- Nao ha estado de onboarding, como `pendente`, `configurando`, `ativo` ou `bloqueado`.

Na pratica, a ativacao de um cliente ainda depende de ajuste manual de ambiente e conhecimento tecnico.

## 5. O que ainda impede planos SaaS

Os planos SaaS dependem de medicao, limites e permissoes que ainda nao existem:

- Nao existe entidade de plano.
- Nao existe billing ou integracao com cobranca.
- Nao existe medicao de uso por empresa.
- Nao ha contagem de mensagens por periodo.
- Nao ha controle de consumo de IA, tokens ou custo estimado.
- Nao ha limites por plano, como volume de leads, mensagens, usuarios ou atendimentos humanos.
- Nao ha feature flags para liberar recursos por plano.
- Nao ha selecao de modelo de IA por plano.
- Nao ha auditoria de eventos comerciais relevantes.
- Nao ha bloqueio automatico por inadimplencia, excesso de uso ou plano inativo.

Sem esses pontos, o sistema pode operar como automacao unica, mas ainda nao como produto SaaS com monetizacao escalavel.

## 6. O que ainda impede dashboard comercial

O dashboard comercial ainda e limitado porque a base exposta ao front parece mais operacional do que analitica:

- Nao ha endpoints consolidados de metricas comerciais.
- Nao ha funil por stage com historico de transicoes.
- Nao ha metricas de leads quentes, curiosos, aguardando nome e atendimento humano.
- Nao ha contagem de handoffs por periodo.
- Nao ha tempo medio ate resposta humana.
- Nao ha status claro de takeover humano para uso no dashboard.
- Nao ha agrupamento por empresa, plano, origem ou campanha.
- Nao ha indicadores de conversao.
- Nao ha filtros comerciais robustos por periodo, stage, canal ou atendente.
- Nao ha camada de analytics separada dos repositories operacionais.

Para um dashboard comercial SaaS, sera necessario criar uma camada propria de leitura, metricas e agregacoes, preferencialmente ja com escopo multiempresa.

## 7. Proximas 5 extracoes recomendadas por ordem de risco

1. Extrair `getAdminPhones()` para um modulo de configuracao de administradores.

   Risco: baixo.

   Motivo: e uma funcao pequena, praticamente pura, baseada em variaveis de ambiente. Ajuda a preparar o caminho para administradores por empresa sem alterar o comportamento atual.

2. Extrair regras puras de handoff para `modules/handoff/handoffRules.js`.

   Risco: baixo a medio.

   Candidatas:
   - verificar se o lead esta em atendimento humano;
   - decidir se a IA deve ser bloqueada;
   - decidir se uma transicao deve gerar alerta ao administrador.

   Motivo: essas decisoes ainda estao misturadas ao controlador. Separar apenas as condicoes, sem mover efeitos Supabase ou WhatsApp, reduz risco.

3. Extrair `alertarAdminLeadHumano(...)` para um modulo de alertas administrativos.

   Risco: medio.

   Motivo: a funcao tem efeito externo via WhatsApp. Deve ser extraida depois das regras puras para preservar a ordem atual de envio e evitar alertas duplicados.

4. Extrair midia Meta local para `services/meta/media.js`.

   Risco: medio.

   Candidatas:
   - `getMediaUrl(mediaId)`;
   - `downloadMedia(url)`.

   Motivo: ainda sao chamadas Graph API dentro de `api/meta.js`. A extracao melhora separacao entre webhook e client Meta, mas envolve binario, token e tratamento de erro.

5. Extrair fluxo de captura de nome para `modules/qualification/qualificationFlow.js`.

   Risco: medio a alto.

   Motivo: a regra de extracao do nome ja saiu, mas a orquestracao ainda altera stage, mensagem de resposta, persistencia e interrupcao do fluxo da IA. Deve ser feita depois das funcoes puras e com validacao cuidadosa para nao quebrar a primeira experiencia do lead.

## Conclusao

A Etapa 4 reduziu o acoplamento inicial das regras comerciais ao extrair qualificacao e uma regra segura de handoff. Mesmo assim, `api/meta.js` ainda e o centro de decisao do produto: recebe webhook, decide stage, bloqueia IA, grava dados, chama IA, envia WhatsApp e alerta administrador.

O proximo movimento mais seguro e continuar extraindo regras puras antes de mover efeitos externos. Depois disso, a prioridade para SaaS deve ser introduzir configuracao por empresa, isolamento por tenant e metricas comerciais.

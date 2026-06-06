# MAPA ATUAL V2

Data: 2026-06-06

Escopo analisado:
- `api/meta.js`
- `modules/`
- `services/`
- `docs/`

Este documento descreve a arquitetura atual observada no projeto `osso-webhook-v2`. Ele separa o que ja existe de fato do que esta apenas planejado na documentacao.

## 1. Modulos ja existentes

### `modules/stages/stageDetector.js`

Modulo real ja implementado.

Responsabilidade:
- classificar o lead com base no texto recebido;
- preservar stage anterior quando nenhuma regra nova for acionada;
- retornar stages como `novo`, `curioso`, `orcamento`, `quente`, `agendamento` e `humano`.

Status:
- em uso por `api/meta.js`;
- primeira extracao modular real ja feita;
- ainda depende de regras simples por palavras-chave e regex.

### Modulos planejados em `docs/MODULOS.md`

A documentacao lista modulos desejados, mas eles ainda nao existem como arquivos implementados:

- `modules/detectStage.js`
- `modules/handoffRules.js`
- `modules/qualification.js`
- `modules/leadMemory.js`
- `modules/imageAnalyzer.js`
- `modules/tattooAnalyzer.js`
- `modules/pricingRules.js`
- `modules/adminAlerts.js`
- `modules/promptBuilder.js`

Observacao:
- o modulo de stage existe, mas no caminho atual `modules/stages/stageDetector.js`, nao como `modules/detectStage.js`.

## 2. Funcao provavel de cada pasta

### `api/`

Pasta de endpoints serverless.

Arquivos observados:
- `api/meta.js`
- `api/followup.js`
- `api/test-supabase.js`

Funcao atual:
- receber webhooks da Meta/WhatsApp;
- responder verificacao GET da Meta;
- expor endpoints de debug protegidos por token;
- consultar leads e mensagens para o dashboard/debug;
- processar mensagens recebidas;
- chamar IA;
- enviar respostas via WhatsApp;
- registrar conversas no Supabase;
- executar follow-ups automaticos;
- testar conexao Supabase.

Estado arquitetural:
- `api/meta.js` ainda concentra orquestracao, regras de negocio, handoff, IA, midia, audio, envio WhatsApp e persistencia;
- `api/followup.js` tambem possui Supabase e WhatsApp acoplados diretamente via `process.env`;
- `api/test-supabase.js` e um endpoint simples de diagnostico.

### `modules/`

Pasta prevista para regras de dominio e inteligencia de negocio desacopladas da camada webhook.

Funcao atual:
- contem apenas a logica modular de stage em `modules/stages/stageDetector.js`.

Funcao provavel futura:
- centralizar classificacao de lead;
- regras de handoff;
- qualificacao de orcamento;
- memoria de lead;
- regras de preco;
- montagem de prompt;
- analise de tattoo/imagem.

### `services/`

Pasta prevista para integracoes e servicos externos.

Arquivos observados:
- `services/supabase/client.js`
- `services/ai/openai.js`
- `services/ai/prompts.js`
- `services/ai/memory.js`
- `services/ai/media.js`

Funcao atual:
- `services/supabase/client.js` cria e exporta o client Supabase usando `config/env.js`;
- os arquivos em `services/ai/` existem, mas estao vazios no estado atual.

Funcao provavel futura:
- encapsular chamadas Azure OpenAI;
- montar prompts;
- buscar memoria/conversa;
- processar imagem e audio;
- reduzir acoplamento entre webhook e IA.

### `docs/`

Pasta de documentacao tecnica, produto, negocio, roadmap e logs.

Funcao atual:
- registrar arquitetura desejada;
- registrar regras de negocio;
- documentar roadmap tecnico;
- registrar checkpoints e evolucao;
- separar visao business, comercial, engenharia, roadmap e technical.

Documentos relevantes encontrados:
- `docs/ARQUITETURA.md`
- `docs/MODULOS.md`
- `docs/REGRAS_NEGOCIO.md`
- `docs/CHECKPOINT_V2.md`
- `docs/engineering/CHECKPOINT_V2.md`
- `docs/technical/TECHNICAL_ROADMAP.md`
- `docs/roadmap/ACTION_PLAN.md`
- `docs/logs/ENGINEERING_LOG.md`

## 3. Onde esta a logica de stage

### Implementada em modulo

Arquivo:
- `modules/stages/stageDetector.js`

Funcao:
- `detectarStage(userText, existingStage)`

Regras atuais:
- palavras de brincadeira/golpe/calote levam a `curioso`;
- intencao clara de reservar, marcar, fechar, pagar ou falar com humano leva a `humano`;
- termos como pix, cartao, sinal, fechar e quero fazer levam a `quente`;
- termos de agenda levam a `agendamento`;
- termos de preco, valor, orcamento, tattoo e tatuagem levam a `orcamento`;
- se nada bater, retorna `existingStage` ou `novo`.

### Orquestrada em `api/meta.js`

`api/meta.js` importa:
- `detectarStage` de `../modules/stages/stageDetector.js`

Uso atual:
- calcula `stage` apos extrair `userText`;
- recalcula `stage` apos capturar nome;
- recalcula `newStage` depois da resposta de IA;
- usa `newStage === "humano"` para alterar resposta, atualizar lead e alertar admin.

## 4. Onde esta a logica de handoff

A logica de handoff ainda esta dividida entre `modules/stages/stageDetector.js`, `api/meta.js` e documentacao.

### Regras de gatilho

Arquivo:
- `modules/stages/stageDetector.js`

Quando detecta intencao clara de fechamento ou humano, retorna:
- `humano`

Exemplos de gatilho:
- reservar horario;
- quero marcar;
- quero agendar;
- quero fechar;
- vou pagar;
- manda pix;
- atendimento humano;
- falar com Coringa.

### Execucao do handoff

Arquivo:
- `api/meta.js`

Trechos funcionais:
- se `existingLead.stage === "humano"`, a IA e bloqueada;
- mensagens novas durante atendimento humano sao salvas em `messages`;
- `leads.last_message` e `leads.updated_at` sao atualizados;
- a rota retorna `handoff_humano`;
- quando `newStage === "humano"`, a resposta informa que o atendimento sera encaminhado ao Coringa;
- `alertarAdminLeadHumano()` envia alerta WhatsApp para admins;
- o lead e atualizado com `stage: "humano"`.

### Alerta admin

Arquivo:
- `api/meta.js`

Funcoes:
- `getAdminPhones()`
- `enviarWhatsApp(phone, body)`
- `alertarAdminLeadHumano({ leadName, phone, userText, stage })`

### Regra documentada

Arquivo:
- `docs/REGRAS_NEGOCIO.md`

Define handoff obrigatorio para termos como:
- pix;
- pagar;
- pagamento;
- sinal;
- reservar horario;
- marcar horario;
- agendar;
- fechar;
- falar com Coringa;
- atendimento humano.

Observacao:
- ainda nao existe `modules/handoffRules.js`;
- a decisao de handoff esta parcialmente misturada com stage.

## 5. Onde esta a logica de IA

### Implementacao atual

Arquivo principal:
- `api/meta.js`

Responsabilidades de IA ainda dentro de `meta.js`:
- montar o prompt system completo;
- montar historico da conversa;
- montar mensagens multimodais quando ha imagem;
- chamar Azure OpenAI chat completions via `fetch`;
- definir `temperature` e `max_tokens`;
- tratar erro da Azure;
- aplicar fallback de resposta;
- sanitizar links/instagram;
- transcrever audio usando Azure Whisper;
- baixar midia da Meta para enviar imagem em base64 ao modelo.

Funcoes relacionadas dentro de `api/meta.js`:
- `getMediaUrl(mediaId)`
- `downloadMedia(url)`
- `transcreverAudio(mediaId)`

### Estrutura planejada

Arquivos existentes mas vazios:
- `services/ai/openai.js`
- `services/ai/prompts.js`
- `services/ai/memory.js`
- `services/ai/media.js`

Documentacao relacionada:
- `docs/engineering/CHECKPOINT_V2.md`
- `docs/technical/TECHNICAL_ROADMAP.md`

Leitura arquitetural:
- a pasta `services/ai/` ja foi criada como destino da modularizacao;
- a logica real de IA ainda nao foi migrada para esses arquivos.

## 6. Onde esta a logica de Supabase

### Client modularizado

Arquivo:
- `services/supabase/client.js`

Responsabilidade:
- criar e exportar `supabase` com `createClient(env.SUPABASE_URL, env.SUPABASE_KEY)`.

Usado por:
- `api/meta.js`

### Queries e persistencia ainda nos endpoints

Arquivo:
- `api/meta.js`

Tabelas usadas:
- `leads`
- `messages`

Operacoes observadas:
- buscar lead por telefone com `maybeSingle`;
- upsert de lead;
- update de lead;
- insert de mensagens de usuario;
- insert de mensagens da assistente;
- buscar historico recente;
- listar leads em debug;
- listar mensagens em debug;
- listar mensagens por telefone em debug.

Arquivo:
- `api/followup.js`

Observacao:
- cria seu proprio client Supabase diretamente com `createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY)`;
- busca leads em stages `orcamento`, `followup_1`, `followup_2`;
- atualiza follow-up, stage e datas;
- insere mensagens de follow-up.

Arquivo:
- `api/test-supabase.js`

Observacao:
- tambem cria client Supabase direto com `process.env`;
- consulta ate 5 leads.

Leitura arquitetural:
- o client Supabase ja foi extraido para `services/supabase/client.js`, mas nem todos os endpoints usam esse client;
- ainda nao existem repositories como `leadRepository` ou `messageRepository`;
- a regra de persistencia ainda esta acoplada aos handlers.

## 7. Plano seguro para modularizar sem quebrar

Principio:
- manter `api/meta.js` como orquestrador ate cada extracao estar validada;
- extrair uma responsabilidade por vez;
- preservar assinatura, payloads, stages, textos criticos e comportamento externo;
- validar sintaxe apos cada etapa com `node --check`;
- evitar mudancas simultaneas em dashboard, `.env`, deploy ou remoto.

### Fase 1: consolidar o que ja existe

1. Documentar contrato de `detectarStage(userText, existingStage)`.
2. Criar testes manuais ou casos simples para os stages atuais.
3. Garantir que `api/meta.js` continue importando o detector atual sem mudar fluxo.

Risco:
- baixo.

### Fase 2: extrair WhatsApp/Meta client

Destino provavel:
- `services/meta/whatsapp.js`

Extrair de `api/meta.js`:
- `enviarWhatsApp()`
- `getMediaUrl()`
- `downloadMedia()`

Manter:
- mesmos parametros;
- mesmo formato de retorno;
- mesmos logs de erro inicialmente.

Risco:
- baixo a medio, porque afeta envio de mensagem e midia.

### Fase 3: extrair handoff/admin alerts

Destino provavel:
- `modules/handoff/handoffRules.js`
- `services/meta/adminAlerts.js` ou `modules/adminAlerts.js`

Extrair:
- regras explicitas de handoff que hoje estao dentro de stage;
- `getAdminPhones()`;
- `alertarAdminLeadHumano()`;
- montagem da mensagem admin.

Cuidados:
- nao mudar o stage `humano`;
- nao duplicar alerta para lead que ja estava em humano;
- manter bloqueio da IA quando `existingLead.stage === "humano"`.

Risco:
- medio.

### Fase 4: extrair prompt builder

Destino provavel:
- `services/ai/prompts.js` ou `modules/promptBuilder.js`

Extrair:
- prompt system;
- regras fixas de Instagram;
- regras de orcamento;
- regras de agendamento;
- instrucao de handoff.

Cuidados:
- manter texto funcional equivalente;
- nao alterar tom da IA na primeira extracao;
- nao mudar limites de resposta sem decisao explicita.

Risco:
- medio, porque muda comportamento conversacional se o prompt for alterado.

### Fase 5: extrair Azure OpenAI client

Destino provavel:
- `services/ai/openai.js`

Extrair:
- chamada chat completions;
- tratamento de erro;
- fallback de resposta;
- parametros `temperature` e `max_tokens`.

Manter em `api/meta.js`:
- orquestracao do fluxo;
- decisao de quando chamar IA;
- envio final ao WhatsApp.

Risco:
- medio.

### Fase 6: extrair audio e imagem

Destino provavel:
- `services/ai/media.js` ou `services/meta/media.js`, dependendo da separacao escolhida.

Separacao recomendada:
- Meta media: buscar URL e baixar arquivo;
- AI media: preparar payload multimodal;
- Whisper: transcrever audio.

Risco:
- medio a alto, porque envolve integracao externa, binarios, base64 e fallback.

### Fase 7: extrair repositories Supabase

Destino provavel:
- `services/supabase/leadsRepository.js`
- `services/supabase/messagesRepository.js`

Extrair:
- buscar lead por telefone;
- upsert/update lead;
- inserir mensagem;
- buscar historico;
- listar leads/messages de debug;
- resetar follow-up quando lead responde.

Cuidados:
- migrar primeiro `api/meta.js`;
- depois alinhar `api/followup.js` e `api/test-supabase.js` para usarem `services/supabase/client.js`;
- manter nomes de tabelas e campos intactos.

Risco:
- medio.

### Fase 8: reduzir `api/meta.js` para controller

Objetivo final:
- `api/meta.js` virar entrada, validacao basica e orquestracao;
- regras de negocio ficarem em `modules/`;
- integracoes ficarem em `services/`;
- persistencia ficar em repositories;
- prompt e IA ficarem em `services/ai/`.

Formato esperado do controller:
- validar metodo;
- extrair mensagem;
- carregar lead;
- bloquear IA se humano;
- normalizar conteudo recebido;
- atualizar lead/mensagens;
- chamar IA quando aplicavel;
- aplicar stage/handoff;
- persistir resposta;
- enviar WhatsApp.

## Resumo executivo

O projeto ja iniciou a modularizacao, mas a arquitetura real ainda e centrada em `api/meta.js`.

O que ja esta modularizado:
- detector de stage;
- client Supabase usado por `api/meta.js`;
- estrutura de pastas para servicos de IA.

O que ainda esta concentrado:
- handoff;
- prompt;
- chamada Azure OpenAI;
- audio/transcricao;
- imagem/midia;
- envio WhatsApp;
- queries Supabase;
- memoria de conversa;
- regras de qualificacao.

O caminho mais seguro e continuar a extracao por camadas pequenas, mantendo `api/meta.js` funcionando como controller ate que cada responsabilidade tenha modulo proprio validado.

# INVENTARIO DE MODULOS

Data: 2026-06-06

Escopo analisado:
- `api/meta.js`
- `modules/`
- `services/`

Este documento e apenas um inventario tecnico. Nenhuma refatoracao foi executada.

## 1. Modulos existentes

### `modules/stages`

Modulo de regras de stage do lead.

Status:
- implementado;
- usado por `api/meta.js`.

### `services/ai`

Modulo planejado para servicos de inteligencia artificial.

Status:
- estrutura criada;
- arquivos ainda vazios.

### `services/supabase`

Modulo de conexao com Supabase.

Status:
- implementado parcialmente;
- contem apenas o client compartilhado.

## 2. Arquivos dentro de cada modulo

### `modules/stages`

- `modules/stages/stageDetector.js`

Funcao exportada:
- `detectarStage(userText = "", existingStage = null)`

Responsabilidade atual:
- classificar leads por palavras-chave;
- retornar stages como `curioso`, `humano`, `quente`, `agendamento`, `orcamento` ou preservar stage existente.

### `services/ai`

- `services/ai/media.js`
- `services/ai/memory.js`
- `services/ai/openai.js`
- `services/ai/prompts.js`

Responsabilidade provavel:
- `media.js`: processamento de midia para IA, imagem, audio e payload multimodal;
- `memory.js`: historico e memoria conversacional;
- `openai.js`: chamadas Azure OpenAI/Azure Whisper;
- `prompts.js`: prompt system, regras de conversa e montagem de mensagens.

Status atual:
- os quatro arquivos existem, mas estao vazios.

### `services/supabase`

- `services/supabase/client.js`

Exportacao:
- `supabase`

Responsabilidade atual:
- criar client Supabase com `createClient`;
- usar `env.SUPABASE_URL`;
- usar `env.SUPABASE_KEY`.

## 3. Modulos vazios

Os seguintes arquivos existem com tamanho `0` e ainda nao possuem implementacao:

- `services/ai/media.js`
- `services/ai/memory.js`
- `services/ai/openai.js`
- `services/ai/prompts.js`

Nao foram encontrados arquivos vazios dentro de `modules/`.

## 4. Funcoes de `api/meta.js` que deveriam pertencer a cada modulo

### `modules/stages`

Ja pertence:
- `detectarStage()`, implementada em `modules/stages/stageDetector.js`.

Ainda permanece em `api/meta.js`, mas se relaciona com stage:
- calculo inicial de `stage`;
- recalculo apos captura de nome;
- calculo de `newStage`;
- decisao de atualizar lead com `stage`;
- regra de bloquear IA quando `existingLead.stage === "humano"`.

Observacao:
- parte da logica de handoff esta misturada ao stage, porque `detectarStage()` retorna `humano`.

### Modulo provavel: `modules/qualification`

Ainda nao existe.

Funcoes/trechos de `api/meta.js` que pertencem a ele:
- `extrairNome(userText = "")`;
- regra de `captando_nome`;
- decisao de pedir nome quando `leadName` esta vazio;
- montagem da resposta: `Claro! Antes de continuar, como posso te chamar?`;
- definicao de `leadPayload.stage = "captando_nome"`.

Responsabilidade sugerida pelo inventario:
- controlar captura obrigatoria de nome;
- decidir proxima pergunta de qualificacao;
- evitar repetir perguntas ja respondidas.

### Modulo provavel: `modules/handoff`

Ainda nao existe.

Funcoes/trechos de `api/meta.js` que pertencem a ele:
- bloqueio de IA quando `existingLead?.stage === "humano"`;
- `extrairTextoBasicoMensagem(msg)`;
- resposta especial quando `newStage === "humano"`;
- decisao de alertar admin apenas quando o lead acabou de entrar em `humano`;
- trecho que retorna `handoff_humano`.

Trechos relacionados em outro modulo:
- parte dos gatilhos de handoff esta dentro de `modules/stages/stageDetector.js`.

Responsabilidade sugerida pelo inventario:
- decidir se atendimento deve ser humano;
- impedir IA depois do handoff;
- manter registro de mensagens recebidas durante atendimento humano.

### Modulo provavel: `modules/adminAlerts` ou `services/meta/adminAlerts`

Ainda nao existe.

Funcoes de `api/meta.js` que pertencem a ele:
- `getAdminPhones()`;
- `alertarAdminLeadHumano({ leadName, phone, userText, stage })`;
- montagem da mensagem enviada para admin;
- debug `admin-test`, se mantido como recurso operacional.

Dependencia direta:
- usa `enviarWhatsApp()`.

### Modulo provavel: `services/meta/whatsapp`

Ainda nao existe.

Funcoes de `api/meta.js` que pertencem a ele:
- `enviarWhatsApp(phone, body)`;
- envio final da resposta ao cliente;
- envio de teste admin;
- envio de alerta admin.

Responsabilidade sugerida pelo inventario:
- encapsular chamada para Graph API `/messages`;
- padronizar retorno `{ ok, status, body }`;
- centralizar logs de erro do envio WhatsApp.

### Modulo provavel: `services/meta/media`

Ainda nao existe.

Funcoes de `api/meta.js` que pertencem a ele:
- `getMediaUrl(mediaId)`;
- `downloadMedia(url)`;
- parte inicial de `transcreverAudio(mediaId)` que busca URL da midia e baixa audio;
- trecho que baixa imagem enviada pelo cliente.

Responsabilidade sugerida pelo inventario:
- conversar com Graph API para obter URL de midia;
- baixar binarios de audio/imagem;
- isolar uso de `env.WHATSAPP_TOKEN`.

### `services/ai/media.js`

Arquivo existe, mas esta vazio.

Trechos de `api/meta.js` que deveriam pertencer a ele:
- conversao de imagem para base64;
- montagem do `userContent` multimodal com `image_url`;
- fallback textual quando analise de imagem falha;
- instrucao de analise de imagem de referencia de tattoo.

Observacao:
- parte de download de midia pertence mais naturalmente a um servico Meta;
- parte de preparacao para IA pertence a `services/ai/media.js`.

### `services/ai/openai.js`

Arquivo existe, mas esta vazio.

Trechos de `api/meta.js` que deveriam pertencer a ele:
- chamada Azure Chat Completions;
- leitura de `env.AZURE_ENDPOINT`;
- leitura de `env.AZURE_DEPLOYMENT`;
- envio de header `api-key`;
- tratamento de `aiResponse`;
- fallback de resposta quando nao ha `choices`;
- logs `AZURE CHAT RESULT`, `AZURE ERROR` e `ERRO AZURE FETCH`;
- chamada Azure Whisper dentro de `transcreverAudio(mediaId)`.

Responsabilidade sugerida pelo inventario:
- expor uma funcao de chat;
- expor uma funcao de transcricao;
- esconder detalhes de endpoint, deployment, api-version e headers.

### `services/ai/prompts.js`

Arquivo existe, mas esta vazio.

Trechos de `api/meta.js` que deveriam pertencer a ele:
- prompt system completo;
- regras principais de tom;
- regras de captacao obrigatoria;
- regras de handoff humano;
- bloco de Instagram;
- bloco de orcamento;
- bloco de agendamento;
- regra anti-link/Instagram depois da resposta.

Responsabilidade sugerida pelo inventario:
- montar prompt com `leadName`;
- centralizar regras de negocio conversacional;
- manter consistencia da resposta da IA.

### `services/ai/memory.js`

Arquivo existe, mas esta vazio.

Trechos de `api/meta.js` que deveriam pertencer a ele:
- busca de historico em `messages`;
- ordenacao por `created_at`;
- limite de ultimas mensagens;
- reversao do historico;
- conversao para formato `{ role, content }`.

Dependencia:
- precisa consultar Supabase ou receber dados de um repository.

### `services/supabase/client.js`

Ja existe e ja e usado por `api/meta.js`.

Trechos de `api/meta.js` que poderiam depender dele via repositories:
- buscar lead existente por telefone;
- upsert de lead;
- update de lead;
- insert de mensagem do usuario;
- insert de mensagem da assistente;
- listar leads para debug;
- listar messages para debug;
- listar messages por telefone;
- buscar historico recente.

Responsabilidade atual:
- apenas conexao.

Responsabilidade que nao deveria ficar no client:
- regras de negocio;
- queries especificas de lead/message;
- montagem de payloads.

### Modulo provavel: `services/supabase/leadsRepository`

Ainda nao existe.

Trechos de `api/meta.js` que pertencem a ele:
- `supabase.from("leads").select("*").eq("phone", phone).maybeSingle()`;
- `supabase.from("leads").upsert(leadPayload, { onConflict: "phone" })`;
- `supabase.from("leads").update(updatePayload).eq("phone", phone)`;
- listagem de leads no debug `leads`.

### Modulo provavel: `services/supabase/messagesRepository`

Ainda nao existe.

Trechos de `api/meta.js` que pertencem a ele:
- inserir mensagem do usuario;
- inserir mensagem da assistente;
- buscar historico da conversa;
- listar mensagens no debug `messages`;
- listar mensagens por telefone no debug `messages-by-phone`.

### Modulo provavel: `api/meta.js` como controller

Deveria permanecer em `api/meta.js`:
- handler HTTP;
- validacao de metodo GET/POST;
- verificacao de webhook da Meta;
- extracao inicial de `msg`;
- coordenacao entre modulos;
- resposta HTTP final.

Funcoes internas que poderiam continuar proximas do controller ou ir para `services/auth/dashboardAuth`:
- `validarDashboardToken(req)`;
- verificacao dos endpoints `debug`.

## 5. Dependencias entre modulos

### Dependencias atuais reais

`api/meta.js` depende de:
- `node-fetch`;
- `form-data`;
- `config/env.js`;
- `modules/stages/stageDetector.js`;
- `services/supabase/client.js`;
- Graph API da Meta;
- Azure OpenAI;
- Azure Whisper;
- tabelas Supabase `leads` e `messages`.

`modules/stages/stageDetector.js` depende de:
- nenhuma importacao externa;
- apenas texto de entrada e stage existente.

`services/supabase/client.js` depende de:
- `@supabase/supabase-js`;
- `config/env.js`.

`services/ai/*` depende de:
- nada atualmente, porque os arquivos estao vazios.

### Dependencias logicas recomendadas pelo inventario

Fluxo principal esperado:

1. `api/meta.js`
2. `services/supabase/leadsRepository`
3. `modules/handoff`
4. `services/meta/media`, quando houver audio/imagem
5. `services/ai/media`, quando houver payload multimodal
6. `modules/stages`
7. `modules/qualification`
8. `services/supabase/messagesRepository`
9. `services/ai/memory`
10. `services/ai/prompts`
11. `services/ai/openai`
12. `services/meta/whatsapp`
13. `modules/adminAlerts` ou `services/meta/adminAlerts`, quando entrar em humano

### Dependencias por responsabilidade

`modules/stages`
- nao deveria depender de Supabase, WhatsApp ou IA;
- entrada ideal: texto do usuario e stage atual;
- saida ideal: novo stage.

`modules/qualification`
- pode depender do lead atual e texto do usuario;
- nao deveria chamar WhatsApp nem Supabase diretamente;
- saida ideal: dados extraidos e proxima acao.

`modules/handoff`
- pode depender de stage, lead e texto;
- nao deveria enviar alerta diretamente;
- saida ideal: `shouldHandoff`, `shouldBlockAI`, `handoffReason`.

`modules/adminAlerts`
- depende de lista de admins e servico de WhatsApp;
- nao deveria consultar Supabase diretamente.

`services/meta/whatsapp`
- depende de `env.WHATSAPP_TOKEN` e `env.PHONE_NUMBER_ID`;
- nao deveria conhecer stage, lead ou regras de negocio.

`services/meta/media`
- depende de `env.WHATSAPP_TOKEN`;
- nao deveria conhecer prompt nem Supabase.

`services/ai/openai`
- depende de configuracoes Azure;
- nao deveria conhecer Supabase diretamente;
- deve receber mensagens prontas.

`services/ai/prompts`
- depende de dados do lead e regras de negocio;
- nao deveria fazer fetch nem persistencia.

`services/ai/memory`
- depende de historico de mensagens;
- se consultar Supabase, deve fazer isso via repository ou receber historico ja carregado.

`services/supabase/client`
- depende apenas de env e biblioteca Supabase;
- nao deve conter regras de lead, stage, IA ou WhatsApp.

`services/supabase/leadsRepository`
- depende do client Supabase;
- deve conhecer tabela `leads`;
- nao deve chamar IA ou WhatsApp.

`services/supabase/messagesRepository`
- depende do client Supabase;
- deve conhecer tabela `messages`;
- nao deve chamar IA ou WhatsApp.

## Resumo

Existem hoje tres grupos reais de modulos:

- `modules/stages`, implementado;
- `services/supabase`, parcialmente implementado com client;
- `services/ai`, criado mas vazio.

`api/meta.js` ainda concentra a maior parte das responsabilidades:
- dashboard token/debug;
- handoff;
- admin alerts;
- WhatsApp;
- Meta media;
- Azure chat;
- Azure Whisper;
- prompt;
- memoria;
- qualificacao;
- persistencia de leads/messages.

O inventario indica que a modularizacao ja comecou, mas a maior parte das funcoes ainda esta no controller principal.

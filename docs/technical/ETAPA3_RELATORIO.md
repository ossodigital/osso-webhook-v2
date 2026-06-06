# ETAPA 3 - RELATORIO

Data: 2026-06-06

Objetivo:
- extrair IA de `api/meta.js`;
- manter comportamento atual;
- nao alterar dashboard, Supabase repositories, handoff, stageDetector ou Graph API de imagem.

## 1. Funcoes migradas

### `services/ai/prompts.js`

Funcoes criadas:

- `montarPromptSistema(leadName)`
  - concentra o prompt system usado na chamada Azure Chat Completions;
  - preserva regras de tom, Instagram, orcamento, agendamento, captacao obrigatoria e handoff conversacional.

- `sanitizarRespostaLinks(reply)`
  - preserva a regra que substitui respostas contendo `http` ou `instagram.com`;
  - mantem retorno fixo com os perfis:
    - `@coringatattoosp`
    - `@jennyfertattoopierce`
    - `@tattooateosossos`

### `services/ai/memory.js`

Funcoes criadas:

- `carregarHistoricoConversa(phone, limit = 4)`
  - carrega historico recente usando o repository de mensagens;
  - retorna `historyError` e `conversationHistory`.

- `formatarHistoricoConversa(history = [])`
  - preserva a logica anterior:
    - usa `(history || [])`;
    - aplica `.reverse()`;
    - converte cada item para `{ role, content }`.

### `services/ai/openai.js`

Funcoes criadas:

- `gerarRespostaAtendimento({ leadName, conversationHistory, userContent, fallbackReply })`
  - concentra a chamada Azure Chat Completions;
  - preserva endpoint, deployment, api-version, headers, `temperature: 0.5` e `max_tokens: 220`;
  - preserva logs:
    - `AZURE CHAT RESULT:`
    - `AZURE ERROR:`
    - `ERRO AZURE FETCH:`
  - preserva fallback `"Me conta melhor sua ideia 👍"`.

- `transcreverAudio(mediaId)`
  - concentra a transcricao Azure Whisper;
  - preserva obtencao de midia via Graph API v19.0;
  - preserva download do audio com `WHATSAPP_TOKEN`;
  - preserva `FormData`, `audio.ogg`, `contentType: "audio/ogg"`;
  - preserva `AZURE_WHISPER_DEPLOYMENT`;
  - preserva `AZURE_AUDIO_API_VERSION || "2025-04-01-preview"`;
  - preserva limite de texto em 700 caracteres.

### `services/ai/media.js`

Funcoes criadas:

- `prepararConteudoImagemReferencia(buffer)`
  - converte buffer de imagem para base64;
  - monta `userText` e `userContent` multimodal com `image_url`;
  - preserva o texto de instrucao para analise de referencia de tatuagem.

- `prepararFallbackImagemReferencia()`
  - preserva o fallback quando imagem falha;
  - retorna o mesmo `userText` e o mesmo payload textual anterior.

## 2. Linhas removidas de `api/meta.js`

Observacao:
- o working tree contem as Etapas 1, 2 e 3 sem commit intermediario;
- por isso, o `git diff --numstat` atual mostra o acumulado.

Numeros:

- Diff acumulado atual de `api/meta.js`: 258 linhas removidas.
- Remocoes ja documentadas na Etapa 2: 58 linhas.
- Remocao da funcao local `enviarWhatsApp()` na Etapa 1: 30 linhas.
- Remocoes atribuiveis a Etapa 3: 170 linhas.

O que saiu de `api/meta.js` nesta etapa:
- prompt system completo;
- chamada Azure Chat Completions;
- sanitizacao anti-link/Instagram;
- formatacao local do historico;
- montagem do payload multimodal de imagem;
- fallback textual de imagem;
- transcricao local de audio com Azure Whisper;
- import local de `FormData`.

## 3. Riscos encontrados

### Risco: alterar prompt sem querer

Controle aplicado:
- o prompt foi movido para `services/ai/prompts.js`;
- os textos foram conferidos para evitar encoding corrompido;
- nenhuma regra de prompt foi intencionalmente alterada.

### Risco: alterar comportamento da IA

Controle aplicado:
- endpoint Azure Chat Completions foi preservado;
- `api-version=2024-02-15-preview` foi preservado;
- `temperature: 0.5` foi preservado;
- `max_tokens: 220` foi preservado;
- fallback `"Me conta melhor sua ideia 👍"` foi preservado;
- logs de erro e resultado foram preservados.

### Risco: alterar audio

Controle aplicado:
- `transcreverAudio(mediaId)` foi migrada sem mudar fluxo;
- Graph API v19.0 para obter midia do audio foi preservada;
- download com `WHATSAPP_TOKEN` foi preservado;
- Azure Whisper foi preservado;
- fallback de texto e limite de 700 caracteres foram preservados.

### Risco: alterar imagem

Controle aplicado:
- `getMediaUrl()` e `downloadMedia()` continuam em `api/meta.js`;
- apenas a preparacao do payload de IA foi movida para `services/ai/media.js`;
- texto principal e fallback de imagem foram preservados.

### Risco: alterar Supabase ou handoff

Controle aplicado:
- repositories Supabase nao foram alterados nesta etapa;
- stageDetector nao foi alterado;
- regra `existingLead?.stage === "humano"` nao foi alterada;
- resposta de handoff humano nao foi alterada;
- alerta admin nao foi alterado.

## 4. Validacao

Comandos executados:

- `node --check api/meta.js`
- `node --check services/ai/prompts.js`
- `node --check services/ai/memory.js`
- `node --check services/ai/openai.js`
- `node --check services/ai/media.js`

Resultado:
- todos passaram.

## 5. Impacto para futura arquitetura SaaS

### Prompt por nicho

Com `montarPromptSistema()` isolado, fica mais simples evoluir para:
- prompt por empresa;
- prompt por segmento;
- regras comerciais configuraveis;
- onboarding por nicho.

### Controle de custo e modelo

Com `gerarRespostaAtendimento()` isolada, fica mais simples evoluir para:
- troca de modelo;
- parametros por cliente;
- controle de tokens;
- logs centralizados de IA.

### Memoria conversacional

Com `carregarHistoricoConversa()` isolada, fica mais simples evoluir para:
- memoria por lead;
- memoria por empresa;
- historico configuravel por plano;
- analytics de conversa.

### Midia e multimodal

Com `services/ai/media.js`, fica mais simples evoluir para:
- analise de imagem por nicho;
- anexos em outros segmentos;
- fluxos multimodais reutilizaveis.

### Controller menor

`api/meta.js` passa a atuar mais como orquestrador:
- recebe mensagem;
- aciona repositories;
- aciona IA;
- aplica stage/handoff;
- envia resposta.

Isso reduz acoplamento e prepara o projeto para configuracao multiempresa.

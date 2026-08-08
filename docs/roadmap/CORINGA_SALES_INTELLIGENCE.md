# Coringa Sales Intelligence V1

## Propósito

Evoluir gradualmente o agente atual para um atendimento comercial especializado no padrão do Coringa, preservando o CRM que já funciona. Esta fase é exclusivamente de auditoria e planejamento: não altera webhook, Meta, WhatsApp, Azure OpenAI, Supabase, dashboard, Takeover, Voltar IA, autenticação, domínio ou deploy.

## Baseline auditado

- Branch: `main`.
- Último commit: `c58b410` — `Atualiza identidade visual e interface mobile do CRM`.
- Tags de proteção existentes: `crm-v1-stable` e `platform-before-refactor`.
- Branches de backup existentes: `backup-auth-v1` e `backup-platform-v1`.
- O working tree já continha alterações locais anteriores a esta documentação.
- Não existem testes conversacionais automatizados. `api/test-supabase.js` é endpoint diagnóstico, não suíte de regressão.
- `npm run check --if-present` passou antes da criação deste documento.

## Mapa dos arquivos reais

| Responsabilidade | Arquivo real | Símbolo/ponto principal |
|---|---|---|
| Orquestração do webhook e agente | `api/meta.js` | `handler()` — fluxo POST a partir da extração de `msg` |
| Prompt monolítico | `services/ai/prompts.js` | `montarPromptSistema()` |
| Sanitização de links | `services/ai/prompts.js` | `sanitizarRespostaLinks()` |
| Chamada ao Azure Chat | `services/ai/openai.js` | `gerarRespostaAtendimento()` |
| Transcrição de áudio | `services/ai/openai.js` | `transcreverAudio()` |
| Contexto multimodal de imagem | `services/ai/media.js` | `prepararConteudoImagemReferencia()` |
| Fallback de imagem | `services/ai/media.js` | `prepararFallbackImagemReferencia()` |
| Histórico recente | `services/ai/memory.js` | `carregarHistoricoConversa()` |
| Formatação do histórico | `services/ai/memory.js` | `formatarHistoricoConversa()` |
| Classificação de stage e handoff | `modules/stages/stageDetector.js` | `detectarStage()` |
| Captura do nome | `modules/qualification/qualificationRules.js` | `extrairNome()` |
| Classificadores duplicados | `modules/qualification/qualificationRules.js` | `identificarLeadCurioso()` e `identificarLeadQuente()` |
| Mensagem durante humano ativo | `modules/handoff/handoffRules.js` | `extrairTextoBasicoMensagem()` |
| Persistência de mensagens | `services/supabase/messagesRepository.js` | `inserirMensagem()` e `buscarHistoricoRecente()` |
| Persistência do lead/stage | `services/supabase/leadsRepository.js` | `buscarLeadPorTelefone()`, `upsertLead()` e `atualizarLeadPorTelefone()` |
| Preços e políticas | `services/ai/prompts.js` | seção `Orçamento` dentro de `montarPromptSistema()` |
| Regras documentadas | `docs/REGRAS_NEGOCIO.md` | referência humana; não é carregada pelo runtime |

Não existe atualmente `config/prompts`, Pricing Engine, Lead Scoring, memória estruturada, Sales Strategy, Objection Engine ou Coringa Examples.

## Fluxo atual do agente

```text
Meta/WhatsApp entrega webhook
            ↓
api/meta.js extrai a mensagem e o telefone
            ↓
Busca lead existente no Supabase
            ↓
stage atual é "humano"?
    ├── sim: registra mensagem, atualiza lead, bloqueia IA e retorna
    └── não: normaliza texto, áudio ou imagem
            ↓
Áudio → mídia Meta → download → Azure Whisper → texto
Imagem → mídia Meta → download → Storage → payload multimodal
            ↓
detectarStage(userText, existingStage)
            ↓
Captura/valida nome e atualiza lead
            ↓
Persiste mensagem do cliente
            ↓
Sem nome? pergunta o nome e encerra esta interação
            ↓
Carrega as 4 mensagens mais recentes
            ↓
montarPromptSistema(nome, imageMode)
            ↓
Azure OpenAI gera resposta
            ↓
sanitizarRespostaLinks()
            ↓
detectarStage(userText, stage) novamente
            ↓
novo stage é "humano"?
    ├── sim: substitui resposta da IA por texto fixo de handoff
    │        atualiza lead e envia alerta administrativo
    └── não: mantém resposta da IA
            ↓
Persiste resposta e envia pelo WhatsApp
```

## Handoff atual

### Classificação

O handoff começa em `modules/stages/stageDetector.js`. `detectarStage()` retorna `humano` quando encontra uma destas condições textuais:

- `quero reservar`;
- `reservar horário`, `reservar horario`, `reservar tattoo`;
- `quero marcar`, `marcar tattoo`, `marcar tatuagem`;
- `quero agendar`, `pode agendar`;
- `quero fechar`, `fechar agora`, `vamos fechar`;
- `vou pagar`, `manda pix`, `manda o pix`;
- `atendimento humano`, `falar com humano`;
- `falar com coringa`, `chama o coringa`, `quero falar com o coringa`;
- `me passa o número`, `me passa o numero`, `me passa o contato`;
- `pagar o sinal`, `quanto é o sinal`, `quanto e o sinal`;
- `aceito`, `fechado`, `bora fechar`, `ta bom vamos fechar`, `tá bom vamos fechar`.

O detector também retorna `quente` para `pix`, cartão, sinal, fechar, `quero fazer`, `quero tatuar`, `vou fazer` e `vamos fazer`, mas `quente` isoladamente não aciona handoff no controller atual.

### Efeito

`api/meta.js` chama `detectarStage()` duas vezes. Depois da resposta da IA, se o retorno for `humano`:

1. substitui a resposta gerada por mensagem fixa de encaminhamento;
2. grava `stage: humano` no lead;
3. dispara `alertarAdminLeadHumano()` na primeira transição;
4. nas mensagens seguintes, bloqueia a IA antes do processamento de mídia.

### Diagnóstico do handoff precoce

O CASE-001 foi reproduzido no baseline anterior à correção. Embora `braço fechado` não aparecesse como frase completa na lista, o detector usava `text.includes("fechado")`. Portanto, `Braço fechado` continha a substring `fechado` e retornava `humano`, independentemente do stage anterior. O erro estrutural confirmado era a correspondência por substring sem contexto, somada ao acoplamento entre stage e decisão de handoff.

### Cadeia causal comprovada do CASE-001 no baseline

1. Antes da IA, `api/meta.js` chama `detectarStage(userText, existingLead?.stage)`.
2. Para a imagem, o `userText` sintético é `cliente enviou imagem de referência de tattoo`, que resulta em `orcamento` por conter `tattoo`.
3. Na mensagem seguinte, o texto passado ao detector é `Braço fechado` e o stage existente é `orcamento`.
4. `detectarStage()` normaliza para `braço fechado`.
5. A condição `text.includes("fechado")` é verdadeira.
6. O detector retorna `humano` antes de considerar qualquer outro stage.
7. A IA ainda é chamada porque o bloqueio por humano só ocorre quando o lead já entrou no request com `stage === humano`.
8. Depois da IA, `api/meta.js` chama novamente `detectarStage(userText, stage)`, usando outra vez `Braço fechado`, e não a resposta da IA.
9. O retorno permanece `humano`.
10. `api/meta.js` substitui qualquer resposta gerada pela mensagem fixa `Perfeito, Allef!... Vou encaminhar...`.
11. O lead é persistido com `stage: humano` e o alerta administrativo é disparado.

O histórico é enviado ao modelo, mas não participa das duas chamadas do detector. A resposta da IA também não é inspecionada pelo detector. Portanto, `BUG-HANDOFF-SELF-DETECTION` não existe no código atual.

## Prompt atual

`services/ai/prompts.js` monta todo o prompt em `montarPromptSistema(leadName, { imageMode })`.

A mesma string reúne:

- identidade e personalidade;
- estilo de resposta;
- Instagram, endereço e horários;
- especialidades;
- preços e sinal;
- pagamento, cancelamento e remarcação;
- preparação e aftercare;
- saúde;
- coleta de informações;
- cobertura e manga fechada;
- handoff;
- segurança e restrições;
- instruções detalhadas de imagem.

`services/ai/openai.js` adiciona essa string como mensagem `system`, seguida do histórico e da mensagem atual. O modo texto usa `max_tokens: 220` e temperatura `0.5`; imagem usa `max_tokens: 600` e temperatura `0.6`.

## Memória e contexto

`services/ai/memory.js` chama `buscarHistoricoRecente(phone, 4)`. O repositório busca somente `role` e `content`, em ordem decrescente, e o formatter reverte o array para ordem cronológica.

Limitações confirmadas:

- apenas quatro mensagens;
- não existe `lead_context` estruturado;
- estilo, local, tamanho, referência, primeira tattoo, horas e preço não são extraídos como fatos;
- evitar repetição depende da interpretação do modelo sobre um histórico curto;
- mídia persistida possui URL e tipo, mas o histórico entregue à IA contém somente texto.

## Imagem

O ramo de imagem está em `api/meta.js`:

1. obtém URL pela API da Meta;
2. define `mediaType = image`;
3. baixa o arquivo;
4. envia ao Supabase Storage;
5. chama `prepararConteudoImagemReferencia(buffer)`;
6. envia texto instrucional e `image_url` base64 ao modelo;
7. ativa `imageMode` no prompt.

O prompt orienta análise de estilo, traço, composição, adaptação, tipo de referência, cobertura, múltiplas referências, tamanho e local. O resultado da análise não é convertido em memória estruturada; fica apenas na resposta textual armazenada.

## Áudio

O ramo de áudio começa em `api/meta.js` e chama `transcreverAudio(msg.audio.id)` em `services/ai/openai.js`.

Fluxo real:

1. busca a URL de mídia na Graph API `v19.0`;
2. baixa a mídia com `WHATSAPP_TOKEN`;
3. força o arquivo no formulário como `audio.ogg` e MIME `audio/ogg`;
4. envia ao deployment configurado em `AZURE_WHISPER_DEPLOYMENT`;
5. usa `AZURE_AUDIO_API_VERSION` ou fallback `2025-04-01-preview`;
6. limita a transcrição a 700 caracteres;
7. persiste a transcrição como conteúdo da mensagem.

Se qualquer etapa falhar, `api/meta.js` usa `quero fazer uma tatuagem` como texto substituto. Esse fallback pode produzir intenção comercial inexistente e não informa ao cliente que a transcrição falhou.

Hipóteses a verificar antes de modificar:

- MIME real diferente de `audio/ogg`;
- codec não aceito em parte dos arquivos;
- expiração ou falha no download da URL Meta;
- divergência entre `AZURE_WHISPER_ENDPOINT` existente no ambiente e o uso de `AZURE_ENDPOINT` no código;
- resposta Azure sem `text`;
- mídia salva no dashboard, mas conteúdo textual substituído pelo fallback;
- logs insuficientes para correlacionar `mediaId`, telefone, MIME, tamanho e status das etapas.

## Pricing atual

A única fonte operacional encontrada é a seção `Orçamento` do prompt monolítico:

- valor mínimo: R$150;
- sessão aproximada de 3 horas: R$650;
- sessão aproximada de 6 horas: R$1.200;
- sinal: R$100;
- parcelamento: até 2x sem juros;
- Pix, cartão e InfinitePay.

Não existe configuração central, Pricing Engine, cálculo por hora, regra para interpolar 4–5 horas ou validação programática de suficiência. Portanto, a estimativa de R$850 do CASE-001 não pode ser automatizada com segurança apenas pelo código atual.

## CASE-001 — Allef

### Contexto conhecido

- nome: Allef;
- intenção: fazer uma tattoo;
- referência visual enviada;
- estilo analisado;
- região informada: braço fechado;
- primeira tattoo confirmada posteriormente pelo operador.

### Erro observado

O agente realizou handoff depois de `Braço fechado.` e interrompeu qualificação, orçamento e venda.

### Comportamento desejado

1. registrar `body_location = braço fechado`;
2. manter a referência como já recebida;
3. perguntar apenas um dado realmente ausente, como primeira tattoo ou medida aproximada;
4. estimar execução somente com regra autorizada;
5. apresentar faixa de investimento com premissas;
6. justificar tecnicamente complexidade e encaixe;
7. oferecer personalização e composição mais harmônica;
8. interpretar perguntas posteriores sobre duração como buying signals;
9. entrar em `WAITING_FOR_CUSTOMER` depois de responder/propor adequadamente;
10. transferir apenas diante de reserva, pagamento, pedido explícito ou exceção real.

### Aprendizados

- referência não significa handoff;
- região corporal não significa handoff;
- orçamento deve continuar no agente quando houver regra segura;
- preço precisa de justificativa técnica e valor artístico;
- personalização diferencia o estúdio;
- perguntas após o preço indicam continuidade comercial;
- score alto orienta estratégia, mas não ordena handoff;
- depois de uma proposta completa, o agente deve aguardar.

## Gargalos

1. Prompt monolítico mistura todas as responsabilidades.
2. Stage e decisão de handoff estão acoplados.
3. `detectarStage()` é executado duas vezes para o mesmo texto.
4. Expressões amplas causam handoff sem política contextual.
5. Não existe memória estruturada de fatos.
6. Histórico limitado a quatro mensagens.
7. Não existe score comercial.
8. Não existe Sales Strategy explícita.
9. Não existe estado `WAITING_FOR_CUSTOMER`.
10. Pricing está hardcoded dentro do prompt.
11. Não há regra determinística para estimar horas ou preço.
12. Imagem alimenta a resposta, mas não a memória.
13. Áudio força MIME e possui fallback semanticamente incorreto.
14. Não existe dataset aprovado de exemplos do Coringa.
15. Não existem testes de regressão conversacional.

## Arquitetura alvo

```text
Mensagem normalizada
        ↓
Lead Memory
        ├── fatos conhecidos
        ├── informações ausentes
        └── contexto de mídia
        ↓
Stage Detector ───────────────┐
(somente classifica)          │
                              ├──→ Sales Strategy
Lead Scoring ─────────────────┤     ├── próximo objetivo
(somente orienta)             │     ├── objeção
                              │     ├── pricing permitido
Handoff Decision ─────────────┘     └── waiting/customer
(decisão independente)                    ↓
                                   Prompt Engine
                                          ├── identity
                                          ├── business rules
                                          ├── tattoo knowledge
                                          ├── sales behavior
                                          ├── pricing
                                          ├── objections
                                          ├── memory
                                          └── examples aprovados
                                                   ↓
                                             Azure OpenAI
                                                   ↓
                                      Pipeline atual de persistência
                                                   ↓
                                                WhatsApp
```

## Módulos propostos

| Módulo | Responsabilidade | Dependências principais |
|---|---|---|
| `modules/stages/stageDetector.js` | Classificar momento comercial | Texto normalizado e memória |
| `modules/sales/leadScoring.js` | Calcular score e breakdown | Fatos e sinais da conversa |
| `modules/sales/handoffDecision.js` | Decidir se há motivo real para humano | Stage, intenção, exceções e memória |
| `modules/sales/salesStrategy.js` | Definir próximo objetivo comercial | Stage, score, objeções e pricing |
| `modules/memory/leadMemory.js` | Construir fatos conhecidos | Lead, mensagens e análise de mídia |
| `modules/learning/coringaExamples.js` | Recuperar exemplos aprovados | Dataset supervisionado futuro |
| `services/ai/promptEngine.js` | Compor módulos necessários | Estratégia e contexto |
| `config/business/pricing.js` | Fonte única de preços autorizados | Aprovação comercial |

Nenhum desses módulos deve ser criado ou ativado antes dos testes de baseline e da definição de contratos.

## Dataset comportamental futuro

Proposta ainda não implementada:

```text
sales_examples
  id
  conversation_id
  lead_id
  context
  customer_message
  coringa_response
  intent
  stage
  tattoo_style
  body_location
  estimated_size
  estimated_hours
  estimated_price
  objection_type
  sales_strategy
  outcome
  quality_score
  approved
  created_at
```

Regras obrigatórias:

- nenhuma autoalteração de prompt;
- nenhum código gerado ou publicado pela IA;
- somente exemplos aprovados entram na memória comercial;
- feedback do dashboard deve ser planejado separadamente;
- nenhuma tabela deve ser criada antes de validar necessidade, RLS, retenção e impacto no banco atual.

## Roadmap completo — Fases A a P

O escopo final permanece integral. A execução incremental é uma estratégia de proteção, não uma redução de objetivo.

### Fase A — Correções de base

**Objetivo:** proteger o comportamento atual, corrigir falsos positivos comprovados e auditar os demais gatilhos sem alterações em massa.

- A1 — BUG-001 corrigido localmente e protegido por testes.
- A2 — primeira camada de regressão Stage/Handoff criada.
- A3 — demais gatilhos de `humano` permanecem para auditoria individual.

**IDs:** CRM-001, CRM-002 e CRM-018.
**Gate:** baseline, evidência causal e regressão aprovada.
**Estado:** EM DESENVOLVIMENTO; BUG-001 está CORRIGIDO EM TESTE e ainda não foi publicado.

### Fase B — Separação Stage/Handoff

**Objetivo:** fazer Stage apenas classificar e tornar Handoff uma decisão independente, preservando valores consumidos pelo banco e dashboard.

Componentes planejados: `StageClassifier`, `HandoffClassifier` e `HandoffPolicy`.

**IDs:** CRM-003.
**Dependências:** matriz completa de gatilhos e contratos dos stages atuais.
**Estado:** PENDENTE.

### Fase C — Conversation State

**Objetivo:** representar em memória nome, intenção, estilo, referência, imagem, local, tamanho, primeira tattoo, complexidade, estimativas, objeções, buying signals, stage, score, agenda, pagamento, handoff readiness e `waiting_for_customer`.

Não criar novos campos no banco inicialmente.

**IDs:** CRM-004, CRM-005, CRM-006 e CRM-012.
**Estado:** PENDENTE.

### Fase D — Memória e Collected Facts

**Objetivo:** extrair fatos conhecidos e impedir perguntas repetidas, preservando o histórico atual durante a migração.

Fatos mínimos: nome, estilo, local, tamanho, referência, primeira tattoo, preferências, estimativas apresentadas, objeções e intenção de compra.

**IDs:** CRM-004.
**Dependências:** Conversation State e política de resolução de conflitos.
**Estado:** PENDENTE.

### Fase E — Prompt Engine modular

**Objetivo:** decompor gradualmente o prompt em identidade, personalidade, regras de negócio, conhecimento de tattoo, fluxo comercial, pricing, imagem, áudio, objeções, handoff, agenda, memória, scoring, exemplos, segurança e psicologia de vendas.

`montarPromptSistema()` permanece como fachada até equivalência comprovada.

**IDs:** CRM-010 e CRM-018.
**Estado:** PENDENTE.

### Fase F — Sales Strategy

**Objetivo:** escolher o próximo movimento comercial sem transformar a conversa em formulário.

Fluxo: recepção → intenção → referência → qualificação → análise → tamanho/local → complexidade → estimativa → investimento → valorização → objeções → interesse → agenda → sinal → handoff.

**IDs:** CRM-005, CRM-011, CRM-012, CRM-015 e CRM-016.
**Estado:** PENDENTE.

### Fase G — Pricing Engine

**Objetivo:** centralizar regras aprovadas e distinguir `INFORMAÇÃO INSUFICIENTE`, `ESTIMATIVA POSSÍVEL` e `ORÇAMENTO REQUER HUMANO`.

Nunca inventar preço ou duplicar fonte de verdade.

**IDs:** CRM-007.
**Dependências:** validação formal de mínimo, sessões, sinal, premissas e faixas.
**Estado:** PENDENTE.

### Fase H — Lead Scoring

**Objetivo:** calcular score e breakdown auditável em shadow mode. Score orienta estratégia e nunca produz handoff automaticamente.

**IDs:** CRM-006 e CRM-019.
**Estado:** PENDENTE.

### Fase I — Objection Engine

**Objetivo:** reconhecer preço, dor, medo, indecisão, tempo, comparação, prazo, necessidade de pensar e desconto, aplicando estratégia sem pressão artificial.

**IDs:** CRM-011.
**Estado:** PENDENTE.

### Fase J — Waiting for Customer

**Objetivo:** permitir que o agente aguarde depois de responder, orçar, propor ou trabalhar uma objeção, sem gerar pressão compulsiva.

Follow-up permanece módulo independente.

**IDs:** CRM-012.
**Estado:** PENDENTE.

### Fase K — Image Context

**Objetivo:** transformar análise visual em contexto reutilizável: estilo, elementos, complexidade, tamanho mínimo, legibilidade, local provável, adaptação, composição e personalização.

Não alterar upload ou Supabase Storage nesta fase.

**IDs:** CRM-008.
**Estado:** PENDENTE.

### Fase L — Audio Reliability

**Objetivo:** identificar falhas por etapa, auditar MIME e corrigir o fallback que hoje transforma falha em `quero fazer uma tatuagem`.

Fallback alvo: `Não consegui entender completamente seu áudio. Pode reenviar ou escrever pra mim?`

**IDs:** CRM-009 e CRM-018.
**Estado:** AUDITANDO.

### Fase M — Coringa Sales Intelligence

**Objetivo:** preparar aprendizado supervisionado: conversa real → padrão candidato → aprovação → biblioteca → recuperação contextual.

Proibidos autoalteração de código, prompt de produção e aprendizado não auditado.

**IDs:** CRM-013.
**Estado:** PENDENTE.

### Fase N — Feedback supervisionado

**Objetivo:** planejar 👍, 👎 e ⭐ Padrão Coringa sem quebrar o dashboard atual.

**IDs:** CRM-014 e CRM-017.
**Estado:** PENDENTE.

### Fase O — Shadow Mode

**Objetivo:** comparar em paralelo stage, handoff, score, facts, estratégia e composição de prompt sem afetar clientes.

**IDs:** CRM-019.
**Estado:** PENDENTE.

### Fase P — Rollout controlado

**Objetivo:** ativar uma camada por vez, com teste, resultado, rollback, commit identificável e validação real.

Nunca ativar simultaneamente Prompt Engine, Stage, Handoff e Pricing novos.

**IDs:** CRM-020.
**Estado:** PENDENTE.

## Rastreabilidade dos requisitos

| Requisito final | Fases/IDs responsáveis | Preservado |
|---|---|---:|
| Entender contexto e intenção | C–F / CRM-004, CRM-005 | SIM |
| Não repetir perguntas e memorizar fatos | C–D / CRM-004 | SIM |
| Imagem como contexto reutilizável | K / CRM-008 | SIM |
| Áudio com fallback confiável | L / CRM-009 | SIM |
| Qualificação comercial | F / CRM-005 | SIM |
| Estimativa segura de execução/investimento | G / CRM-007 | SIM |
| Valorização e objeções | F, I / CRM-005, CRM-011 | SIM |
| Buying signals e lead score | C, H / CRM-006 | SIM |
| Saber continuar, parar e esperar | F, J / CRM-012 | SIM |
| Agenda e sinal | F / CRM-015, CRM-016 | SIM |
| Handoff somente quando necessário | A–B / CRM-002, CRM-003 | SIM |
| Aprendizado supervisionado do Coringa | M–N / CRM-013, CRM-014 | SIM |
| Shadow testing e rollout seguro | O–P / CRM-019, CRM-020 | SIM |
| Sem autoalteração não supervisionada | M e gates de rollout | SIM |
| CASE-001 como fixture permanente | A / BUG-001, CRM-018 | SIM |

## Ordem de implementação

1. Proteger baseline com testes de caracterização.
2. Reproduzir CASE-001 e demais casos reais em fixtures anonimizadas.
3. Auditar handoffs históricos e confirmar o texto exato que causou cada transição.
4. Separar classificação de stage da decisão de handoff, inicialmente em modo compatível.
5. Construir memória estruturada em shadow mode, sem alterar respostas.
6. Centralizar pricing somente depois de aprovação formal dos valores e fórmulas.
7. Calcular lead score em shadow mode; nunca ligar score diretamente ao handoff.
8. Criar Sales Strategy e `WAITING_FOR_CUSTOMER` em shadow mode.
9. Modularizar o prompt preservando inicialmente o texto e a ordem atuais.
10. Melhorar contexto de imagem sem alterar upload ou Storage.
11. Instrumentar confiabilidade do áudio antes de mudar integração.
12. Criar exemplos supervisionados e processo de aprovação.
13. Comparar respostas atuais e candidatas em shadow testing.
14. Fazer rollout controlado com flag, métricas e rollback.

## Riscos

- regressão silenciosa no webhook ao misturar refatoração com controller;
- mudança de stage quebrar dashboard, follow-up ou bloqueio da IA;
- handoff tardio impedir fechamento quando humano é realmente necessário;
- estimativa não autorizada gerar compromisso comercial indevido;
- memória estrutural repetir ou sobrescrever fatos incorretamente;
- score virar decisão automática não auditada;
- exemplos humanos conterem dados pessoais ou padrões de baixa qualidade;
- prompt modular alterar prioridade por simples mudança de ordem;
- observabilidade de áudio expor conteúdo sensível nos logs;
- rollout sem flag dificultar rollback.

## Dependências

- amostra anonimizada de conversas reais;
- confirmação dos valores e regras de pricing pelo Coringa;
- contrato dos stages consumidos por dashboard e follow-up;
- definição dos motivos oficiais de handoff;
- política de retenção e aprovação para exemplos;
- métricas de conversão e abandono;
- mecanismo de feature flag ou seleção de versão;
- ambiente seguro para shadow testing.

## Testes necessários

### Caracterização

- texto simples;
- captura de nome;
- orçamento incompleto;
- orçamento com informações suficientes;
- referência visual;
- cobertura;
- múltiplas referências;
- braço fechado;
- primeira tattoo;
- áudio transcrito;
- áudio com MIME alternativo;
- falha de download;
- falha de transcrição;
- humano já ativo;
- Takeover e Voltar IA;
- follow-up e lead encerrado.

### Stage e handoff

- interesse sem handoff;
- referência sem handoff;
- local sem handoff;
- preço sem handoff;
- duração sem handoff;
- `quanto é o sinal` sem handoff automático até política decidir;
- reserva concreta;
- pagamento concreto;
- pedido explícito pelo Coringa;
- exceção artística e comercial;
- CASE-001 Allef.

### Comercial

- score com breakdown reproduzível;
- score alto sem handoff;
- objeções de preço, dor, indecisão e prazo;
- proposta seguida de `WAITING_FOR_CUSTOMER`;
- ausência de pressão repetitiva;
- personalização sem prometer resultado;
- pricing sem valores fora da configuração autorizada.

### Regressão operacional

- webhook responde nos mesmos contratos;
- persistência de lead e mensagens permanece idêntica;
- imagens continuam no Storage e no dashboard;
- envio e recebimento WhatsApp permanecem funcionais;
- alertas administrativos não duplicam;
- IA permanece bloqueada durante humano ativo;
- envio manual, Takeover e Voltar IA permanecem intactos.

## Handoff Characterization Matrix

| Entrada | Stage atual | Handoff | Regra responsável | Risco | Comportamento desejado futuro |
|---|---|---:|---|---|---|
| `Braço fechado` | `novo` | NÃO | contexto de projeto excluído da intenção comercial | Corrigido em teste | Registrar área e continuar qualificação |
| `Quero fazer uma tattoo` | `quente` | NÃO | regex `quero fazer` | Médio | Continuar coleta e venda |
| `Quanto fica?` | `orcamento` | NÃO | regex `quanto` | Baixo | Coletar dados ou estimar com regra segura |
| `Quanto custa?` | `orcamento` | NÃO | regex `quanto`/`custa` | Baixo | Trabalhar orçamento sem handoff |
| `Queria um orçamento` | `orcamento` | NÃO | regex `orçamento` | Baixo | Continuar no agente |
| `Quanto é o sinal?` | `humano` | SIM | substring `quanto é o sinal` | Alto: dúvida informativa vira transferência | Responder o sinal e avaliar intenção concreta |
| `Quero marcar` | `humano` | SIM | substring `quero marcar` | Médio | Confirmar intenção e usar agenda/humano conforme capacidade |
| `Pode agendar` | `humano` | SIM | substring `pode agendar` | Médio | Agenda Engine ou confirmação humana |
| `Quero fechar` | `humano` | SIM | substring `quero fechar` | Baixo | Handoff de fechamento permitido |
| `Me passa o contato` | `humano` | SIM | substring `me passa o contato` | Médio: contexto ignorado | Entender qual contato antes de transferir |
| `Quero falar com o Coringa` | `humano` | SIM | substring `quero falar com o coringa` | Baixo | Respeitar pedido explícito |
| `Tenho interesse` | `novo` | NÃO | fallback | Médio: buying signal não reconhecido | Classificar interesse e continuar venda |
| `Gostei` | `novo` | NÃO | fallback | Médio: sinal positivo não reconhecido | Registrar buying signal |
| `Pode ser` | `novo` | NÃO | fallback | Médio: aceite contextual não compreendido | Interpretar com memória |
| `Fechado` | `humano` | SIM | substring `fechado` | Alto: palavra isolada sem contexto | Validar aceite comercial concreto |
| `Vou pensar` | `novo` | NÃO | fallback | Médio: espera não reconhecida | Entrar em `WAITING_FOR_CUSTOMER` |
| `Está caro` | `novo` | NÃO | fallback | Alto: objeção não reconhecida | Acionar estratégia de objeção |
| `Tem horário?` | `agendamento` | NÃO | regex `horário` | Baixo | Responder conforme Agenda Engine |
| `Qual dia tem?` | `agendamento` | NÃO | regex `qual dia` | Baixo | Continuar agendamento |

Matriz capturada por `tests/stages/stageDetector.characterization.test.js`. Ela documenta o comportamento atual; não representa aprovação das regras.

## BUG-001 — False Handoff “Braço Fechado”

**Status:** `CORRIGIDO EM TESTE`

### Causa

`detectarStage()` utilizava `text.includes("fechado")` como intenção comercial genérica. Como `Braço fechado` contém a mesma substring, o detector retornava `humano` e `api/meta.js` substituía a resposta normal pela mensagem fixa de handoff.

### Correção

A correspondência genérica foi substituída por `temIntencaoDeFechamento(text)`, uma regra pequena que:

- exclui contextos explícitos de área/projeto (`braço fechado`, `manga fechada`, `fechamento de braço` e `fechar o braço`);
- mantém `Fechado` isolado como aceite comercial;
- mantém intenções explícitas como `Quero fechar`, `Pode fechar` e `Vamos fechar`.

Nenhum stage novo foi criado e Stage/Handoff continuam acoplados nesta etapa.

### Testes

Casos negativos protegidos:

- `Braço fechado`;
- `Manga fechada`;
- `Quero fechar o braço`;
- `Quero fazer o braço fechado`;
- `Fechamento de braço`;
- `Projeto de braço fechado`.

Casos positivos preservados:

- `Fechado`;
- `Quero fechar`;
- `Pode fechar`;
- `Vamos fechar`;
- `Quero fechar com vocês`;
- `Quero fechar essa tattoo`.

### Resultado

`37/37` testes de Stage/Handoff aprovados localmente. CASE-001 agora termina em `orcamento`, sem handoff. Nenhum deploy foi realizado.

## Primeira alteração pequena e segura recomendada

Revisar o diff e executar teste manual controlado em ambiente não produtivo. Somente depois de aprovação explícita considerar commit e rollout separado. CRM-003 continua pendente; esta correção não separa Stage de Handoff.

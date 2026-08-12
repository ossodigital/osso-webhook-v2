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
**Estado:** APROVADO EM SHADOW MODE.

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
**Estado:** EM TESTE.

### Piloto controlado local

- Ativação somente por `CORINGA_AI_PILOT_ENABLED=true` e telefone presente em `CORINGA_AI_PILOT_NUMBERS`.
- Flag desligada ou telefone fora da allowlist preserva integralmente o fluxo legado.
- Falha ao montar o contexto de decisão retorna ao prompt legado.
- O piloto usa memória transitória do contexto já disponível; não cria migração nem persistência nova.
- Não cria handoffs automáticos; takeover manual permanece soberano.
- Logs usam telefone mascarado e não registram conteúdo da conversa ou segredos.
- Evidência local: PILOT-001 a PILOT-014 e suíte oficial 907/907 aprovados.
- Rollback operacional: desligar `CORINGA_AI_PILOT_ENABLED` e recarregar o ambiente.
- Produção: não realizada; depende de autorização e validação real com allowlist mínima.

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

## FASE A3 — HANDOFF AUDIT

**Status:** `APROVADA` em 2026-08-10. Auditoria de caracterização; nenhuma regra de produção foi alterada. `CRM-003` continua `PENDENTE`.

### Mapa completo de `detectarStage()`

As regras são avaliadas nesta prioridade e a primeira correspondência vence. Exceto pelo fallback, nenhuma considera o stage anterior.

| ID | Condição/palavras atuais | Retorno | Stage anterior | Risco / efeito posterior |
|---|---|---|---|---|
| DS-01 | regex `calote|golpe|zoeira|brincadeira|kkk|kkkk` | `curioso` | ignorado | Pode sobrepor qualquer intenção posterior na mesma frase; persiste stage, sem handoff |
| DS-02 | reservar/marcar/agendar explícitos; fechamento comercial; `vou pagar`; `manda [o] pix`; pedidos humanos/Coringa/contato; pagar/perguntar sinal; `aceito` | `humano` | ignorado | Regra ampla e heterogênea; substitui reply, persiste `humano`, alerta admin e bloqueia próximas mensagens |
| DS-03 | regex `pix|cartão|sinal|fechar|quero fazer|quero tatuar|vou fazer|vamos fazer` | `quente` | ignorado | Buying signal amplo; persiste sem handoff |
| DS-04 | regex `agendar|marcar|horário|agenda|quando pode|qual dia|tem vaga` | `agendamento` | ignorado | Intenção de agenda, sem handoff |
| DS-05 | regex `preço|valor|quanto|orçamento|custa|tattoo|tatuagem` | `orcamento` | ignorado | Termos genéricos podem rebaixar/alterar classificação; sem handoff |
| DS-06 | nenhuma correspondência | stage anterior ou `novo` | único caso dependente | Preserva inclusive `humano` no detector isolado |

`temIntencaoDeFechamento()` exclui primeiro `braço fechado`, `manga fechada`, `fechamento de braço` e `fechar o braço`; depois aceita `Fechado` isolado ou as frases `quero/fechar agora/vamos/pode/bora fechar`. A exclusão ocorre antes de DS-03, que ainda pode produzir `quente` quando houver `fechar` ou `quero fazer`.

### Fluxo causal real em `api/meta.js`

1. `takeover` do dashboard persiste diretamente `humano`, consulta o lead e sempre tenta alertar os admins. `release-ai` persiste diretamente `novo`. Nenhum dos dois chama o detector. `send-message` não muda stage.
2. No webhook, o lead é carregado. Se já estiver em `humano`, a mensagem é persistida em forma básica e a execução retorna `handoff_humano` antes de mídia, detector e IA: este é o bloqueio efetivo.
3. Texto é extraído; áudio transcrito ou substituído por `quero fazer uma tatuagem` se falhar; imagem normal ou fallback recebe texto sintético contendo `tattoo`.
4. Primeira chamada: `detectarStage(userText, existingLead?.stage)`. Se um nome é capturado, há chamada adicional com `detectarStage(userText, "novo")`. Portanto são duas chamadas normalmente e três no caminho de captura de nome.
5. O primeiro `upsertLead` persiste o stage calculado, exceto sem nome: `captando_nome` o sobrescreve. Sem nome, envia pergunta de nome e retorna antes da IA, resposta fixa e alerta.
6. Com nome, a IA gera a resposta e ela é sanitizada. Segunda chamada normal: `detectarStage(userText, stage)`; usa novamente a mensagem do cliente, nunca a resposta da IA.
7. Se o resultado for `humano`, a resposta da IA é descartada e substituída pela resposta fixa de encaminhamento.
8. O resultado final é persistido. Se entrou em `humano` e o snapshot inicial não era `humano`, o alerta admin é enviado; depois a resposta é persistida e enviada ao cliente.

Consequência: `stage = humano`, decisão de handoff, resposta fixa, alerta e bloqueio futuro são hoje o mesmo mecanismo. Takeover entra no mesmo estado por outro caminho; Voltar IA apaga esse estado ao definir `novo`.

### Matriz de caracterização

A fixture `tests/fixtures/handoff-audit-matrix.js` é a fonte executável completa: 60 entradas únicas (incluindo mídia) são verificadas contra `novo`, `curioso`, `quente`, `orcamento`, `agendamento` e `humano`. Para uma regra reconhecida, o resultado independe do anterior; sem regra, preserva o anterior. No webhook real, o guard impede chamar o detector quando o stage persistido já é `humano`.

| Grupo | Resultados atuais | Handoff atual | Regra | Futuro desejado / risco |
|---|---|---|---|---|
| Fechamento | `Fechado`, `Quero/Pode/Vamos fechar`, `Quero fechar essa tattoo` → `humano`; `Quero/Fechar o braço` → `quente`; descrições de área → anterior | SIM apenas no primeiro conjunto | DS-02/DS-03/DS-06 | Separar aceite comercial de descrição de projeto; CASE-001 permanece protegido |
| Sinal | `Quanto é` e `Quero pagar o sinal` → `humano`; demais perguntas/Pix → `quente` | Parcial e inconsistente | DS-02 antes de DS-03 | PAYMENT_INTENT/BUYING_SIGNAL não devem implicar handoff automaticamente; alto risco |
| Agenda | `Quero marcar/agendar`, `Pode agendar`, `Quero reservar` → `humano`; disponibilidade e `Pode marcar pra sexta` → `agendamento` | Parcial e inconsistente | DS-02 antes de DS-04 | SCHEDULING_INTENT deve ser separado de decisão de handoff |
| Preço | termos preço/valor/quanto/orçamento/custa → `orcamento`; caro/desconto/parcelar → anterior | NÃO | DS-05/DS-06 | Registrar objeções e condições comerciais sem perder contexto |
| Contato/humano | contato e pedido pelo Coringa → `humano`; tatuador/pessoa/alguém e perguntas de identidade → anterior | Cobertura parcial | DS-02/DS-06 | Pedidos humanos explícitos equivalentes devem convergir; perguntas de identidade são ambíguas |
| Interesse | `Quero fazer [tattoo]` → `quente`; demais sinais → anterior | NÃO | DS-03/DS-06 | Registrar buying signals sem handoff |
| Tattoo/área | `Fechar/Quero fazer o braço` → `quente`; manga/costas/fechamento → anterior | NÃO | DS-03/DS-06 | Tratar como QUALIFICATION_FACT, não handoff |
| Objeções | todas preservam stage anterior | Somente se anterior já era `humano` | DS-06 | Classificar OBJECTION e evitar pressão/reclassificação acidental |

Comportamento por entrada e stage anterior está explicitamente protegido pela fixture; o handoff é `SIM` quando o stage resultante é `humano`. Isso documenta o comportamento atual, não sua aprovação semântica.

### Taxonomia futura

| Categoria | Gatilhos caracterizados |
|---|---|
| `STAGE_SIGNAL` | preço/orçamento, interesse, agenda e descrições de projeto |
| `BUYING_SIGNAL` | fechar comercialmente, Pix, sinal, `quero fazer`, aceite contextual |
| `HANDOFF_SIGNAL` | subconjunto cuja política futura decidir encaminhar; não é sinônimo de buying signal |
| `QUALIFICATION_FACT` | braço/manga/costas fechadas, meia manga, referência de imagem |
| `OBJECTION` | pensar, consultar esposa, caro/mais barato, desconto, parcelamento, dor/resistência |
| `PAYMENT_INTENT` | perguntas e ações sobre Pix/sinal |
| `SCHEDULING_INTENT` | marcar, agendar, reservar e consultar disponibilidade |
| `HUMAN_REQUEST` | falar com humano/pessoa/alguém/tatuador/Coringa |
| `AMBIGUOUS` | `Fechado`, `Pode ser`, `Me passa o contato`, `É/Você é o Coringa?` |

Uma frase pode acumular categorias. Em particular, `Quanto é o sinal?` é `PAYMENT_INTENT + BUYING_SIGNAL`, não necessariamente `HANDOFF_SIGNAL`; `Quero marcar` é `SCHEDULING_INTENT`, não necessariamente handoff; `Quero falar com o Coringa` é `HUMAN_REQUEST` e candidato forte a handoff.

### Bugs novos (registrados, não corrigidos)

| ID | Input | Atual | Esperado futuro | Causa / risco | Arquivo/regra |
|---|---|---|---|---|---|
| BUG-002 | `Quanto é o sinal?` | `humano`, reply fixa, alerta e bloqueio | Responder informação; handoff só por política/intenção concreta | Dúvida informativa acoplada a handoff; alto | `stageDetector.js`, DS-02 |
| BUG-003 | `Quero falar com uma pessoa/alguém` ou `Posso falar com o tatuador?` | preserva stage; sem handoff em stages não humanos | Reconhecer pedido humano explícito | Falsos negativos e frustração; alto | `stageDetector.js`, ausência em DS-02 |
| BUG-004 | `Pode marcar pra sexta?` versus `Quero marcar` | `agendamento` versus `humano` | Mesma intenção base, decisão coerente e contextual | Substrings específicas criam políticas divergentes; médio | `stageDetector.js`, DS-02/DS-04 |
| BUG-005 | qualquer gatilho `humano` antes de informar nome | stage é sobrescrito por `captando_nome`; sem reply/alerta de handoff | Preservar intenção e concluir handoff após identificar ou imediatamente | Pedido humano/pagamento pode ser perdido; alto | `api/meta.js`, sobrescrita e retorno antecipado |
| BUG-006 | `aceito` em contexto não comercial | `humano` | Usar contexto antes de handoff | Palavra isolada ampla pode gerar falso positivo; alto | `stageDetector.js`, DS-02 |

### Áudio e imagem

- Falha de transcrição usa `quero fazer uma tatuagem`: DS-03 produz `quente` para qualquer stage anterior não bloqueado. Não gera handoff imediato, mas inventa intenção de compra e pode sobrescrever `curioso`, `orcamento` ou `agendamento`. Risco alto de corrupção semântica; CRM-009 não foi iniciado nesta fase.
- Imagem normal usa `cliente enviou imagem de referência de tattoo`; fallback usa `cliente enviou imagem de tattoo`. Ambas acionam DS-05 e produzem `orcamento`, independentemente do stage anterior (salvo `humano`, bloqueado antes da mídia no webhook). Podem reclassificar `quente`/`agendamento` para `orcamento`; não geram handoff.

### Dependências e gate para CRM-003

`READY_FOR_CRM_003 = SIM`: regras, prioridade, persistência, bloqueio, resposta, alertas, takeover/release, mídia e principais variações de stage estão mapeados; CASE-001 e a matriz passam em 378/378 testes; bugs conhecidos estão documentados. CRM-003 deverá separar classificação semântica de decisão de handoff mantendo contratos do dashboard, follow-up, alertas e guard da IA.

## CRM-003 — STAGE / HANDOFF MODULARIZATION

**Status:** `APROVADO` em 2026-08-10, após transição `PENDENTE → EM DESENVOLVIMENTO → EM TESTE → APROVADO` e equivalência integral.

### Arquitetura e contratos

| Camada | Contrato puro | Responsabilidade |
|---|---|---|
| `signalClassifier.js` | `classifySignals({ text, previousStage })` | Extrai categorias sem decidir stage, handoff ou executar efeitos |
| `stageClassifier.js` | `classifyStage({ text, previousStage })` | Classifica somente `novo/curioso/quente/orcamento/agendamento`; não produz `humano` por decisão |
| `handoffClassifier.js` | `classifyHandoffSignals({ text, signals })` | Produz candidatos e metadados de compatibilidade, sem decidir nem executar |
| `handoffPolicy.js` | `decideHandoff({ stage, previousStage, signals, handoff, compatibilityMode })` | Retorna somente `{ shouldHandoff, reason }`; modo compatível reproduz a política legada |
| `stageCompatibility.js` | `toLegacyStage({ stage, handoffDecision })` | Traduz decisão positiva para o stage legado `humano` |
| `stageDetector.js` | `detectarStage(text, previousStage)` | Fachada temporária; compõe o pipeline e mantém o contrato antigo |

`classifyConversationCompatibility()` expõe stage semântico, sinais, candidatos, decisão e stage legado para testes/shadow local. Não registra logs e não foi conectado a telemetria ou a um segundo caminho de runtime.

### Compatibilidade e efeitos

O pipeline preserva os stages públicos `novo`, `curioso`, `quente`, `orcamento`, `agendamento` e `humano`. As prioridades e substrings legadas permanecem no modo compatível, incluindo BUG-002 a BUG-006. BUG-001 continua corrigido pelos contextos de projeto no classificador de handoff.

`api/meta.js` não foi alterado. Persistência de `humano`, bloqueio da IA, substituição de reply, alerta administrativo, takeover e release continuam exclusivamente no orquestrador existente. Os classificadores não importam Supabase, Meta, OpenAI, HTTP ou configuração de ambiente.

### Testes e OLD vs NEW

- 60 entradas da matriz A3 × 6 stages anteriores = 360 comparações explícitas entre o detector legado congelado em fixture e a nova fachada.
- Testes unitários cobrem os cinco módulos, composição/shadow, separação entre PAYMENT/BUYING e HANDOFF, modo compatível e BUG-003 preservado.
- CASE-001 e testes de fechamento continuam ativos.
- Resultado final: `747/747`, sem divergências OLD vs NEW.

### Riscos

- O modo compatível duplica deliberadamente regras legadas entre classificação semântica e metadados de compatibilidade; mudanças futuras exigem atualizar testes antes da política.
- `stage = humano` ainda é a representação persistida do efeito, embora a decisão interna já esteja separada.
- A nova política comercial está desativada; as categorias mais ricas ainda não alteram o atendimento.
- BUG-002 a BUG-006 continuam presentes por requisito de equivalência.

### Rollback

Rollback trivial: restaurar apenas `modules/stages/stageDetector.js` para a implementação anterior e remover os cinco módulos novos. `api/meta.js`, banco, dashboard, autenticação, schema e integrações não mudaram. A fixture legada documenta o comportamento a restaurar.

## CRM-004 — Conversation State / Collected Facts

**Status:** `APROVADO` em 2026-08-10, após `PENDENTE → EM DESENVOLVIMENTO → EM TESTE → APROVADO`. Implementação exclusivamente paralela; runtime intacto.

### Estrutura e contratos

`modules/qualification/collectedFacts.js` oferece:

- `collectFacts({ text, history, signals, previousFacts, name })`: extrai e acumula somente fatos sustentados por mensagens do cliente, contexto explícito do lead ou metadados de mídia;
- `createEmptyFacts()`: cria o contrato completo;
- `hasKnownFact(facts, key)`: diferencia fatos conhecidos, inclusive booleanos `false`, de fatos ausentes;
- `findMissingFacts(facts)`: lista lacunas sem transformá-las em perguntas.

`services/ai/conversationState.js` oferece:

- `buildConversationState({ previousStage, currentStage, text, history, signals, facts, previousFacts, name })`;
- `isWaitingForCustomer({ text, facts })`;
- `selectObjective({ facts, missingFacts, waitingForCustomer })`.

O estado resultante contém `previousStage`, `currentStage`, `signals`, `facts`, `missingFacts`, `objective`, `handoffCandidate` e `waitingForCustomer`. Nenhum desses valores altera stage, handoff, resposta, prompt, follow-up ou persistência.

### Facts, confiança e origem

Todos os campos usam `{ value, confidence, source }`. Ausência é representada por `{ value: null, confidence: null, source: null }`; não se fabricam defaults comerciais.

Campos: `name`, `tattooIntent`, `referenceReceived`, `imageReceived`, `audioReceived`, `tattooStyle`, `bodyLocation`, `approximateSize`, `firstTattoo`, `estimatedHours`, `estimatedPrice`, `objections`, `buyingSignals`, `schedulingIntent`, `paymentIntent` e `humanRequest`.

Origens atuais incluem `customer_message`, `lead_context`, `media_context`, `signal_classifier`, `conversation_analysis` e `explicit_conversation_value`. Preço e horas só são extraídos quando aparecem explicitamente; respostas do assistente não são promovidas a fatos do cliente. `previousFacts` preserva conhecimento acumulado.

### Missing facts e objetivos

As lacunas iniciais auditadas são intenção, referência, local, tamanho aproximado e informação sobre primeira tattoo. Booleano `firstTattoo = false` é um fato conhecido. A lista apenas informa o futuro planejador.

Objetivos observacionais: `DISCOVER_INTENT`, `COLLECT_REFERENCE`, `QUALIFY_PROJECT`, `ESTIMATE_PROJECT`, `HANDLE_OBJECTION`, `SCHEDULE`, `PAYMENT` e `WAIT`.

`waitingForCustomer = true` para `Vou pensar`, `te aviso` e `vou ver e te falo`; permanece `false` para perguntas como `quanto fica?` e `qual dia tem?`. Nenhum efeito foi conectado ao follow-up.

### CASE-001 — Allef

A fixture completa representa o contexto conhecido. Após `Braço fechado`, o estado registra:

- `name = Allef`;
- `tattooIntent = true`;
- `referenceReceived = true`;
- `imageReceived = true`;
- `bodyLocation = braço fechado`;
- `currentStage = orcamento`;
- `humanRequest = false` e `handoffCandidate = false`;
- `estimatedHours` e `estimatedPrice` ausentes;
- `missingFacts = [approximateSize, firstTattoo]`;
- `objective = QUALIFY_PROJECT`.

### Testes, riscos e rollback

Os testes cobrem contrato dos fatos, nome, intenção, referência, imagem, áudio, estilo, local, tamanho, primeira tattoo, preço/horas explícitos, sinais, objeções, lacunas, acúmulo, espera, objetivos e CASE-001. Resultado: `766/766`.

Riscos restantes: extração baseada em padrões é conservadora e não resolve conflitos entre declarações; confidence ainda é categórica; estado não é persistido. Rollback é remover os dois módulos, três testes e a fixture desta fase; nenhum consumidor de runtime os importa.

## CRM-005 — SALES STRATEGY

**Status:** `APROVADO` em 2026-08-10, após `PENDENTE → EM DESENVOLVIMENTO → EM TESTE → APROVADO`. Estratégia executável somente por chamadas explícitas/testes; runtime intacto.

### Contrato puro

`determineSalesStrategy(conversationState)` recebe o estado observacional do CRM-004 e retorna:

```js
{
  objective,
  action,
  priority,
  reason,
  nextFact,
  shouldWait,
  shouldHandoff: false
}
```

Não existe campo de mensagem/reply. A função não importa serviços, banco, HTTP, ambiente, OpenAI ou Meta e não modifica o objeto recebido.

### Objetivos e ações

Objetivos implementados: `DISCOVER_INTENT`, `COLLECT_REFERENCE`, `QUALIFY_PROJECT`, `ESTIMATE_PROJECT`, `HANDLE_OBJECTION`, `CHECK_BUYING_INTENT`, `SCHEDULE`, `PAYMENT`, `WAIT_FOR_CUSTOMER` e `HANDOFF_CANDIDATE`.

Ações estruturadas correspondentes: descobrir intenção, coletar referência, pedir apenas o próximo fato, preparar estimativa, tratar objeção, checar intenção de compra, avançar agenda, apoiar pagamento, nenhuma ação e sinalizar candidato humano. Nenhuma ação gera texto ou efeito.

### Regras e precedência

1. `waitingForCustomer` vence e retorna `WAIT_FOR_CUSTOMER`, `NO_ACTION` e `shouldWait=true`.
2. Pedido humano explícito retorna `HANDOFF_CANDIDATE`, mas sempre `shouldHandoff=false` nesta camada.
3. Pagamento/sinal/Pix retorna `PAYMENT`; agenda retorna `SCHEDULE`; objeção retorna `HANDLE_OBJECTION`.
4. Aceites positivos diretos como `Gostei`, `Curti`, `Quero essa`, `Pode ser` e `Aceito` retornam `CHECK_BUYING_INTENT`.
5. Pergunta explícita de preço/orçamento em stage compatível retorna `ESTIMATE_PROJECT`.
6. Sem intenção: `DISCOVER_INTENT`. Com intenção e sem referência: `COLLECT_REFERENCE`.
7. Com referência e lacunas essenciais: `QUALIFY_PROJECT`, selecionando somente `bodyLocation`, depois `approximateSize`, depois `firstTattoo`.
8. Buying signal amplo não pula referência ou qualificação; após fatos essenciais, orienta `CHECK_BUYING_INTENT`.
9. Contexto suficiente sem outra prioridade retorna `ESTIMATE_PROJECT`.

BUYING SIGNAL não é decisão de handoff. Inclusive `Quanto é o sinal?` produz estratégia `PAYMENT` e `shouldHandoff=false`, embora BUG-002 continue existindo na política legada fora desta camada.

### CASE-001 — Allef

- Após `Quero fazer uma tattoo`: `COLLECT_REFERENCE`, sem handoff.
- Após imagem: `QUALIFY_PROJECT`, próximo fato `bodyLocation`, sem handoff.
- Após `Braço fechado` com o histórico conhecido: `QUALIFY_PROJECT` (tamanho é a próxima lacuna), nunca `HANDOFF_CANDIDATE`.

### Shadow mode, testes e riscos

O módulo não é importado por `api/meta.js`, prompt, stage, handoff ou outro consumidor de produção. Shadow mode nesta fase significa somente `Conversation State → decisão → teste`, sem logs.

Testes cobrem recepção, referência, qualificação, estimativa, objeção, buying signal, agenda, pagamento, espera, pedido humano, contrato sem texto e CASE-001. Resultado completo: `780/780`.

Riscos: regras ainda são determinísticas e conservadoras; não há resolução avançada de conflito entre sinais; prioridades precisam de calibração futura; `reason` é diagnóstico interno, não conteúdo para cliente. Rollback é remover `modules/sales/salesStrategy.js` e os dois testes, pois não há integração de runtime.

## CRM-006 — LEAD SCORING

**Status:** `APROVADO` em 2026-08-10, após `PENDENTE → EM DESENVOLVIMENTO → EM TESTE → APROVADO`. Cálculo puro e exclusivo de shadow mode.

### Contrato

`calculateLeadScore(conversationState)` retorna somente:

```js
{
  score,      // 0–100
  level,      // COLD | WARM | HOT | VERY_HOT
  breakdown   // [{ signal, points, reason }]
}
```

O breakdown soma exatamente o score. Quando a soma bruta ultrapassa 100, uma entrada auditável `scoreCap` registra o ajuste. Não existe `shouldHandoff`; score alto nunca executa ou recomenda handoff automaticamente.

### Pesos iniciais

| Evidência | Pontos |
|---|---:|
| Intenção de tattoo | 5 |
| Referência recebida | 10 |
| Imagem sem referência identificada | 5 |
| Local do corpo conhecido | 8 |
| Tamanho aproximado conhecido | 8 |
| Informação de primeira tattoo conhecida, inclusive `false` | 3 |
| Pergunta de preço/orçamento | 10 |
| Estimativa de preço explicitamente conhecida | 10 |
| Pergunta de duração | 5 |
| Estimativa de horas explicitamente conhecida | 5 |
| Buying signal genérico | 10 |
| Intenção de agenda | 15 |
| Intenção de pagamento | 20 |
| Intenção clara de reserva | 20 |

Pedido humano não pontua. Objeções e `waitingForCustomer` não reduzem pontos.

### Levels

- `0–19`: `COLD`
- `20–39`: `WARM`
- `40–69`: `HOT`
- `70–100`: `VERY_HOT`

### Deduplicação

- Referência com imagem soma 10 pela referência, não 10 + 5.
- Reserva substitui agenda genérica para a mesma mensagem.
- Pagamento substitui bônus genérico de buying signal derivado de Pix/sinal.
- Perguntas de preço e duração têm evidências próprias; não recebem também buying genérico apenas por serem perguntas.
- Cada sinal do breakdown é inserido no máximo uma vez por cálculo.

`Collected Facts` passou a manter perguntas explícitas de preço e duração dentro de `buyingSignals`, permitindo progresso entre mensagens sem inventar `estimatedPrice` ou `estimatedHours`.

### CASE-001 — Allef

Progressão comprovada:

1. `Quero fazer uma tattoo`: 15;
2. após imagem/referência: 25;
3. após `Braço fechado`: 33;
4. após `Quanto fica?`: 43;
5. após `Quanto tempo demora?`: 48.

`Braço fechado` acrescenta somente qualificação de local e nunca gera handoff. Preço e horas estimados permanecem nulos.

### Shadow mode, limitações e calibração futura

O scorer não é importado por runtime, Sales Strategy, dashboard, banco, prompt, stage ou handoff. Não há persistência nem logs de produção.

Os pesos são heurísticos iniciais, não calibrados. Conversas reais anonimizadas deverão validar distribuição, thresholds, correlação com conversão e possíveis vieses antes de qualquer consumo operacional. Rollback é remover o módulo e os dois testes, além da pequena ampliação observacional de buying signals em Collected Facts.

Testes cobrem vazio, fatos, preço, duração, agenda, pagamento, reserva, objeções, espera, pedido humano, limites, breakdown, deduplicação e CASE-001. Resultado: `797/797`.

## PACOTE A — INTELIGÊNCIA COMERCIAL

**Status:** `APROVADO` em shadow mode em 2026-08-10. Inclui CRM-007, Objection Engine (CRM-011) e consolidação observacional de WAITING_FOR_CUSTOMER (CRM-012). Nenhum componente possui consumidor no runtime.

### CRM-007 — Pricing Engine

`modules/pricing/pricingEngine.js` contém a tabela canônica do novo Pricing Engine:

- mínimo: R$150;
- sessão oficial de 3h: R$650;
- sessão oficial de 6h: R$1.200;
- sinal: R$100.

Contrato: `evaluatePricing({ conversationState, request })` retorna `status`, `estimate`, `knownFacts`, `missingFacts`, `assumptions` e `reason`.

Statuses:

- `INSUFFICIENT_DATA`: faltam intenção, referência ou local;
- `ESTIMATE_AVAILABLE`: somente valor oficial solicitado (mínimo, sinal, sessão exata de 3h/6h);
- `HUMAN_REVIEW_REQUIRED`: projeto artístico sem regra determinística ou duração sem valor oficial.

Não há interpolação: 4h e 5h não produzem preço. `assumptions` permanece vazio. A pergunta `Quanto é o sinal?` retorna R$100 no engine sem campo de handoff.

A tabela é a fonte única executável do shadow Pricing Engine. O Prompt Engine de produção ainda contém uma cópia legada dos valores e não foi alterado por proibição desta fase; sua futura migração para consumir configuração compartilhada exige etapa própria com equivalência de prompt.

CASE-001 contém projeto, referência e local, mas nenhuma regra artística determinística: retorna `HUMAN_REVIEW_REQUIRED`, sem R$850. Esse valor observado não foi codificado.

### Objection Engine — CRM-011

`classifyObjection({ text, conversationState })` retorna `{ hasObjection, type, confidence, signals, recommendedStrategy }`, sem texto ao cliente.

Tipos: `PRICE`, `DISCOUNT`, `PAIN`, `TIME`, `INDECISION`, `COMPARISON`, `PAYMENT` e `OTHER`. Estratégias abstratas utilizadas: `EXPLAIN_VALUE`, `CLARIFY_SCOPE`, `EXPLAIN_PROCESS`, `DISCUSS_PAYMENT_OPTIONS`, `WAIT` e `HUMAN_REVIEW`.

Mensagens compostas preservam todos os sinais e uma prioridade determinística. Em `Está caro, vou pensar`, a objeção primária é `PRICE`, `INDECISION` permanece nos sinais e WAIT é representado separadamente.

### WAITING_FOR_CUSTOMER — CRM-012

WAIT consolidado para `Vou pensar`, `vou ver`, `te aviso` e `vou conversar e te falo`. Perguntas de preço, agenda, pagamento e desconto não são WAIT.

Conversation State pode representar simultaneamente objeção e espera. Sales Strategy dá precedência a `WAIT_FOR_CUSTOMER`, retorna `NO_ACTION` e não sugere nova ação. Não houve alteração de follow-up ou envio de mensagem.

### Integração observacional, riscos e rollback

Teste integrado demonstra `Conversation State → Sales Strategy → Lead Scoring → Pricing → Objection → Waiting`, produzindo somente objetos. Não há reply, efeito, persistência, log ou decisão de handoff.

Limitações comerciais ainda abertas:

- não existe fórmula aprovada para 4h, 5h ou outras durações;
- não existem regras determinísticas por tamanho, estilo, local, complexidade ou cobertura;
- não está definida a fronteira entre mínimo, sessão e orçamento artístico;
- parcelamento, desconto e exceções exigem política aprovada;
- o Prompt Engine legado ainda precisa migrar para a fonte canônica em fase separada;
- tipos e estratégias de objeção precisam de calibração com conversas reais.

Rollback: remover os dois módulos novos e seus testes, e restaurar apenas as ampliações puras de sinais/WAIT. Runtime não importa nenhum componente do pacote.

Suíte final: `827/827`.

## CRM-008 — IMAGE CONTEXT ESTRUTURADO

**Status:** `APROVADO` em shadow mode em 2026-08-12. Não existe consumidor no runtime nem chamada nova de análise visual.

### Contrato e fronteiras

`buildImageContext({ hasImage, analysis })` recebe uma análise já disponível e retorna estrutura sanitizada com `hasReference`, `tattooStyle`, `bodyPlacementShown`, `composition`, `visualElements`, `colorProfile`, `complexity`, `approximateScale`, `coverageType`, `observations`, `uncertainties` e `copyIntent`.

Campos desconhecidos permanecem `{ value: null, confidence: null, source: null }`. As únicas origens visuais aceitas são `image_observation` e `model_inference`; inferência de modelo declarada como `high` é reduzida para `medium`. O módulo não aceita nem calcula preço, horas ou sessões.

`copyIntent` permanece `null`: receber referência visual não significa pedido de cópia. O módulo também não gera texto, recomendação artística, buying signal, stage ou decisão de handoff.

### Precedência e integração observacional

A precedência registrada em Collected Facts é:

`CUSTOMER_EXPLICIT > CUSTOMER_CONFIRMED > EXISTING_FACT > IMAGE_OBSERVATION > MODEL_INFERENCE`.

Imagem pode marcar `referenceReceived`/`imageReceived` e preencher `tattooStyle` quando o fato ainda estiver ausente. Texto explícito posterior do cliente prevalece. `bodyPlacementShown` nunca alimenta `bodyLocation`: o primeiro descreve o que aparece na referência; o segundo representa o local desejado pelo cliente.

Conversation State aceita `imageContext` pronto ou `imageAnalysis`/`hasImage`, além de reconhecer mídia de imagem no histórico. A propriedade nova é aditiva e preserva chamadas anteriores.

### CASE-001, riscos e rollback

No CASE-001, a imagem é referência religiosa com estilo provável `black and grey / realismo`; elementos visuais só entram quando fornecidos pela análise. `Braço fechado` permanece `bodyLocation` com origem `customer_explicit`. Não há handoff, R$850, horas ou sessões; Pricing retorna `HUMAN_REVIEW_REQUIRED` e Sales Strategy continua fora de handoff.

Limitações: esta fase estrutura dados fornecidos, mas não implementa nem valida um analisador visual em produção. Qualidade, privacidade, vocabulário controlado e calibração de confiança continuam pendentes antes de integração operacional.

Rollback: remover `modules/image/imageContext.js` e seus testes, e retirar somente os parâmetros/propriedade aditivos de Conversation State e a leitura observacional em Collected Facts. Runtime permanece intacto.

Suíte completa: `840/840`.

## CRM-009 — AUDIO RELIABILITY

**Status:** `EM TESTE` em 2026-08-12, após `AUDITANDO → EM DESENVOLVIMENTO → EM TESTE`. Implementação isolada em shadow mode; nenhuma integração com webhook, Meta, Azure, banco, prompt ou resposta ao cliente.

### Audio Context e regra de segurança

`modules/audio/audioContext.js` define um contrato puro com `received`, `downloadStatus`, `declaredMimeType`, `detectedMimeType`, `transcriptionStatus`, `transcript`, `errorCode`, `retryable`, `safeForConversation` e `source`.

Download usa `NOT_ATTEMPTED`, `SUCCESS` ou `FAILED`. Transcrição usa `NOT_ATTEMPTED`, `SUCCESS`, `FAILED`, `EMPTY` ou `UNSUPPORTED`. Ausência e falha permanecem explícitas; nenhum valor comercial é inferido.

A regra absoluta é aplicada por `getSafeAudioTranscript(audioContext)`: somente transcrição não vazia com status `SUCCESS` e `safeForConversation=true` produz texto. Qualquer falha retorna `null`. Assim, erro técnico não vira mensagem do cliente e não fornece texto válido para Signals, Facts, Stage, Lead Score, Sales Strategy, Pricing ou Handoff.

### BUG-AUDIO-001

**Status:** `PROTEGIDO POR TESTE / NÃO CORRIGIDO NO RUNTIME`.

O runtime atual ainda contém dois caminhos capazes de substituir falha ou transcrição vazia por `quero fazer uma tatuagem`: `services/ai/openai.js` e `api/meta.js`. Eles não foram alterados nesta fase. Os testes novos demonstram o comportamento seguro esperado: `transcript=null`, `safeForConversation=false` e preservação dos stages anteriores `orcamento` e `agendamento`.

### MIME auditado

O caminho atual recebe o identificador da mídia pela Meta, baixa o conteúdo e sempre cria o arquivo enviado ao Azure como `audio.ogg` com `contentType: audio/ogg`. O MIME declarado pela Meta não é propagado, o MIME detectado a partir do conteúdo não é calculado e o MIME efetivamente usado no download não é registrado. Portanto, o runtime assume OGG sem comprovação.

O contrato shadow registra separadamente `declaredMimeType` e `detectedMimeType`, inclusive quando divergem. Proposta para uma fase de runtime: capturar o MIME declarado no webhook/metadata, validar o conteúdo baixado, preservar extensão compatível e registrar somente metadados técnicos seguros antes de enviar ao Azure. Nenhuma correção de MIME foi aplicada agora.

### Retry policy

`isRetryableAudioError(error)` é pura e não executa loop. Timeout, erro temporário, HTTP 429, HTTP 5xx e falha temporária de download são retryable. Arquivo/transcrição vazia, formato não suportado, mídia inválida e demais HTTP 4xx são non-retryable.

### Testes, limites e rollback

AUDIO-001 a AUDIO-010 cobrem sucesso, download, Azure, vazio, MIME divergente, preservação de `orcamento`/`agendamento`, fechamento, espera e texto normal de tattoo. Há teste adicional de downstream safety para todas as camadas futuras listadas.

Esta fase não mede produção, não adiciona retry automático, não registra conteúdo de áudio e não altera `api/meta.js` ou `services/ai/openai.js`. O bug permanece operacional até uma integração futura autorizada.

Rollback: remover `modules/audio/audioContext.js`, `tests/audio/`, esta seção e as entradas correspondentes no checklist. Não há consumidor de runtime.

Testes de áudio: `13/13`. Suíte oficial completa: `853/853`.

## CRM-010 — STRUCTURED LEAD MEMORY

**Status:** `APROVADO` em 2026-08-12, após `PENDENTE → EM DESENVOLVIMENTO → EM TESTE → APROVADO`. O módulo é puro, observacional e não possui consumidor no runtime.

### Auditoria da memória atual

`services/ai/memory.js` chama `buscarHistoricoRecente(phone, limit)` com limite padrão de 4. O repositório consulta Supabase em ordem decrescente e seleciona somente `role, content`; o formatador inverte a lista e entrega `{ role, content }` ao chat. MIME, mídia, confiança, fonte, facts, stage e objetivos não fazem parte desse histórico.

Conversation State consegue receber `previousFacts`, mas somente quando o chamador os fornece explicitamente. Collected Facts copia os valores conhecidos para a próxima avaliação em memória de processo; não há persistência dessa estrutura nem reconstrução automática entre requisições. Com isso, fatos anteriores às quatro mensagens, provenance, correções, WAIT, contexto visual e distinção entre declaração e inferência podem se perder entre interações ou após horas/dias.

### Contrato e merge

`modules/memory/leadMemory.js` define a versão 1 da memória com `identity`, `tattoo`, `commercial`, `objections`, `conversation`, `provenance` e `updatedAt`. `mergeLeadMemory(previousMemory, conversationState)` retorna uma nova estrutura, sem mutar as entradas e sem usar relógio ou efeitos externos.

Valores `null` não apagam conhecimento. Informação nova substitui a anterior somente com precedência igual ou maior; isso permite correção explícita posterior do cliente e impede que observação de imagem ou inferência sobrescreva declaração explícita. Listas de objeções, elementos e notas são acumuladas sem duplicação.

Provenance por caminho usa a precedência já aprovada:

`CUSTOMER_EXPLICIT > CUSTOMER_CONFIRMED > EXISTING_FACT > IMAGE_OBSERVATION > MODEL_INFERENCE`.

Origens legadas de Facts são normalizadas para essa taxonomia. Inferência continua identificada como inferência e nunca é promovida automaticamente.

### Qualificação, preço e estado conversacional

`getMissingQualification(memory)` retorna somente os caminhos ainda desconhecidos entre nome, intenção, referência, estilo, local, tamanho e primeira tattoo. Não gera mensagem nem controla estratégia.

Preço e horas entram apenas quando o Fact possui fonte explícita/confirmada. A memória não calcula, interpola ou consulta Pricing. R$850 pode ser lembrado se a conversa disser explicitamente `Fica R$850`, mas não vira regra comercial.

WAIT é persistido para `vou pensar`, `te aviso` e equivalentes. Uma interação posterior real limpa apenas o estado de espera e preserva os demais fatos. Pedido humano explícito pode marcar `humanRequested=true`, sem decidir ou executar handoff.

### Image Context, Audio Context e CASE-001

Image Context pode fornecer estilo, cobertura, elementos, resumo e notas com provenance visual. `bodyPlacementShown` não alimenta `bodyLocation`; o local desejado continua dependendo do cliente.

Se `audioContext.received=true` e `safeForConversation=false`, o merge retorna a memória anterior sem atualização. Transcrição segura pode ser processada por Conversation State e então contribuir como texto real.

No CASE-001, a memória final sabe `Allef`, intenção de tattoo, referência recebida, `braço fechado` e estilo observado quando fornecido pelo Image Context. Permanecem ausentes preço, horas, sessões, pagamento, agenda e primeira tattoo. Não existe campo ou decisão de handoff, intenção de cópia ou regra R$850.

### Limites e rollback

Não foram alterados `services/ai/memory.js`, Conversation State, Collected Facts, Signals, webhook, Supabase, schema, Prompt, Pricing, Stage, Handoff, Sales Strategy ou OpenAI runtime. Persistência física e integração entre requisições exigem fase posterior autorizada.

Rollback: remover `modules/memory/leadMemory.js`, `tests/memory/` e esta documentação. Nenhum runtime depende do módulo.

Testes de memória: `18/18`. Suíte oficial completa: `871/871`.

## CRM-011 — CONTEXT & NON-REPETITION

**Status:** `APROVADO` em 2026-08-12, após `PENDENTE → EM DESENVOLVIMENTO → EM TESTE → APROVADO`. Implementação somente em shadow mode, sem consumidor no runtime.

### Arquitetura e contrato

`modules/conversation/contextPolicy.js` consome Lead Memory, Conversation State e o resultado de Sales Strategy. `evaluateContextPolicy({ memory, conversationState, salesStrategy })` retorna `knownFacts`, `missingFacts`, `blockedQuestions`, `nextFact`, `shouldAsk`, `shouldWait`, `decision` e `reason`. Não retorna reply, prompt ou decisão executável de handoff.

Decisões possíveis: `ASK_NEXT_FACT`, `CLARIFY_FACT`, `CLARIFY_PREVIOUS_RESPONSE`, `CONTINUE_SALES`, `WAIT`, `NO_QUESTION` e `HUMAN_REVIEW`.

### Known facts, non-repetition e incerteza

A política opera por chaves semânticas: `NAME`, `TATTOO_INTENT`, `REFERENCE`, `STYLE`, `BODY_LOCATION`, `SIZE` e `FIRST_TATTOO`. Fato explícito, confirmado ou existente com confiança suficiente bloqueia nova pergunta equivalente. A política não depende de frases literais.

Intenção de tattoo e referência recebida são eventos binários confiáveis quando registrados com confiança alta, mesmo que o pipeline legado normalize sua origem como análise/observação. Já estilo, local e demais atributos provenientes apenas de imagem ou inferência continuam disponíveis para confirmação e não são bloqueados automaticamente.

Correção explícita posterior usa o valor atual da Lead Memory. Assim, `panturrilha` substitui `braço` e perguntas futuras não devem confirmar o valor antigo.

### Próximo fato e prioridade da intenção atual

A política escolhe no máximo um próximo fato. A prioridade de qualificação é nome, intenção, referência, local, tamanho, primeira tattoo e estilo; valores já estáveis são ignorados. Se existe valor incerto, a decisão pode ser `CLARIFY_FACT` em vez de repetir coleta.

A intenção atual prevalece sobre qualificação secundária. Pedido de preço, agenda, pagamento, objeção ou humano resulta em continuação da estratégia/revisão correspondente, com `shouldAsk=false` e `nextFact=null`. Structured Context não executa handoff.

### WAIT, retomada, `??` e follow-up futuro

WAIT retorna `shouldAsk=false`, `shouldWait=true` e decisão `WAIT`. Quando o cliente retorna com intenção válida, como `quero marcar`, a Lead Memory limpa WAIT e a policy prioriza agenda sem reiniciar perguntas de referência ou tamanho.

Uma entrada composta somente por `??` retorna `CLARIFY_PREVIOUS_RESPONSE`; não é interpretada como nova qualificação. O contrato permite que follow-up futuro consulte `blockedQuestions` e evite pedir novamente nome, ideia, referência, local ou tamanho já conhecidos, embora o follow-up de produção não tenha sido alterado.

### CASE-001, limites e rollback

No CASE-001, `NAME`, `TATTOO_INTENT`, `REFERENCE` e `BODY_LOCATION` aparecem como conhecidos. `NAME`, `REFERENCE` e `BODY_LOCATION` estão bloqueados; `SIZE` é o único próximo fato. `Braço fechado` não cria decisão de handoff.

Não foram alterados webhook, Prompt Engine, follow-up, banco, dashboard, Pricing, Handoff, Stage, Sales Strategy ou serviços de IA. Rollback: remover o módulo, os dois testes e esta seção documental.

Testes de Context Policy: `20/20`. Suíte oficial completa: `891/891`.

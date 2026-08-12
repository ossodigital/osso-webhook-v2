# CRM Master Checklist

## Regras

Status permitidos:

- `PENDENTE`
- `AUDITANDO`
- `EM DESENVOLVIMENTO`
- `EM TESTE`
- `APROVADO`
- `PRODUÇÃO`
- `BLOQUEADO`

Os IDs são permanentes. Mudanças de status devem incluir evidência, responsável, data e referência de teste ou aprovação. Nenhum item pode avançar para `PRODUÇÃO` apenas porque o código foi escrito.

| ID | Iniciativa | Status | Critério de saída | Dependências/Riscos |
|---|---|---|---|---|
| CRM-001 | Proteger baseline atual | AUDITANDO | Fixtures e contratos do fluxo atual registrados; rollback confirmado | Working tree já possui alterações anteriores; ausência de testes conversacionais |
| CRM-002 | Auditar handoff | APROVADO | Gatilhos, casos reais e motivos de transição validados contra histórico | CASE-001 reproduzido; manter testes como baseline |
| CRM-003 | Separar stage/handoff | APROVADO | Classificação e decisão independentes, com compatibilidade dos stages atuais | 747/747 testes; 360 casos OLD vs NEW; efeitos do orquestrador intactos |
| CRM-004 | Memória estruturada | APROVADO | Fatos conhecidos extraídos sem repetir perguntas e sem alterar banco inicialmente | 766/766; estado paralelo, sem integração ao runtime |
| CRM-005 | Sales Strategy | APROVADO | Próximo objetivo comercial definido por contexto e testado | 780/780; shadow mode puro, sem integração ao runtime |
| CRM-006 | Lead Scoring | APROVADO | Score puro, auditável e sem handoff automático | 797/797; pesos iniciais ainda exigem calibração real |
| CRM-007 | Pricing Engine | APROVADO | Fonte única aprovada e estimativas dentro das regras | Shadow: somente mínimo, sinal e sessões exatas; demais casos exigem revisão |
| CRM-008 | Image Context | APROVADO | Análise visual alimenta memória e estratégia sem alterar Storage | 840/840; contexto estruturado apenas em shadow mode, sem analisador no runtime |
| CRM-009 | Audio Reliability | EM TESTE | Contrato puro protege falhas sem fabricar intenção; runtime ainda não corrigido | MIME, codec, Meta download, Azure endpoint e fallback |
| CRM-010 | Prompt Engine modular | PENDENTE | Composição modular equivalente ao prompt atual antes de seleção dinâmica | Ordem dos módulos e empacotamento no deploy |
| CRM-011 | Objection Engine | APROVADO | Objeções classificadas e tratadas sem pressão excessiva | Shadow: estratégias abstratas; calibração real pendente |
| CRM-012 | WAITING_FOR_CUSTOMER | APROVADO | Estado impede pressão repetitiva sem quebrar follow-up | Shadow: Strategy retorna NO_ACTION; runtime/follow-up intactos |
| CRM-013 | Coringa Examples | PENDENTE | Exemplos aprovados, anonimizados, versionados e recuperáveis | Dataset, privacidade e revisão humana |
| CRM-014 | Feedback supervisionado | PENDENTE | Fluxo de aprovação definido antes de alterar dashboard | UX, autorização, auditoria e persistência |
| CRM-015 | Agenda Engine | PENDENTE | Escopo e integração definidos sem assumir confirmação de agenda | Agenda futura, disponibilidade e handoff |
| CRM-016 | Fechamento/sinal | PENDENTE | Intenções de reserva e pagamento tratadas com segurança | Pricing, Agenda Engine e política comercial |
| CRM-017 | Analytics comercial | PENDENTE | Métricas e eventos definidos sem expor dados pessoais | Taxonomia de eventos e retenção |
| CRM-018 | Testes de regressão | EM DESENVOLVIMENTO | Texto, imagem, áudio, stage, handoff e operação cobertos | Stage/Handoff iniciado com 37 testes; demais áreas pendentes |
| CRM-019 | Shadow testing | PENDENTE | Atual e candidato comparados sem responder ao cliente | Versionamento do prompt e ambiente seguro |
| CRM-020 | Rollout controlado | PENDENTE | Feature flag, métricas, aprovação e rollback testados | Todos os itens críticos aprovados |

## Bugs registrados

| ID | Descrição | Status | Evidência |
|---|---|---|---|
| BUG-001 | Falso handoff para `Braço fechado` causado pela substring genérica `fechado` | CORRIGIDO EM TESTE | CASE-001 e 37/37 testes de Stage/Handoff aprovados; sem deploy |
| BUG-002 | Pergunta informativa `Quanto é o sinal?` causa handoff | REGISTRADO | Matriz A3; comportamento preservado, sem correção |
| BUG-003 | Pedidos explícitos por pessoa/alguém/tatuador não causam handoff | REGISTRADO | Matriz A3; comportamento preservado, sem correção |
| BUG-004 | Intenções equivalentes de agenda divergem entre `humano` e `agendamento` | REGISTRADO | Matriz A3; comportamento preservado, sem correção |
| BUG-005 | Gatilho humano de lead sem nome é sobrescrito por `captando_nome` | REGISTRADO | Fluxo causal de `api/meta.js`; sem correção |
| BUG-006 | `aceito` isolado pode causar falso handoff sem contexto comercial | REGISTRADO | Regra DS-02; sem correção |
| BUG-AUDIO-001 | Falha ou transcrição vazia pode virar artificialmente `quero fazer uma tatuagem` | PROTEGIDO POR TESTE / NÃO CORRIGIDO NO RUNTIME | AUDIO-002, AUDIO-003, AUDIO-004, AUDIO-006 e AUDIO-007; `api/meta.js` e `services/ai/openai.js` intactos |

## Mapa de fases

| Fase | Escopo | IDs | Status atual |
|---|---|---|---|
| A | Correções de base | CRM-001, CRM-002, CRM-018, BUG-001 | EM DESENVOLVIMENTO |
| A3 | Auditoria completa dos gatilhos de handoff | CRM-002, CRM-003, CRM-018, BUG-002–006 | APROVADO |
| B | Separação Stage/Handoff | CRM-003 | PENDENTE |
| C | Conversation State | CRM-004, CRM-005, CRM-006, CRM-012 | PENDENTE |
| D | Memória e Collected Facts | CRM-004 | PENDENTE |
| E | Prompt Engine modular | CRM-010, CRM-018 | PENDENTE |
| F | Sales Strategy | CRM-005, CRM-011, CRM-012, CRM-015, CRM-016 | PENDENTE |
| G | Pricing Engine | CRM-007 | PENDENTE |
| H | Lead Scoring | CRM-006, CRM-019 | PENDENTE |
| I | Objection Engine | CRM-011 | PENDENTE |
| J | Waiting for Customer | CRM-012 | PENDENTE |
| K | Image Context | CRM-008 | APROVADO |
| L | Audio Reliability | CRM-009, CRM-018 | EM TESTE |
| M | Coringa Sales Intelligence | CRM-013 | PENDENTE |
| N | Feedback supervisionado | CRM-014, CRM-017 | PENDENTE |
| O | Shadow Mode | CRM-019 | PENDENTE |
| P | Rollout controlado | CRM-020 | PENDENTE |

## Evidências iniciais

### CRM-001

- Branch atual auditada: `main`.
- HEAD auditado: `c58b410`.
- Tags: `crm-v1-stable`, `platform-before-refactor`.
- Backups: `backup-auth-v1`, `backup-platform-v1`.
- Check sintático existente: aprovado.
- Bloqueio parcial: working tree já estava sujo antes desta documentação.

### CRM-002

- Gatilhos atuais documentados em `CORINGA_SALES_INTELLIGENCE.md`.
- Efeito de `stage = humano` mapeado no controller.
- CASE-001 reproduzido: `Braço fechado` corresponde à substring genérica `fechado`.
- Cadeia causal comprovada por fixture e testes de caracterização.
- A segunda chamada do detector usa `userText`, não `reply`; `BUG-HANDOFF-SELF-DETECTION` foi investigado e não confirmado.
- Histórico integral de produção continua desejável como evidência operacional, mas não é necessário para reproduzir o defeito no código atual.
- BUG-001 corrigido em teste por detecção conservadora de intenção comercial.
- CRM-003 permanece `PENDENTE`; Stage e Handoff não foram separados.

### FASE A3 — HANDOFF AUDIT

- Status: `APROVADO` em 2026-08-10.
- Detector, prioridade das regras e dependência do stage anterior documentados.
- Cadeia causal de persistência, bloqueio da IA, substituição de reply, alertas, Takeover e Voltar IA documentada.
- 60 entradas únicas testadas com os stages anteriores `novo`, `curioso`, `quente`, `orcamento`, `agendamento` e `humano`.
- CASE-001 permanente e suíte Stage/Handoff em `378/378`.
- BUG-002 a BUG-006 registrados sem alteração de comportamento.
- Áudio e imagem avaliados somente quanto ao efeito em stage/handoff.
- `READY_FOR_CRM_003 = SIM`; ao fim da A3, CRM-003 permanecia `PENDENTE` até esta implementação autorizada.

### CRM-003

- Transição auditada: `PENDENTE → EM DESENVOLVIMENTO → EM TESTE → APROVADO` em 2026-08-10.
- Cinco módulos puros separam stage, sinais, candidatos, política e tradução legada.
- `stageDetector.js` permanece como fachada compatível; `api/meta.js` não foi alterado.
- 360 comparações OLD vs NEW cobrem toda a matriz A3 nos seis stages anteriores.
- Suíte Stage/Handoff: `747/747`; CASE-001 e BUG-001 protegidos.
- BUG-002 a BUG-006 preservados deliberadamente.
- Rollback restrito à fachada e aos módulos novos; nenhum banco, dashboard, autenticação ou schema foi alterado.

### CRM-004

- Transição: `PENDENTE → EM DESENVOLVIMENTO → EM TESTE → APROVADO` em 2026-08-10.
- Collected Facts e Conversation State implementados como funções puras e paralelas.
- Todos os 16 campos possuem `value`, `confidence` e `source`; ausências permanecem nulas.
- CASE-001 representa Allef, referência/imagem e `braço fechado` em `orcamento`, sem handoff e sem inventar preço/horas.
- Missing facts, objetivos e `waitingForCustomer` são apenas observacionais.
- Suíte completa: `766/766`; `api/meta.js`, prompt, memória atual, stage e política de handoff intactos.

### CRM-005

- Transição: `PENDENTE → EM DESENVOLVIMENTO → EM TESTE → APROVADO` em 2026-08-10.
- Sales Strategy pura consome Conversation State e retorna objetivo, ação, prioridade, motivo, próximo fato e flags sem gerar resposta.
- WAIT_FOR_CUSTOMER retorna nenhuma ação; buying signals nunca executam handoff.
- CASE-001 permanece em coleta/qualificação/estimativa e nunca vira candidato humano.
- `Quanto é o sinal?` resulta em `PAYMENT` com `shouldHandoff=false` nesta camada; BUG-002 a BUG-006 permanecem intactos na compatibilidade legada.
- Suíte completa: `780/780`; runtime, prompt, stage, handoff, banco e dashboard não alterados.

### CRM-006

- Transição: `PENDENTE → EM DESENVOLVIMENTO → EM TESTE → APROVADO` em 2026-08-10.
- Lead Scoring puro retorna somente score, level e breakdown integralmente auditável.
- Levels: `COLD 0–19`, `WARM 20–39`, `HOT 40–69`, `VERY_HOT 70–100`.
- Referência/imagem, reserva/agenda e pagamento/buying signal possuem deduplicação explícita.
- CASE-001 cresce `15 → 25 → 33 → 43 → 48`, sem handoff e sem inventar preço/horas.
- Waiting e objeções não reduzem score; pedido humano não acrescenta pontos.
- Suíte completa: `797/797`; scorer sem consumidor de runtime, banco ou dashboard.

### PACOTE A — CRM-007 / CRM-011 / CRM-012

- Aprovado em shadow mode em 2026-08-10 com `827/827` testes.
- CRM-007 centraliza mínimo R$150, 3h R$650, 6h R$1.200 e sinal R$100 no novo engine.
- Durações sem valor oficial e projetos artísticos retornam `HUMAN_REVIEW_REQUIRED`; nenhuma interpolação foi criada.
- CASE-001 exige revisão humana e não transforma R$850 em regra.
- CRM-011 classifica oito tipos de objeção e retorna apenas estratégia abstrata.
- CRM-012 consolida WAIT e permite coexistência com objeção; Sales Strategy retorna `NO_ACTION`.
- Pipeline observacional integrado não gera mensagem, não persiste e não executa handoff.
- Dívida explícita: o Prompt Engine mantém cópia legada dos preços até migração futura autorizada.

### CRM-009

- Download Meta, transcrição Azure, persistência e fallback mapeados.
- Riscos iniciais: MIME forçado, possível divergência de endpoint e fallback semanticamente incorreto.
- Transição nesta fase: `AUDITANDO → EM DESENVOLVIMENTO → EM TESTE` em 2026-08-12.
- `Audio Context` e política pura de retry implementados somente em shadow mode, sem consumidor no runtime.
- BUG-AUDIO-001 protegido pelos casos AUDIO-001 a AUDIO-010, mas não corrigido em `api/meta.js` ou `services/ai/openai.js`.
- Testes de áudio: `13/13`; suíte oficial completa: `853/853`.
- Pendente: integração explícita ao runtime, logs correlacionados e amostras anonimizadas de áudio que falharam.

### CRM-008

- Transição: `PENDENTE → EM DESENVOLVIMENTO → EM TESTE → APROVADO` em 2026-08-12.
- `Image Context` puro representa referência, estilo, local mostrado, composição, elementos, perfil de cor, complexidade, escala aproximada, cobertura, observações e incertezas.
- Valores desconhecidos permanecem `null`; inferência de modelo não pode receber confiança `high` automaticamente.
- Precedência documentada: `CUSTOMER_EXPLICIT > CUSTOMER_CONFIRMED > EXISTING_FACT > IMAGE_OBSERVATION > MODEL_INFERENCE`.
- `bodyPlacementShown` descreve somente a referência e nunca preenche `bodyLocation`, que permanece o local desejado informado pelo cliente.
- Imagem pode registrar recebimento da referência e preencher estilo observacional quando ausente, sem criar preço, horas, sessões, buying signal, intenção de cópia ou handoff.
- CASE-001 mantém `braço fechado` com origem do cliente, estilo provável em contexto visual e Pricing em `HUMAN_REVIEW_REQUIRED`, sem R$850.
- Runtime, `api/meta.js`, prompt, Storage, banco, dashboard, Stage, Handoff e Lead Scoring de produção permanecem intactos.
- Suíte completa: `840/840`. Rollback restrito ao módulo, testes e parâmetros observacionais adicionados a Conversation State/Collected Facts.

## Gate obrigatório para qualquer mudança comportamental

- [ ] Baseline reproduzível.
- [ ] Caso real anonimizado.
- [ ] Teste que falha antes da correção.
- [ ] Escopo restrito ao módulo responsável.
- [ ] Sem alteração de webhook, persistência ou dashboard.
- [ ] Testes de regressão aprovados.
- [ ] Shadow test quando aplicável.
- [ ] Aprovação humana.
- [ ] Plano de rollback.
- [ ] Deploy separado e explicitamente autorizado.

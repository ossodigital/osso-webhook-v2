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
| CRM-003 | Separar stage/handoff | PENDENTE | Classificação e decisão independentes, com compatibilidade dos stages atuais | Dashboard, follow-up, alertas e bloqueio da IA |
| CRM-004 | Memória estruturada | PENDENTE | Fatos conhecidos extraídos sem repetir perguntas e sem alterar banco inicialmente | Qualidade do histórico e resolução de conflitos |
| CRM-005 | Sales Strategy | PENDENTE | Próximo objetivo comercial definido por contexto e testado | Stage, memória, pricing e objeções |
| CRM-006 | Lead Scoring | PENDENTE | Score puro, auditável e sem handoff automático | Definição e calibração de sinais |
| CRM-007 | Pricing Engine | PENDENTE | Fonte única aprovada e estimativas dentro das regras | Aprovação do Coringa; fórmula de horas/preço inexistente |
| CRM-008 | Image Context | PENDENTE | Análise visual alimenta memória e estratégia sem alterar Storage | Multimodal, privacidade e qualidade da descrição |
| CRM-009 | Audio Reliability | AUDITANDO | Causa das falhas identificada; métricas de cada etapa disponíveis | MIME, codec, Meta download, Azure endpoint e fallback |
| CRM-010 | Prompt Engine modular | PENDENTE | Composição modular equivalente ao prompt atual antes de seleção dinâmica | Ordem dos módulos e empacotamento no deploy |
| CRM-011 | Objection Engine | PENDENTE | Objeções classificadas e tratadas sem pressão excessiva | Exemplos aprovados e Sales Strategy |
| CRM-012 | WAITING_FOR_CUSTOMER | PENDENTE | Estado impede pressão repetitiva sem quebrar follow-up | Separação entre resposta imediata e follow-up futuro |
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

## Mapa de fases

| Fase | Escopo | IDs | Status atual |
|---|---|---|---|
| A | Correções de base | CRM-001, CRM-002, CRM-018, BUG-001 | EM DESENVOLVIMENTO |
| B | Separação Stage/Handoff | CRM-003 | PENDENTE |
| C | Conversation State | CRM-004, CRM-005, CRM-006, CRM-012 | PENDENTE |
| D | Memória e Collected Facts | CRM-004 | PENDENTE |
| E | Prompt Engine modular | CRM-010, CRM-018 | PENDENTE |
| F | Sales Strategy | CRM-005, CRM-011, CRM-012, CRM-015, CRM-016 | PENDENTE |
| G | Pricing Engine | CRM-007 | PENDENTE |
| H | Lead Scoring | CRM-006, CRM-019 | PENDENTE |
| I | Objection Engine | CRM-011 | PENDENTE |
| J | Waiting for Customer | CRM-012 | PENDENTE |
| K | Image Context | CRM-008 | PENDENTE |
| L | Audio Reliability | CRM-009, CRM-018 | AUDITANDO |
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

### CRM-009

- Download Meta, transcrição Azure, persistência e fallback mapeados.
- Riscos iniciais: MIME forçado, possível divergência de endpoint e fallback semanticamente incorreto.
- Pendente: logs correlacionados e amostras de áudio que falharam.

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

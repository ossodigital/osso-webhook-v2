# ETAPA 2 - RELATORIO

Data: 2026-06-06

Objetivo:
- extrair persistencia Supabase de `api/meta.js`;
- criar repositories para `leads` e `messages`;
- manter comportamento atual sem alterar dashboard, IA, prompts, handoff ou stage.

## 1. Funcoes migradas

### `services/supabase/leadsRepository.js`

Funcoes criadas:

- `buscarLeadPorTelefone(phone)`
  - substitui a busca de lead por telefone com `maybeSingle()`.

- `listarLeadsRecentes(limit = 50)`
  - substitui a listagem do debug `leads`.

- `upsertLead(leadPayload)`
  - substitui o upsert na tabela `leads` com `onConflict: "phone"`.

- `atualizarLeadPorTelefone(phone, updatePayload)`
  - substitui updates na tabela `leads` filtrando por `phone`.

### `services/supabase/messagesRepository.js`

Funcoes criadas:

- `inserirMensagem(messagePayload)`
  - substitui inserts na tabela `messages`.

- `listarMensagensRecentes(limit = 80)`
  - substitui a listagem do debug `messages`.

- `listarMensagensPorTelefone(phone, limit = 200)`
  - substitui a listagem do debug `messages-by-phone`.

- `buscarHistoricoRecente(phone, limit = 4)`
  - substitui a busca de historico recente usada antes da chamada da IA.

## 2. Linhas removidas de `api/meta.js`

Resultado do diff da etapa:

- `api/meta.js`: 58 linhas removidas.
- `api/meta.js`: 39 linhas adicionadas.

Observacao:
- as linhas adicionadas em `api/meta.js` sao imports dos repositories e chamadas de funcoes equivalentes;
- as queries diretas `supabase.from(...)` foram removidas de `api/meta.js`;
- os endpoints e fluxos seguem chamando as mesmas operacoes, agora via repository.

## 3. Riscos encontrados

### Risco: mudanca de retorno das queries

Controle aplicado:
- as funcoes dos repositories retornam diretamente o resultado do Supabase;
- `api/meta.js` continua usando destructuring no mesmo formato `{ data, error }` ou `{ error }`.

### Risco: alterar ordem ou limite das consultas

Controle aplicado:
- `listarLeadsRecentes(50)` preserva `order("created_at", { ascending: false })` e `limit(50)`;
- `listarMensagensRecentes(80)` preserva `order("created_at", { ascending: false })` e `limit(80)`;
- `listarMensagensPorTelefone(phone, 200)` preserva `order("created_at", { ascending: true })` e `limit(200)`;
- `buscarHistoricoRecente(phone, 4)` preserva `select("role, content")`, ordem descendente e `limit(4)`.

### Risco: quebrar handoff humano

Controle aplicado:
- a regra `existingLead?.stage === "humano"` nao foi alterada;
- a mensagem recebida durante atendimento humano continua sendo inserida;
- o lead continua sendo atualizado por telefone;
- o retorno `handoff_humano` nao foi alterado.

### Risco: alterar reset de follow-up

Controle aplicado:
- a montagem de `leadPayload` e `updatePayload` nao foi alterada;
- `followup_count` e `last_followup_at` continuam sendo definidos em `api/meta.js` como antes;
- apenas o envio do payload ao Supabase foi movido para repository.

### Risco: mexer em IA, prompt, audio ou imagem

Controle aplicado:
- prompt nao foi alterado;
- chamada Azure nao foi alterada;
- transcricao de audio nao foi alterada;
- processamento de imagem nao foi alterado;
- stage detector nao foi alterado.

## 4. Validacao

Comandos executados:

- `node --check api/meta.js`
- `node --check services/supabase/leadsRepository.js`
- `node --check services/supabase/messagesRepository.js`

Resultado:
- todos passaram.

Busca de confirmacao:
- `api/meta.js` nao possui mais chamadas diretas `supabase.from(...)`;
- as referencias diretas a tabelas `leads` e `messages` ficaram nos repositories.

## 5. Proximos passos

Proximo passo tecnico recomendado:
- extrair memoria da IA para `services/ai/memory.js`, usando `buscarHistoricoRecente()` como base.

Proximo passo de arquitetura:
- manter `api/meta.js` como controller;
- continuar removendo responsabilidades em blocos pequenos;
- nao alterar prompt ou comportamento da IA na proxima etapa, salvo tarefa explicita.

Proximo passo SaaS:
- quando os repositories estiverem estaveis, preparar evolucao futura para `company_id`;
- manter queries concentradas nos repositories para facilitar multiempresa e analytics.

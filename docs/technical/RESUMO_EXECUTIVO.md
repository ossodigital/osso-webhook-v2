# RESUMO EXECUTIVO

Data: 2026-06-06

Fontes:
- `docs/technical/MAPA_ATUAL_V2.md`
- `docs/technical/INVENTARIO_MODULOS.md`
- `docs/technical/PLANO_MIGRACAO.md`

Escopo:
- consolidar a decisao tecnica de migracao;
- apontar prioridade de negocio;
- orientar os proximos passos sem alterar codigo.

## 1. Qual modulo deve ser extraido primeiro

O primeiro modulo a ser extraido deve ser o client de WhatsApp/Meta.

Destino recomendado:
- `services/meta/whatsapp.js`

Responsabilidade inicial:
- envio de mensagens via Graph API;
- funcao equivalente a `enviarWhatsApp(phone, body)`;
- retorno padronizado com `ok`, `status` e `body`;
- logs de erro do envio WhatsApp.

Motivo:
- e uma fronteira tecnica clara;
- tem pouco acoplamento de regra de negocio;
- e usado por resposta ao cliente, teste admin e alerta admin;
- reduz risco de duplicacao antes de migrar handoff e admin alerts.

Observacao:
- a extracao deve preservar exatamente o comportamento atual antes de qualquer melhoria.

## 2. Qual modulo tem menor risco

O modulo com menor risco ja esta extraido:
- `modules/stages/stageDetector.js`

Entre os proximos modulos a extrair, o menor risco e:
- `services/meta/whatsapp.js`

Justificativa:
- possui entrada simples: telefone e texto;
- possui saida simples: status do envio;
- encapsula uma chamada externa especifica;
- nao precisa conhecer Supabase, prompt, stage, lead ou qualificacao.

Risco principal:
- quebrar envio de mensagem.

Controle:
- manter payload atual da Graph API;
- manter mesma assinatura;
- manter mesmo formato de retorno;
- validar com `node --check` apos a migracao futura.

## 3. Qual modulo traz maior ganho comercial

O modulo com maior ganho comercial e o de prompts/configuracao de IA.

Destino recomendado:
- `services/ai/prompts.js`

Por que traz maior ganho:
- permite adaptar o atendimento para outros nichos;
- separa regras comerciais do webhook;
- abre caminho para prompt por empresa;
- abre caminho para prompt por segmento;
- permite vender o sistema como produto configuravel, nao como automacao fixa.

Exemplos de ganhos comerciais:
- Tattoo e piercing podem ter funis proprios;
- clinicas podem ter outro tom e outras perguntas;
- prestadores de servico podem ter regras de orcamento diferentes;
- cada cliente SaaS pode ter identidade, oferta e regras especificas.

Observacao:
- apesar do alto ganho comercial, nao deve ser o primeiro modulo a migrar, porque mudancas em prompt alteram diretamente o comportamento da IA.

## 4. O que impede o sistema de virar SaaS hoje

O principal bloqueio e o acoplamento em `api/meta.js`.

Hoje, `api/meta.js` ainda concentra:
- atendimento WhatsApp;
- regras de handoff;
- alerta admin;
- prompt da IA;
- chamada Azure OpenAI;
- transcricao de audio;
- processamento de imagem;
- persistencia de leads;
- persistencia de mensagens;
- historico de conversa;
- qualificacao por nome;
- endpoints de debug.

Bloqueios especificos para SaaS:

### Falta de separacao por empresa

Ainda nao ha estrutura documentada/implementada para:
- `company_id`;
- configuracao por cliente;
- admins por empresa;
- prompts por empresa;
- funis por empresa.

### Prompt fixo no webhook

O prompt atual esta preso ao caso Tattoo Ate os Ossos.

Impacto:
- dificulta vender para outro nicho;
- dificulta onboarding de novos clientes;
- toda mudanca comercial exige mexer no arquivo central.

### Persistencia acoplada

As queries de `leads` e `messages` ainda estao dentro dos endpoints.

Impacto:
- dificulta multiempresa;
- dificulta analytics;
- dificulta dashboard evoluir;
- dificulta controle de historico por cliente.

### Handoff ainda misturado com stage

Parte do handoff esta em `stageDetector`, parte em `api/meta.js`.

Impacto:
- aumenta risco de IA responder depois do atendimento humano;
- dificulta takeover manual;
- dificulta regras diferentes por cliente.

### IA sem camada propria

Os arquivos em `services/ai/` existem, mas estao vazios.

Impacto:
- custo, modelo, prompt e memoria ainda nao sao controlaveis por cliente;
- trocar modelo ou nicho exige mexer no webhook;
- limita criacao de planos SaaS.

## 5. Plano de execucao em 5 etapas

### Etapa 1: extrair integracoes Meta basicas

Objetivo:
- separar envio WhatsApp e midia Meta do controller.

Modulos:
- `services/meta/whatsapp.js`;
- `services/meta/media.js`.

Inclui:
- envio de mensagem;
- obtencao de URL de midia;
- download de midia.

Ganho:
- reduz tamanho e risco de `api/meta.js`;
- prepara handoff, admin alerts, audio e imagem para migracao segura.

Risco:
- medio, porque afeta envio e midia.

### Etapa 2: extrair persistencia Supabase

Objetivo:
- tirar queries diretas dos endpoints.

Modulos:
- `services/supabase/leadsRepository.js`;
- `services/supabase/messagesRepository.js`.

Inclui:
- buscar lead por telefone;
- criar/atualizar lead;
- inserir mensagens;
- buscar historico;
- listar dados de debug.

Ganho:
- base para `company_id`;
- base para analytics;
- base para dashboard mais robusto;
- menor duplicacao entre endpoints.

Risco:
- medio, porque envolve dados reais e historico.

### Etapa 3: extrair IA sem mudar comportamento

Objetivo:
- mover prompt, memoria e chamadas Azure para `services/ai/`.

Modulos:
- `services/ai/memory.js`;
- `services/ai/prompts.js`;
- `services/ai/openai.js`;
- `services/ai/media.js`.

Inclui:
- historico da conversa;
- prompt system atual;
- chamada Chat Completions;
- transcricao Whisper;
- payload multimodal de imagem.

Ganho:
- IA controlavel;
- caminho para prompt por nicho;
- caminho para troca de modelo;
- melhor controle de custo/token.

Risco:
- medio a alto, principalmente em prompt, audio e imagem.

### Etapa 4: extrair regras de negocio

Objetivo:
- mover qualificacao, handoff e alertas para modulos de dominio.

Modulos:
- `modules/qualification`;
- `modules/handoff`;
- `modules/adminAlerts`.

Inclui:
- captura de nome;
- regra de `captando_nome`;
- bloqueio de IA em atendimento humano;
- decisao de handoff;
- alerta para admin.

Ganho:
- funil mais claro;
- handoff mais seguro;
- regras reutilizaveis por nicho;
- base para takeover manual.

Risco:
- alto no handoff, porque uma falha pode deixar a IA responder quando humano deveria assumir.

### Etapa 5: preparar camada SaaS

Objetivo:
- transformar a arquitetura modular em produto multiempresa.

Inclui:
- introduzir `company_id`;
- criar configuracao por empresa;
- separar prompt por nicho/cliente;
- separar admins por empresa;
- preparar stages configuraveis;
- medir conversao no dashboard.

Ganho:
- sistema deixa de ser webhook unico;
- passa a ser plataforma replicavel;
- permite vender para diferentes nichos;
- cria base para planos, billing e white-label.

Risco:
- alto impacto, deve vir depois da estabilizacao modular.

## Decisao executiva

Sequencia recomendada:

1. WhatsApp/Meta client.
2. Supabase repositories.
3. IA e prompts.
4. Qualification, handoff e admin alerts.
5. Company settings e SaaS.

Resumo:
- primeiro movimento tecnico: extrair WhatsApp client;
- menor risco atual: manter/evoluir `stageDetector`, seguido de WhatsApp client;
- maior ganho comercial: prompts configuraveis por nicho/empresa;
- maior bloqueio SaaS: `api/meta.js` concentrar regras, IA, persistencia e integracoes;
- caminho correto: modularizar sem mudar comportamento, depois introduzir multiempresa.

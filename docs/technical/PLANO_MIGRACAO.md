# PLANO DE MIGRACAO

Data: 2026-06-06

Fontes:
- `docs/technical/MAPA_ATUAL_V2.md`
- `docs/technical/INVENTARIO_MODULOS.md`

Escopo:
- documentar a migracao tecnica do `api/meta.js` para uma arquitetura modular;
- priorizar estabilidade operacional;
- preparar base para SaaS;
- nao propor mudanca de codigo neste documento.

## 1. O que ainda esta preso em `api/meta.js`

`api/meta.js` ainda concentra a maior parte do sistema.

### Entrada e controle HTTP

Ainda esta em `api/meta.js`:
- handler principal da rota;
- validacao de metodo `GET` e `POST`;
- verificacao do webhook Meta via `hub.verify_token`;
- retorno `API META OK`;
- extracao da mensagem recebida em `req.body`.

Este bloco pode permanecer no controller.

### Debug e dashboard token

Ainda esta em `api/meta.js`:
- `validarDashboardToken(req)`;
- debug `ping`;
- debug `admin-test`;
- debug `leads`;
- debug `messages`;
- debug `messages-by-phone`.

Risco atual:
- mistura operacao, dashboard, seguranca e webhook no mesmo arquivo.

### WhatsApp / Meta Graph API

Ainda esta em `api/meta.js`:
- `enviarWhatsApp(phone, body)`;
- envio de resposta ao cliente;
- envio de teste para admin;
- envio de alerta admin;
- obtencao de URL de midia com `getMediaUrl(mediaId)`;
- download de midia com `downloadMedia(url)`.

Risco atual:
- qualquer mudanca no envio WhatsApp pode afetar atendimento, handoff e debug ao mesmo tempo.

### Handoff humano

Ainda esta em `api/meta.js`:
- bloqueio de IA quando `existingLead.stage === "humano"`;
- `extrairTextoBasicoMensagem(msg)`;
- persistencia de mensagem recebida durante atendimento humano;
- atualizacao de `last_message`;
- retorno `handoff_humano`;
- resposta especial quando `newStage === "humano"`;
- chamada para `alertarAdminLeadHumano()`.

Parte dos gatilhos esta em:
- `modules/stages/stageDetector.js`.

Risco atual:
- a decisao de handoff esta misturada com stage, persistencia, resposta da IA e alerta admin.

### Admin alerts

Ainda esta em `api/meta.js`:
- `getAdminPhones()`;
- `alertarAdminLeadHumano({ leadName, phone, userText, stage })`;
- montagem da mensagem enviada ao admin;
- loop de envio para multiplos admins.

Risco atual:
- regra operacional critica fica presa ao webhook principal.

### Qualificacao e captura de nome

Ainda esta em `api/meta.js`:
- `extrairNome(userText)`;
- regra de `captando_nome`;
- decisao de pedir nome quando `leadName` esta vazio;
- resposta fixa pedindo nome;
- alteracao de `leadPayload.stage` para `captando_nome`.

Risco atual:
- a qualificacao do lead fica misturada com persistencia, stage e IA.

### IA e prompt

Ainda esta em `api/meta.js`:
- prompt system completo;
- regras de tom;
- regras de Instagram;
- regras de orcamento;
- regras de agendamento;
- regra conversacional de handoff;
- montagem de `conversationHistory`;
- montagem de `userContent`;
- chamada Azure Chat Completions;
- leitura da resposta da Azure;
- fallback de resposta;
- sanitizacao quando a IA retorna link ou `instagram.com`.

Risco atual:
- qualquer ajuste de prompt exige mexer no arquivo central do webhook;
- dificil reutilizar o mesmo motor em outro nicho ou empresa.

### Audio, imagem e midia

Ainda esta em `api/meta.js`:
- deteccao de mensagem de audio;
- transcricao com `transcreverAudio(mediaId)`;
- chamada Azure Whisper;
- deteccao de mensagem de imagem;
- download da imagem;
- conversao para base64;
- montagem do payload multimodal;
- fallback textual quando imagem falha.

Risco atual:
- integra Meta, Azure, buffer binario, prompt e fallback dentro do mesmo arquivo.

### Supabase e persistencia

Ainda esta em `api/meta.js`:
- busca de lead por telefone;
- upsert de lead;
- update de lead;
- insert de mensagem do usuario;
- insert de mensagem da assistente;
- busca de historico;
- listagem de leads para debug;
- listagem de mensagens para debug;
- listagem de mensagens por telefone.

Risco atual:
- queries, regras de negocio e fluxo HTTP ficam acoplados.

## 2. O que ja esta modularizado

### Stage detector

Arquivo:
- `modules/stages/stageDetector.js`

Status:
- implementado;
- importado por `api/meta.js`;
- sem dependencias externas.

Responsabilidade:
- classificar texto do usuario em stages;
- retornar `curioso`, `humano`, `quente`, `agendamento`, `orcamento`, `novo` ou preservar stage existente.

Ganho ja obtido:
- primeira regra de negocio saiu do controller;
- stage ja pode evoluir separadamente com menor risco.

### Supabase client

Arquivo:
- `services/supabase/client.js`

Status:
- implementado;
- usado por `api/meta.js`.

Responsabilidade:
- criar e exportar o client Supabase usando `config/env.js`.

Ganho ja obtido:
- conexao Supabase foi separada da rota principal;
- reduz repeticao de `createClient` em partes que usarem esse client.

Limite atual:
- queries continuam dentro dos endpoints;
- `api/followup.js` e `api/test-supabase.js` ainda criam client proprio fora desse modulo.

### Estrutura de IA

Arquivos:
- `services/ai/openai.js`
- `services/ai/prompts.js`
- `services/ai/memory.js`
- `services/ai/media.js`

Status:
- arquivos existem;
- ainda vazios.

Ganho ja obtido:
- destino arquitetural ja esta definido;
- facilita migracao incremental da IA sem redesenhar a arvore.

## 3. Ordem ideal de migracao

### Etapa 1: estabilizar contratos existentes

Objetivo:
- documentar e preservar comportamento atual antes de mover codigo.

Escopo:
- contrato de `detectarStage(userText, existingStage)`;
- lista de stages validos;
- payloads das tabelas `leads` e `messages`;
- respostas HTTP importantes;
- textos criticos de handoff e captura de nome.

Resultado esperado:
- base segura para comparar comportamento antes e depois.

### Etapa 2: extrair WhatsApp client

Destino provavel:
- `services/meta/whatsapp.js`

Mover conceitualmente:
- `enviarWhatsApp(phone, body)`;
- envio de resposta ao cliente;
- envio de mensagem de teste admin;
- envio usado por alerta admin.

Motivo da prioridade:
- e uma integracao externa clara;
- tem fronteira simples;
- reduz repeticao futura.

### Etapa 3: extrair Meta media

Destino provavel:
- `services/meta/media.js`

Mover conceitualmente:
- `getMediaUrl(mediaId)`;
- `downloadMedia(url)`;
- download de audio;
- download de imagem.

Motivo da prioridade:
- separa Meta Graph API de IA;
- deixa audio e imagem mais testaveis.

### Etapa 4: extrair repositories Supabase

Destino provavel:
- `services/supabase/leadsRepository.js`;
- `services/supabase/messagesRepository.js`.

Mover conceitualmente:
- buscar lead por telefone;
- upsert/update de lead;
- insert de mensagens;
- historico de mensagens;
- listagens de debug.

Motivo da prioridade:
- persistencia e um eixo central para SaaS;
- repositories serao base para `company_id`, multiempresa e analytics.

### Etapa 5: extrair memoria da IA

Destino:
- `services/ai/memory.js`

Mover conceitualmente:
- busca de historico;
- ordenacao;
- limite de mensagens;
- conversao para formato `{ role, content }`.

Motivo da prioridade:
- prepara a IA para usar repositories;
- reduz acoplamento entre conversa e controller.

### Etapa 6: extrair prompts

Destino:
- `services/ai/prompts.js`

Mover conceitualmente:
- prompt system;
- regras de Instagram;
- regras de orcamento;
- regras de agendamento;
- regras de tom;
- instrucao de handoff;
- sanitizacao anti-link.

Motivo da prioridade:
- SaaS precisa de prompts configuraveis por nicho;
- prompt separado permite evolucao comercial sem mexer no webhook.

### Etapa 7: extrair Azure OpenAI e Whisper

Destino:
- `services/ai/openai.js`

Mover conceitualmente:
- chamada Chat Completions;
- tratamento da resposta;
- fallback;
- chamada Whisper;
- configuracoes Azure e api-version.

Motivo da prioridade:
- encapsula custo, modelo, deployment e provider;
- facilita trocar ou parametrizar IA no futuro.

### Etapa 8: extrair IA media

Destino:
- `services/ai/media.js`

Mover conceitualmente:
- conversao de imagem para base64;
- montagem de payload multimodal;
- fallback de imagem;
- texto de instrucao para analise de referencia.

Motivo da prioridade:
- imagem e audio sao fluxos de maior risco;
- deve vir depois de Meta media e OpenAI estarem separados.

### Etapa 9: extrair qualification

Destino provavel:
- `modules/qualification`.

Mover conceitualmente:
- `extrairNome(userText)`;
- regra de `captando_nome`;
- decisao de pedir nome;
- definicao da proxima pergunta obrigatoria.

Motivo da prioridade:
- qualificacao e regra de negocio pura;
- abre caminho para funis por nicho.

### Etapa 10: extrair handoff

Destino provavel:
- `modules/handoff`.

Mover conceitualmente:
- bloqueio de IA;
- decisao de handoff;
- motivo do handoff;
- tratamento de mensagens recebidas durante atendimento humano.

Motivo da prioridade:
- handoff e critico para operacao;
- deve migrar quando stage, persistence e WhatsApp ja estiverem mais isolados.

### Etapa 11: extrair admin alerts

Destino provavel:
- `modules/adminAlerts` ou `services/meta/adminAlerts`.

Mover conceitualmente:
- `getAdminPhones()`;
- `alertarAdminLeadHumano()`;
- mensagem de alerta;
- envio para multiplos admins.

Motivo da prioridade:
- depende de handoff e WhatsApp client;
- fica mais seguro migrar depois desses blocos.

### Etapa 12: reduzir `api/meta.js` para controller

Objetivo final:
- `api/meta.js` coordenar o fluxo;
- regras de negocio ficarem em `modules/`;
- integracoes ficarem em `services/`;
- persistencia ficar em repositories;
- IA ficar em `services/ai/`.

Resultado esperado:
- controller menor;
- menor risco de regressao;
- base real para SaaS.

## 4. Riscos de cada migracao

### Stage

Risco:
- baixo.

Possiveis problemas:
- mudar sem querer a classificacao de leads;
- alterar gatilhos de `humano`;
- quebrar preservacao de `existingStage`.

Controle:
- manter mesmos inputs e outputs;
- validar exemplos de texto para cada stage.

### WhatsApp client

Risco:
- medio.

Possiveis problemas:
- falha no envio de mensagens;
- retorno diferente de `{ ok, status, body }`;
- logs insuficientes;
- envio duplicado.

Controle:
- manter assinatura inicial;
- manter payload Graph API identico;
- migrar primeiro sem alterar comportamento.

### Meta media

Risco:
- medio.

Possiveis problemas:
- falha ao obter URL de midia;
- falha no download;
- perda de headers com token;
- problemas com buffer/binario.

Controle:
- separar obter URL e baixar midia;
- manter fallback atual em audio e imagem.

### Supabase repositories

Risco:
- medio.

Possiveis problemas:
- upsert incorreto;
- update sem filtro correto por telefone;
- historico em ordem errada;
- alteracao involuntaria em campos `followup_count` e `last_followup_at`.

Controle:
- uma query por funcao;
- manter nomes de tabela e campos;
- preservar filtros e ordenacoes.

### IA memory

Risco:
- baixo a medio.

Possiveis problemas:
- historico invertido;
- limite de mensagens diferente;
- formato invalido para a IA.

Controle:
- preservar `limit(4)`;
- preservar `reverse()`;
- preservar `{ role, content }`.

### Prompts

Risco:
- medio.

Possiveis problemas:
- mudanca no tom da IA;
- IA voltar a pedir nome;
- IA enviar links;
- IA errar Instagram;
- IA fazer perguntas demais;
- IA forcar agendamento cedo.

Controle:
- primeira migracao deve copiar comportamento atual;
- mudancas de prompt devem ser etapa separada.

### Azure OpenAI / Whisper

Risco:
- medio a alto.

Possiveis problemas:
- endpoint incorreto;
- api-version incorreta;
- headers errados;
- fallback nao acionado;
- aumento de custo/token;
- falha na transcricao.

Controle:
- preservar deployments e api-version;
- manter fallback de resposta e de audio;
- isolar logs de erro.

### IA media

Risco:
- alto.

Possiveis problemas:
- payload multimodal invalido;
- base64 mal formatado;
- imagem nao analisada;
- fallback sem contexto suficiente.

Controle:
- migrar depois de Meta media;
- manter texto de fallback;
- testar com imagem real antes de considerar pronto.

### Qualification

Risco:
- medio.

Possiveis problemas:
- pedir nome repetido;
- aceitar palavra invalida como nome;
- travar lead em `captando_nome`;
- pular qualificacao obrigatoria.

Controle:
- preservar lista de palavras invalidas;
- preservar regra de captura de nome;
- separar evolucao futura do funil.

### Handoff

Risco:
- alto.

Possiveis problemas:
- IA responder depois do handoff;
- admin nao ser alertado;
- alerta duplicado;
- lead nao mudar para `humano`;
- conversa humana nao ser registrada.

Controle:
- migrar depois de stage, WhatsApp e repositories;
- preservar condicao `existingLead.stage === "humano"`;
- preservar regra de alerta apenas na transicao para humano.

### Admin alerts

Risco:
- medio.

Possiveis problemas:
- telefone admin nao carregado;
- mensagem admin mudar formato;
- envio parcial para multiplos admins;
- falha silenciosa.

Controle:
- manter suporte a `ADMIN_PHONES` e `ADMIN_PHONE`;
- manter retorno por admin;
- manter logs quando admin nao estiver configurado.

### Controller final

Risco:
- medio.

Possiveis problemas:
- fluxo HTTP quebrado;
- ordem de operacoes alterada;
- respostas Meta diferentes;
- tratamento de erro geral inconsistente.

Controle:
- reduzir apenas depois das extracoes;
- manter respostas HTTP atuais;
- manter `try/catch` geral.

## 5. Ganhos de cada migracao

### Stage

Ganhos:
- regra de classificacao isolada;
- mais facil ajustar funil;
- base para stages configuraveis por nicho.

### WhatsApp client

Ganhos:
- envio padronizado;
- menos duplicacao;
- mais facil trocar versao da Graph API;
- mais facil criar envio manual pelo dashboard.

### Meta media

Ganhos:
- audio e imagem ficam menos acoplados ao webhook;
- melhor tratamento de erros;
- base para anexos em outros nichos.

### Supabase repositories

Ganhos:
- queries reutilizaveis;
- menor risco em alteracoes futuras;
- base para `company_id`;
- base para analytics;
- facilita testes e manutencao.

### IA memory

Ganhos:
- historico padronizado;
- controle de custo/token;
- base para memoria por lead e por empresa.

### Prompts

Ganhos:
- prompt editavel por nicho;
- regras comerciais centralizadas;
- menor risco ao ajustar tom;
- base para white-label e multiempresa.

### Azure OpenAI / Whisper

Ganhos:
- provider isolado;
- facilidade para trocar modelo;
- controle melhor de custo;
- logs centralizados;
- base para multiagente.

### IA media

Ganhos:
- imagem de referencia vira capacidade reutilizavel;
- melhor separacao entre baixar midia e analisar midia;
- base para nichos com imagem, documento ou audio.

### Qualification

Ganhos:
- funil mais claro;
- menos perguntas repetidas;
- base para funis diferentes por segmento;
- melhora conversao antes do orcamento.

### Handoff

Ganhos:
- operacao humana mais segura;
- IA bloqueada com regra clara;
- transicao para vendedor/admin fica auditavel;
- base para takeover manual no dashboard.

### Admin alerts

Ganhos:
- alerta reutilizavel;
- suporte melhor a multiplos admins;
- base para notificacoes por empresa;
- menor risco de perder lead quente.

### Controller final

Ganhos:
- `api/meta.js` menor e mais previsivel;
- manutencao mais rapida;
- menor risco de regressao;
- arquitetura pronta para crescer.

## 6. Prioridade de negocio para transformar em SaaS

### Prioridade 1: estabilidade do atendimento atual

Motivo:
- o sistema ja atende um caso real;
- antes de virar SaaS, nao pode perder lead, mensagem ou handoff.

Itens tecnicos ligados:
- WhatsApp client;
- Supabase repositories;
- handoff seguro;
- admin alerts.

Impacto de negocio:
- reduz risco operacional;
- aumenta confianca para vender o produto.

### Prioridade 2: persistencia preparada para multiempresa

Motivo:
- SaaS precisa separar clientes, empresas e bases de dados logicamente.

Itens tecnicos ligados:
- repositories de leads e messages;
- padronizacao de queries;
- futura introducao de `company_id`;
- historico por empresa.

Impacto de negocio:
- permite atender mais de uma operacao;
- evita reescrever tudo quando entrar o segundo cliente.

### Prioridade 3: prompts e funis configuraveis

Motivo:
- tattoo, piercing, clinicas e prestadores precisam de regras diferentes.

Itens tecnicos ligados:
- `services/ai/prompts.js`;
- `modules/qualification`;
- stages configuraveis;
- regras de preco/agendamento por nicho.

Impacto de negocio:
- transforma webhook unico em plataforma por segmento;
- aumenta valor percebido;
- permite onboarding mais rapido.

### Prioridade 4: handoff e takeover manual no dashboard

Motivo:
- SaaS operacional precisa permitir humano assumir conversas com seguranca.

Itens tecnicos ligados:
- `modules/handoff`;
- admin alerts;
- bloqueio de IA;
- endpoints futuros de takeover manual.

Impacto de negocio:
- reduz medo do cliente em usar IA;
- melhora conversao de leads quentes;
- cria diferencial comercial claro.

### Prioridade 5: IA desacoplada e controlavel

Motivo:
- custo, modelo e qualidade da IA precisam ser controlados por cliente e nicho.

Itens tecnicos ligados:
- `services/ai/openai.js`;
- `services/ai/memory.js`;
- `services/ai/media.js`;
- parametros de modelo;
- logs de erro.

Impacto de negocio:
- permite otimizar custo por cliente;
- facilita trocar modelo;
- abre caminho para planos diferentes.

### Prioridade 6: analytics e produto gerenciavel

Motivo:
- SaaS precisa mostrar valor, nao apenas responder mensagens.

Itens tecnicos ligados:
- repositories;
- stages confiaveis;
- timestamps padronizados;
- dashboard;
- metricas de conversao.

Impacto de negocio:
- permite demonstrar ROI;
- melhora vendas;
- cria base para billing e planos.

### Prioridade 7: modularizacao por nicho

Motivo:
- a plataforma precisa sair do caso Tattoo Ate os Ossos sem perder a inteligencia do laboratorio.

Itens tecnicos ligados:
- prompt por nicho;
- funil por nicho;
- pricing rules;
- business rules;
- company settings.

Impacto de negocio:
- viabiliza venda para clinicas, estudios, prestadores e empresas locais;
- transforma automacao custom em produto replicavel.

## Sequencia recomendada para SaaS

1. Preservar atendimento atual sem regressao.
2. Extrair WhatsApp client.
3. Extrair repositories Supabase.
4. Extrair prompt builder.
5. Extrair IA provider.
6. Extrair qualification.
7. Extrair handoff e admin alerts.
8. Preparar `company_id`.
9. Criar configuracao por empresa/nicho.
10. Medir funil e conversao no dashboard.

## Resumo executivo

O projeto ja tem dois blocos modularizados ou preparados:
- `modules/stages/stageDetector.js`;
- `services/supabase/client.js`;
- estrutura vazia em `services/ai/`.

O maior risco atual e `api/meta.js` continuar concentrando atendimento, IA, handoff, WhatsApp, Supabase e regras comerciais.

A migracao mais segura deve comecar por fronteiras tecnicas claras, como WhatsApp, Meta media e Supabase repositories. Depois disso, o projeto pode migrar prompt, IA, qualification e handoff com menor risco.

Para virar SaaS, a prioridade nao e apenas limpar codigo. A prioridade e separar persistencia, prompts, funis, handoff e configuracao por empresa, porque esses pontos determinam se o sistema pode atender varios clientes sem virar uma copia manual para cada um.

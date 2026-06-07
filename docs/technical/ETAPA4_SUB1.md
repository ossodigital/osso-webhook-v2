# ETAPA 4 - SUBETAPA 1

Data: 2026-06-07

Objetivo:
- extrair apenas regras de qualificacao;
- preservar comportamento atual;
- nao alterar WhatsApp, Supabase, OpenAI, Dashboard ou `stageDetector`.

## 1. Arquivos alterados

### Alterados

- `api/meta.js`
  - passou a importar `extrairNome` de `modules/qualification/qualificationRules.js`;
  - removeu a funcao local `extrairNome()`.

### Criados

- `modules/qualification/qualificationRules.js`
  - novo modulo de regras puras de qualificacao.

## 2. Regras extraidas

### Captura de nome

Funcao:
- `extrairNome(userText = "")`

Origem:
- antes estava em `api/meta.js`.

Destino:
- `modules/qualification/qualificationRules.js`.

Comportamento preservado:
- detecta frases como `meu nome e`, `me chamo`, `sou o`, `sou a`, `pode me chamar de`, `me chama de`;
- remove pontuacao simples apos o nome;
- rejeita palavras invalidas como saudacoes, preco, orcamento, tattoo e agendar;
- aceita nomes entre 2 e 40 caracteres;
- retorna `null` quando nao identifica nome valido.

### Identificacao de lead curioso

Funcao:
- `identificarLeadCurioso(userText = "")`

Destino:
- `modules/qualification/qualificationRules.js`.

Regra mapeada:
- identifica termos como `calote`, `golpe`, `zoeira`, `brincadeira`, `kkk`, `kkkk`.

Observacao:
- esta funcao foi extraida como regra pura de qualification;
- o fluxo atual ainda usa `stageDetector` para classificar `curioso`, preservando comportamento.

### Identificacao de lead quente

Funcao:
- `identificarLeadQuente(userText = "")`

Destino:
- `modules/qualification/qualificationRules.js`.

Regra mapeada:
- identifica termos como `pix`, `cartao`, `cartão`, `sinal`, `fechar`, `quero fazer`, `quero tatuar`, `vou fazer`, `vamos fazer`.

Observacao:
- esta funcao foi extraida como regra pura de qualification;
- o fluxo atual ainda usa `stageDetector` para classificar `quente`, preservando comportamento.

## 3. Linhas removidas de `api/meta.js`

Resultado da subetapa:

- 38 linhas removidas de `api/meta.js`;
- 1 linha adicionada de import em `api/meta.js`.

Remocao realizada:
- funcao local `extrairNome()`.

Nada foi removido de:
- handoff;
- WhatsApp;
- Supabase;
- OpenAI;
- processamento de audio;
- processamento de imagem;
- `stageDetector`.

## 4. Validacoes executadas

Comandos executados:

- `node --check api/meta.js`
- `node --check modules/qualification/qualificationRules.js`

Resultado:
- ambos passaram.

Comando obrigatorio solicitado:
- `node --check api/meta.js` passou.

Confirmacao pre-commit:
- `node --check api/meta.js` passou em 2026-06-07;
- `node --check modules/qualification/qualificationRules.js` passou em 2026-06-07;
- funcoes extraidas: `extrairNome`, `identificarLeadCurioso`, `identificarLeadQuente`;
- nao houve alteracao intencional de comportamento;
- `stageDetector`, Supabase, OpenAI, WhatsApp e Dashboard nao foram alterados nesta subetapa.

## 5. Dependencias preservadas

### `api/meta.js`

Continua responsavel por:
- decidir quando tentar capturar nome;
- verificar `existingLead?.stage === "captando_nome"`;
- recalcular stage com `detectarStage(userText, "novo")` quando nome e capturado;
- definir `leadPayload.stage = "captando_nome"` quando nao ha nome;
- salvar lead e mensagens;
- enviar pergunta de nome pelo WhatsApp.

### `stageDetector`

Nao foi alterado.

Continua responsavel por:
- classificar `curioso`;
- classificar `quente`;
- classificar `orcamento`;
- classificar `agendamento`;
- classificar `humano`.

### Supabase

Nao foi alterado.

Repositories continuam iguais:
- `buscarLeadPorTelefone()`;
- `upsertLead()`;
- `atualizarLeadPorTelefone()`;
- `inserirMensagem()`.

### WhatsApp

Nao foi alterado.

`enviarWhatsApp()` continua sendo usado da mesma forma.

## 6. Riscos encontrados

### Risco: mudar captura de nome

Controle:
- a funcao `extrairNome()` foi movida mantendo a mesma assinatura e regras.

### Risco: alterar classificacao quente/curioso

Controle:
- `stageDetector` nao foi alterado;
- as novas funcoes `identificarLeadQuente()` e `identificarLeadCurioso()` ainda nao substituem o fluxo de stage.

### Risco: pedir nome repetidamente

Controle:
- a logica que decide quando pedir nome permaneceu em `api/meta.js`;
- somente a funcao pura de extracao foi migrada.

### Risco: quebrar persistencia ou envio

Controle:
- Supabase e WhatsApp nao foram alterados nesta subetapa.

## 7. Impacto comercial da extracao

Esta subetapa comeca a separar o funil comercial da camada webhook.

Ganhos:
- captura de nome vira regra reutilizavel;
- qualificacao de lead comeca a sair do controller;
- abre caminho para funis por nicho;
- facilita adaptar criterios de lead quente/curioso para outros mercados;
- prepara futura configuracao SaaS por empresa sem mexer no webhook principal.

Impacto pratico:
- Tattoo, piercing, clinicas e prestadores poderao ter regras proprias de qualificacao no futuro;
- o sistema fica mais perto de vender atendimento inteligente como produto, nao apenas como webhook customizado.

## 8. Proximo passo recomendado

Proxima subetapa segura:
- extrair `extrairTextoBasicoMensagem(msg)` para modulo de handoff.

Motivo:
- e funcao pura;
- nao depende de Supabase;
- nao depende de WhatsApp;
- reduz risco antes de extrair regras de handoff reais.

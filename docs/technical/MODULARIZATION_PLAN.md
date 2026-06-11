# MODULARIZATION PLAN — OSSO WEBHOOK V2

Data: 2026-06-11

## Objetivo

Concluir a modularização do OSSO WEBHOOK V2 sem alterar o comportamento funcional do sistema em produção.

O objetivo desta etapa não é criar novas funcionalidades.

O objetivo é separar responsabilidades, reduzir acoplamento e preparar o sistema para se tornar o OSSO ENGINE V1.

---

## Princípio Principal

Preservar funcionamento antes de evoluir.

Nenhuma refatoração deve quebrar:

* Webhook Meta
* Envio WhatsApp
* Handoff Humano
* Captura de Leads
* Histórico
* Dashboard
* Áudio
* Imagem
* Supabase
* Azure OpenAI

---

## Estado Atual

O `api/meta.js` já foi parcialmente modularizado.

Já existem módulos e serviços para:

* Stages
* Qualification
* Handoff
* IA
* Memory
* Prompts
* Media IA
* WhatsApp
* Supabase Repositories

Ainda permanecem no controller:

* Admin Alerts
* Meta Media
* Dashboard Debug
* Orquestração principal

---

## Ordem Oficial de Modularização

### Etapa 1 — Admin Alerts

Criar:

* `services/meta/adminAlerts.js`

Mover:

* `getAdminPhones()`
* `alertarAdminLeadHumano()`

Validação:

* Envio de alerta para admin
* Nenhum alerta duplicado
* Lead humano continua funcionando

Risco:

Médio.

---

### Etapa 2 — Meta Media

Criar:

* `services/meta/media.js`

Mover:

* `getMediaUrl()`
* `downloadMedia()`

Validação:

* Imagem continua funcionando
* Áudio continua funcionando
* Token Meta continua centralizado

Risco:

Médio.

---

### Etapa 3 — Dashboard Debug

Criar:

* `services/dashboard/debugService.js`

Mover lógica de:

* debug ping
* debug leads
* debug messages
* debug messages-by-phone
* admin-test

Validação:

* Dashboard continua abrindo
* Consultas continuam funcionando
* Token de dashboard continua obrigatório

Risco:

Médio.

---

### Etapa 4 — Controller Cleanup

Reduzir `api/meta.js` para:

* Verificação GET Meta
* Entrada POST
* Extração de mensagem
* Orquestração dos serviços
* Resposta HTTP final

Validação:

* `node --check api/meta.js`
* Teste GET webhook
* Teste POST texto
* Teste áudio
* Teste imagem
* Teste handoff

Risco:

Alto se feito de uma vez.
Baixo se feito por etapas pequenas.

---

## O que não deve ser alterado agora

* Banco Supabase
* Nome das tabelas
* Nome dos campos
* Stages existentes
* Dashboard visual
* Deploy Vercel
* Tokens Meta
* Variáveis `.env`
* Prompt principal
* Regras comerciais

---

## Critério de Conclusão

A modularização será considerada concluída quando:

* `api/meta.js` atuar apenas como controller.
* Serviços externos ficarem em `services/`.
* Regras de negócio ficarem em `modules/`.
* Persistência ficar em repositories.
* Dashboard continuar funcional.
* Handoff continuar funcional.
* Áudio e imagem continuarem funcionais.

---

## Meta Final

Transformar o OSSO WEBHOOK V2 em base técnica segura para o OSSO ENGINE V1.

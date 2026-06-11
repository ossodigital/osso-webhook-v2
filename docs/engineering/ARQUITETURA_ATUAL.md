# ARQUITETURA ATUAL — OSSO WEBHOOK V2

## Status

Sistema funcional em produção.

## Fluxo Principal

Meta Cloud API
↓
api/meta.js
↓
Azure OpenAI
↓
Supabase
↓
Dashboard
↓
Handoff Humano

---

## Arquivos Críticos

api/meta.js

api/followup.js

dashboard/index.html

---

## Serviços Externos

Meta Cloud API

Azure OpenAI

Whisper

Supabase

Vercel

---

## Funcionalidades Confirmadas

- WhatsApp Oficial
- IA Contextual
- Handoff Humano
- Dashboard
- Histórico
- Áudio
- Imagem
- CRM

---

## Regra Principal

Nenhuma modularização pode alterar o comportamento atual do sistema.

Toda extração deve manter compatibilidade total com a versão funcional.
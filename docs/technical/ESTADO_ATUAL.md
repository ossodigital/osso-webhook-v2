# Estado atual

## 1. Arquitetura (0-100)

**58/100.** Backend serverless modularizado por `api`, `modules`, `services` e `config`, com `api/meta.js` como orquestrador. A separação existe, mas follow-up, autenticação, configuração e operação ainda não estão uniformes.

## 2. Módulos concluídos

- Webhook WhatsApp: texto, áudio e imagem.
- Resposta por Azure OpenAI e transcrição de áudio.
- Persistência de leads, mensagens e imagens no Supabase.
- Classificação de stage, captura de nome e bloqueio da IA no handoff.
- Alertas administrativos.
- Dashboard: consulta, filtros, conversa, envio manual, takeover e retorno à IA.

## 3. Módulos parciais

- Controller Meta: ainda concentra fluxo, mídia e ações do dashboard.
- Follow-up: funcional, porém acoplado diretamente a Supabase/Meta e sem proteção da rota.
- Qualificação: regras simples; dois classificadores exportados não são usados.
- Dashboard: token no `localStorage`/query string, API fixa e polling.
- Configuração: centralizada apenas em parte; `.env.example` está incompleto.
- Tratamento de falhas: erros são registrados, mas várias escritas/envios não interrompem nem compensam o fluxo.

## 4. Módulos pendentes

- Testes automatizados e pipeline de validação.
- Isolamento multiempresa/configuração por cliente.
- Autenticação e autorização adequadas para dashboard e rotas operacionais.
- Validação de assinatura e idempotência do webhook.
- Observabilidade operacional estruturada.

## 5. Código morto (se houver)

- `identificarLeadCurioso` e `identificarLeadQuente`: exportados, sem uso.
- `api/test-supabase.js`: endpoint diagnóstico fora do fluxo principal.
- Arquivo duplicado/malformado na raiz com cópia de `stageDetector.js`.

## 6. Gargalos críticos (máx. 10)

1. Webhook POST sem validação da assinatura Meta.
2. Ausência de idempotência; reentregas podem duplicar respostas e registros.
3. `/api/followup` público e acionável sem autenticação.
4. `/api/test-supabase` expõe dados sem autenticação.
5. Token do dashboard trafega em query string e fica no `localStorage`.
6. CORS aberto (`*`) na API administrativa.
7. Sem testes automatizados; apenas validação sintática disponível.
8. Operações externas e de banco não são atômicas; falhas podem deixar estado divergente.
9. Follow-up ignora erros de insert/update e pode reenviar após falha parcial.
10. Código e configuração são de uma única empresa, sem isolamento de dados.

## 7. O que impede vender hoje

Faltam isolamento entre clientes, segurança mínima das rotas/webhook e evidência automatizada de confiabilidade. No estado atual, o projeto é uma implementação operacional de cliente único, não um SaaS vendável com segurança.

## 8. Próxima tarefa de maior impacto

Fechar a camada de segurança operacional: validar assinatura do webhook e proteger as rotas `followup`, `test-supabase` e administrativas, com testes automatizados desses controles.

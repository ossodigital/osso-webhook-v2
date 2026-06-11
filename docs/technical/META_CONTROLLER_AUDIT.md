# META CONTROLLER AUDIT — OSSO WEBHOOK V2

## Objetivo

Auditar o arquivo `api/meta.js` e definir exatamente quais responsabilidades ainda permanecem dentro do controller.

Nenhuma alteração de código será feita nesta etapa.

---

## Arquivo analisado

`api/meta.js`

---

## Responsabilidades atuais

### Deve permanecer no controller

- Handler HTTP GET
- Handler HTTP POST
- Verificação do webhook Meta
- Extração inicial da mensagem
- Coordenação entre módulos
- Resposta HTTP final

---

### Deve sair do controller

- Admin Alerts
- Meta Media
- Dashboard Debug
- Regras de Handoff
- Regras de Qualification
- Persistência direta
- Chamada direta de IA
- Envio WhatsApp direto

---

## Próxima extração recomendada

### 1. Admin Alerts

Destino:

`services/meta/adminAlerts.js`

### 2. Meta Media

Destino:

`services/meta/media.js`

### 3. Dashboard Debug

Destino:

`services/dashboard/debugService.js`
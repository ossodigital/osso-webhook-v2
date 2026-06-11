# EXTRACTION ORDER

## Ordem oficial de modularização

### ETAPA 1
Admin Alerts

Origem:
api/meta.js

Destino:
services/meta/adminAlerts.js

Risco:
Baixo

---

### ETAPA 2
Meta Media

Origem:
api/meta.js

Destino:
services/meta/media.js

Risco:
Baixo

---

### ETAPA 3
Dashboard Debug

Origem:
api/meta.js

Destino:
services/dashboard/debugService.js

Risco:
Baixo

---

### ETAPA 4
Azure AI

Origem:
api/meta.js

Destino:
services/ai/

Risco:
Médio

---

### ETAPA 5
Qualification

Origem:
api/meta.js

Destino:
modules/qualification/

Risco:
Médio

---

### ETAPA 6
Handoff

Origem:
api/meta.js

Destino:
modules/handoff/

Risco:
Alto

---

### ETAPA 7
Persistência

Origem:
api/meta.js

Destino:
repositories/

Risco:
Alto
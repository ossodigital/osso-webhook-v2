# Inventário do worktree preexistente ao CRM-009

Snapshot realizado em 2026-08-12, na branch `main`, com `HEAD` em `0d3680a119d2c4b29dea2c5a06358d4f80b2bd65`, antes da implementação do CRM-009.

Os arquivos abaixo já estavam modificados ou não rastreados e **não pertencem ao CRM-009**. Seu conteúdo não foi alterado durante a criação deste documento. Arquivos rastreados possuem risco médio de perda; arquivos não rastreados possuem risco alto porque ainda não existem em commit.

| Arquivo | Status inicial | Grupo provável | Risco de perda | CRM-009 |
|---|---|---|---|---|
| `.env.example` | Modificado | autenticação/configuração | Médio | Não pertence |
| `.gitignore` | Modificado | plataforma/configuração | Médio | Não pertence |
| `config/env.js` | Modificado | autenticação/configuração | Médio | Não pertence |
| `dashboard/index.html` | Modificado | dashboard | Médio | Não pertence |
| `modules/stages/stageDetector.js` | Modificado | stage/handoff | Médio | Não pertence |
| `package-lock.json` | Modificado | plataforma/dependências | Médio | Não pertence |
| `package.json` | Modificado | plataforma/dependências | Médio | Não pertence |
| `tests/stages/stageDetector.characterization.test.js` | Modificado | stage/handoff | Médio | Não pertence |
| `.claude/settings.local.json` | Não rastreado | configuração local de ferramenta | Alto | Não pertence |
| `api/auth-config.js` | Não rastreado | autenticação | Alto | Não pertence |
| `api/dashboard.js` | Não rastreado | dashboard/autenticação | Alto | Não pertence |
| `apps/admin/README.md` | Não rastreado | plataforma | Alto | Não pertence |
| `apps/agenda/README.md` | Não rastreado | plataforma | Alto | Não pertence |
| `apps/crm/README.md` | Não rastreado | plataforma | Alto | Não pertence |
| `apps/site/README.md` | Não rastreado | plataforma | Alto | Não pertence |
| `auth/supabase-auth.js` | Não rastreado | autenticação | Alto | Não pertence |
| `docs/AUTHENTICATION.md` | Não rastreado | autenticação/documentação | Alto | Não pertence |
| `docs/platform/API.md` | Não rastreado | plataforma/documentação | Alto | Não pertence |
| `docs/platform/ARCHITECTURE.md` | Não rastreado | plataforma/documentação | Alto | Não pertence |
| `docs/platform/AUTH.md` | Não rastreado | autenticação/plataforma | Alto | Não pertence |
| `docs/platform/DEPLOY.md` | Não rastreado | plataforma/documentação | Alto | Não pertence |
| `docs/platform/DOMAINS.md` | Não rastreado | plataforma/documentação | Alto | Não pertence |
| `docs/platform/MODULES.md` | Não rastreado | plataforma/documentação | Alto | Não pertence |
| `docs/platform/README.md` | Não rastreado | plataforma/documentação | Alto | Não pertence |
| `docs/platform/ROADMAP.md` | Não rastreado | plataforma/documentação | Alto | Não pertence |
| `login/index.html` | Não rastreado | autenticação/interface | Alto | Não pertence |
| `login/login.js` | Não rastreado | autenticação/interface | Alto | Não pertence |
| `middleware.js` | Não rastreado | autenticação/plataforma | Alto | Não pertence |
| `modules/handoff/handoffClassifier.js` | Não rastreado | stage/handoff | Alto | Não pertence |
| `modules/handoff/handoffPolicy.js` | Não rastreado | stage/handoff | Alto | Não pertence |
| `modules/stages/stageClassifier.js` | Não rastreado | stage/handoff | Alto | Não pertence |
| `modules/stages/stageCompatibility.js` | Não rastreado | stage/handoff | Alto | Não pertence |
| `packages/ai/README.md` | Não rastreado | plataforma | Alto | Não pertence |
| `packages/api/README.md` | Não rastreado | plataforma | Alto | Não pertence |
| `packages/auth/README.md` | Não rastreado | autenticação/plataforma | Alto | Não pertence |
| `packages/config/README.md` | Não rastreado | plataforma | Alto | Não pertence |
| `packages/database/README.md` | Não rastreado | plataforma | Alto | Não pertence |
| `packages/shared/README.md` | Não rastreado | plataforma | Alto | Não pertence |
| `packages/storage/README.md` | Não rastreado | plataforma | Alto | Não pertence |
| `packages/ui/README.md` | Não rastreado | plataforma | Alto | Não pertence |
| `packages/whatsapp/README.md` | Não rastreado | plataforma | Alto | Não pertence |
| `scripts/create-admin.js` | Não rastreado | autenticação/operação | Alto | Não pertence |
| `services/auth/dashboardAuth.js` | Não rastreado | autenticação/dashboard | Alto | Não pertence |
| `supabase/migrations/202608060001_dashboard_auth.sql` | Não rastreado | autenticação/banco | Alto | Não pertence |
| `tests/fixtures/handoff-audit-matrix.js` | Não rastreado | stage/handoff | Alto | Não pertence |
| `tests/fixtures/legacy-stage-detector.js` | Não rastreado | stage/handoff | Alto | Não pertence |
| `tests/stages/modularPipeline.test.js` | Não rastreado | stage/handoff | Alto | Não pertence |

## Proteção aplicada

- Nenhum arquivo listado foi apagado, restaurado, limpo, movido ou colocado em stash.
- Nenhum arquivo listado deve entrar no commit do CRM-009.
- O status deve ser comparado com este snapshot antes do commit do CRM-009.
- A presença desses arquivos impede operações destrutivas amplas sobre o worktree.

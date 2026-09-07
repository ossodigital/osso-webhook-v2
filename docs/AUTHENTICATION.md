# Autenticação do Dashboard

O Dashboard usa Supabase Auth com e-mail e senha. O navegador mantém e renova a sessão pelo SDK oficial; o middleware valida o access token antes de servir `/dashboard`; e a fachada `/api/dashboard` aceita apenas JWTs de usuários cujo `profile.role` seja `admin` ou `attendant`. A API existente `/api/meta` permanece inalterada, e seu token legado fica restrito ao servidor.

## Configuração

1. Execute `supabase/migrations/202608060001_dashboard_auth.sql` no SQL Editor do projeto Supabase.
2. Configure `SUPABASE_URL` e `SUPABASE_ANON_KEY` na Vercel. A anon key é pública e exclusiva do cliente; nunca use a service-role key como anon key.
3. Configure `SUPABASE_SERVICE_ROLE_KEY`, `FIRST_ADMIN_EMAIL` e `FIRST_ADMIN_PASSWORD` somente no ambiente local usado para provisionamento.
4. Execute `npm run create-admin` uma vez. Remova `FIRST_ADMIN_PASSWORD` do ambiente depois da criação.
5. Em Supabase Auth, inclua a URL pública e `/login` nas URLs permitidas de redirecionamento.

Novos usuários devem ser criados pelo painel administrativo do Supabase ou por uma futura função administrativa segura. O trigger cria automaticamente o profile como `attendant`. A promoção para `admin` deve ser feita com service role ou diretamente pelo SQL Editor, nunca pelo navegador.

## Fluxos

- `/login`: login por e-mail e senha e recuperação de senha.
- `/dashboard`: rota protegida; visitante sem sessão válida é enviado para `/login`.
- Logout: encerra a sessão com `supabase.auth.signOut()` e apaga o cookie auxiliar do middleware.
- Refresh: o SDK persiste e renova a sessão; alterações de autenticação sincronizam o access token usado pelo middleware.

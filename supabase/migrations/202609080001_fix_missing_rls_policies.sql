-- O "Security Advisor" do Supabase habilitou RLS em varias tabelas do
-- schema public (leads, messages, handoff_events, audits, profiles, etc)
-- sem criar nenhuma policy, quebrando o dashboard (leads sumiram e o
-- login entrou em loop porque a leitura de public.profiles passou a
-- retornar 0 linhas para o usuario autenticado).
--
-- Esta migration e idempotente: garante que a policy de leitura do
-- proprio perfil exista, mesmo que a policy original da migration
-- 202608060001 tenha sido removida/nunca aplicada de fato no banco.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public'
      and tablename = 'profiles'
      and policyname = 'profiles_select_own'
  ) then
    create policy "profiles_select_own" on public.profiles
      for select to authenticated using (auth.uid() = id);
  end if;
end $$;

-- Nota operacional: as tabelas operacionais (leads, messages,
-- handoff_events, audits, etc) sao lidas pelo backend via
-- services/supabase/client.js usando SUPABASE_SERVICE_ROLE_KEY, que
-- bypassa RLS por padrao. Nao precisam de policies proprias por isso,
-- mas se o Security Advisor voltar a alterar algo, confira com:
--   select relname, relrowsecurity from pg_class
--   where relnamespace = 'public'::regnamespace and relkind = 'r';

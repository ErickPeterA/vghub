# PostgreSQL Migration Notes

## Escopo

Preparei uma baseline local para PostgreSQL 17 em `supabase/migrations/20260902120000_initial_postgres_schema.sql`.

Nao executei migrations, `db push`, nem conectei em banco remoto. A pasta historica existente `supabase/migration_backup/` foi apenas lida e nao foi alterada.

## Dependencias da plataforma anterior encontradas nas migrations

- `auth.users` em chaves estrangeiras de usuarios, perfis, projetos, membros, historico, descricoes de cargo, avaliacoes e PAM.
- `auth.uid()` em RLS policies, funcoes RPC e triggers de auditoria.
- Grants e policies para papeis `authenticated`, `anon` e `service_role`.
- Trigger de criacao de perfil ligado ao schema `auth`.
- RLS em praticamente todas as tabelas de negocio.

Nao encontrei dependencias de `storage.objects`, `storage.buckets`, Realtime ou Edge Functions nas migrations analisadas.

## Adaptacoes feitas na nova migration

- Criei `public.users` como tabela propria de identidade basica, sem senha e sem implementar autenticacao.
- `public.profiles.id` agora referencia `public.users(id)`.
- Referencias antigas a `auth.users` foram direcionadas para `public.users`.
- Mantive FKs adicionais de `project_members.user_id` e `project_history.user_id` para `public.profiles(id)`, porque o codigo usa joins com `profiles`.
- Removi grants, roles e policies especificas da plataforma anterior.
- Mantive funcoes e triggers PostgreSQL que ainda fazem sentido.
- Substitui usos de `auth.uid()` dentro de funcoes por `public.current_app_user_id()`, que le `app.current_user_id` da sessao PostgreSQL. A API propria podera usar `SET LOCAL app.current_user_id = '<uuid>'` dentro de transacoes autenticadas.
- Mantive seeds estruturais minimos para Base e modelos globais de avaliacao. Backfills sobre dados existentes foram omitidos porque a baseline deve rodar em banco novo e vazio.

## Pontos que precisam ser migrados no codigo depois

O codigo ainda depende diretamente do SDK e dos clientes da plataforma anterior:

- `package.json` ainda inclui `@supabase/supabase-js`.
- Clientes e middleware em `src/integrations/supabase/*`.
- Auth no frontend: `src/routes/login.tsx`, `src/hooks/use-current-user.ts`, `src/lib/auth-safe.ts`, `src/components/AppSidebar.tsx`.
- Operacoes administrativas de usuario em `src/lib/admin.functions.ts`.
- CRUD via `.from(...)` em componentes como `ActivityLinksPanel`, `ActivityConfigManager`, `AreasManager`, `BaseManager`, `DCListPage`, `EmployeesManager`, `EvaluationScoringSettings`, `PamManager`, `PerformanceReviewManager`, `ProjectConfigPage`, `ProjectListPage`, `FieldCommentButton`, `OrganizationManager` e rotas de projeto.
- APIs publicas por token em `src/routes/api/public/*` ainda usam o cliente admin antigo.
- RPCs chamadas pelo frontend/backend: `decide_field_comment`, `finalize_resolved_dc_comments`, `insert_project_position_above`, `move_project_position`, `delete_project_position_with_reassignment`, `reorder_project_position`, `refresh_performance_review_status`.

## Pontos para revisar antes de executar

- Confirmar se a pasta historica deve continuar como `supabase/migration_backup/` ou se voce quer renomear manualmente para `supabase/migrations_backup/`.
- Revisar os seeds de perguntas de avaliacao: preservei uma versao estrutural minima, nao a massa completa de textos historicos.
- Definir a futura API de autenticacao/autorizacao antes de expor o banco ao app.
- Quando a API propria estiver pronta, ela deve setar `app.current_user_id` nas transacoes que chamam funcoes com regras de permissao/auditoria.
- O codigo da aplicacao ainda nao foi alterado, por pedido explicito.

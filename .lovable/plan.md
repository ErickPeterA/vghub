## Reestruturação Completa do Sistema

Vou reconstruir o sistema com nova arquitetura modular, escalável e com controle de acesso baseado em papéis (RBAC) global + por projeto.

---

### 1. Banco de dados (nova migration)

**Limpar o que existe** e criar nova estrutura:

- `app_role` (enum global): `admin`, `user`
- `project_role` (enum por projeto): `admin`, `lider_estrategico`, `lider_tatico`, `lider_operacional`, `gp`
- `profiles` — `id, nome, email, status (ativo/inativo), created_at, updated_at`
- `user_roles` — `user_id, role (app_role)` (controla quem é admin global)
- `projects` — `id, nome, empresa, status (ativo/arquivado), responsavel_id, created_by, created_at, updated_at`
- `project_members` — `project_id, user_id, role (project_role), created_at` (vínculo usuário ↔ projeto + cargo)
- `descricoes_cargo` — adicionar `project_id` (FK obrigatória); manter campos atuais
- `project_templates` — `id, project_id, nome, tipo, conteudo (jsonb)` (modelos/biblioteca)
- `project_hub` — `id, project_id, secao, conteudo (jsonb)` (página central, extensível)
- `project_history` — `id, project_id, user_id, acao, entidade, entidade_id, detalhes (jsonb), created_at`
- `project_progress` — `id, project_id, etapa, status, percentual, updated_at` (indicadores)

**Funções `SECURITY DEFINER`:**
- `has_role(user_id, app_role)` — checa papel global
- `is_project_member(user_id, project_id)` — checa vínculo
- `get_project_role(user_id, project_id)` — retorna cargo no projeto

**RLS:** usuários só veem projetos onde são membros (ou se `admin` global). Admin global gerencia tudo. Histórico é gravado por triggers em descrições de cargo e via inserts explícitos nas demais ações.

**Auth:** desabilitar signup público (`disable_signup: true`), auto-confirm de email habilitado (admin cria contas direto).

---

### 2. Frontend — Estrutura de rotas

```
/login                                    → única página pública
/_authenticated/
  projetos                                → lista de projetos do usuário
  projetos/novo                           → admin cria projeto
  projetos/$id/                           → layout com sidebar interna do projeto
    descricao-cargo                       → lista + CRUD de DCs (atual reaproveitado)
    descricao-cargo/novo
    descricao-cargo/$dcId
    modelos                               → biblioteca de modelos
    central                               → página hub (resumos, anotações)
    historico                             → log de ações
    andamento                             → dashboard com gráficos (recharts)
  gerenciamento/                          → APENAS admin
    usuarios                              → listar/editar/desativar/excluir
    usuarios/novo                         → criar login
    atrelar                               → vincular usuário ↔ projeto ↔ cargo
```

**Sidebar principal** (shadcn `Sidebar`):
- Projetos (todos)
- Gerenciamento (só admin) — expande submenu

**Sidebar interna do projeto** aparece dentro de `/projetos/$id/*`.

---

### 3. Server functions

- `createUser` (admin): cria conta via `supabaseAdmin.auth.admin.createUser` + insere em `profiles`
- `updateUser`, `deleteUser`, `toggleUserStatus` (admin)
- `attachUserToProject` (admin): insere em `project_members`
- `createProject`, `updateProject`, `archiveProject` (admin)
- `logProjectAction` (helper): grava em `project_history`

---

### 4. Componentes/UI

- Tema: manter dark Instrument Serif + Inter já existente
- shadcn Sidebar para nav principal e interna do projeto
- recharts para gráficos de andamento
- Tabelas com ações inline (editar/excluir/desativar)

---

### 5. Bootstrap inicial

Como signup é fechado, preciso criar o **primeiro admin**. Vou inserir via migration usando o email/senha que você fornecer (ou um padrão temporário) e dar role `admin`.

---

### ❓ Antes de eu começar, preciso confirmar:

1. **Primeiro admin** — qual email e senha você quer usar? (ex: `admin@dc.local` / `admin123`)
2. **Dados atuais** — posso apagar as descrições de cargo já cadastradas (a estrutura muda — agora precisam ter `project_id`)?
3. **"Atrelar usuários"** — quando vincular um usuário a um projeto, o cargo no projeto é obrigatório no momento do vínculo, certo?

Responda essas 3 e eu sigo com a implementação completa.
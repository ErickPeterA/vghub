# Plano: Áreas/Setores, Kanban e Permissões

Vou implementar os 3 passos em sequência, cada um construindo sobre o anterior. Como envolve mudanças grandes no banco e na UI, peço aprovação antes de executar.

---

## PASSO 1 — Áreas e Setores

### Banco de dados
- Nova tabela `project_areas` (id, project_id, parent_id nullable, nome, cor opcional, display_order). `parent_id` permite hierarquia Área → Setor (e setores filhos).
- RLS: SELECT para membros do projeto; INSERT/UPDATE/DELETE só para admin global ou responsável do projeto.
- GRANTs padrão (authenticated + service_role).

### Migração de dados existentes
- Campos `unidade_negocio` e `departamento` em `base_fields` (seção `cabecalho`):
  - Renomear `label` para "Área" e "Setor".
  - Mudar `field_type` para um novo tipo especial `area_select` / `setor_select` (ou reusar `single_select` com flag `source: 'project_areas'`). Opto por adicionar coluna `data_source` em `base_fields` (`'manual' | 'areas' | 'setores'`).
- Preservar valores já gravados em `descricoes_cargo.unidade_negocio` e `departamento`. Script de backfill: para cada projeto, criar Áreas/Setores a partir dos valores distintos já usados nas DCs.

### Frontend
- Nova rota `/projetos/$projectId/areas` + item na `ProjectSidebar`.
- Componente `AreasManager`: árvore de Áreas com expansão; dentro de cada área, lista de setores; botão "+ Adicionar setor" (mesmo padrão visual do `BaseManager` para opções de single_select). Inline rename/delete. Drag opcional na v2.
- `DynamicFieldControl` passa a renderizar opções dinâmicas quando `field.data_source === 'areas' | 'setores'`, buscando de `project_areas`.
- Setor depende da Área selecionada na mesma DC (filtra `parent_id`).

### Fluxo de criação
- Após criar projeto em `projetos.novo.tsx`, navigate para `/projetos/$projectId/areas` em vez de listagem.

---

## PASSO 2 — Kanban

### Banco
- Adicionar coluna `etapa` em `descricoes_cargo`: enum `dc_stage` (`em_criacao | em_aprovacao | concluido`), default `em_criacao`.
- Triggers/logs de transição em `project_history`.

### Frontend
- Substituir conteúdo do `DCListPage` por `DCKanbanBoard` com 3 colunas.
- Card mostra: cargo, responsável (nome do criador via join com profiles), data, setor como badge colorido (cor da área pai ou cor própria).
- Permissões por papel:
  - GP / admin / responsável: dropdown ou botões → / ← para mover entre colunas.
  - Líder (qualquer tipo): botão "Aprovar" nos cards em `em_aprovacao` que ele pode ver → move para `concluido`.
  - Usuário comum: vê só sua DC; se em `em_aprovacao`, botão "Aprovar".
- Drag-and-drop com `@dnd-kit` (já instalado) para quem tiver permissão de mover.

---

## PASSO 3 — Permissões e Configurações

### Banco
- Estender enum `project_role`: adicionar `lider_superior`, `lider_setor`, `usuario_comum`. Manter `gp` e `admin`. Remover (ou aposentar) `lider_estrategico/tatico/operacional` — migrar os existentes para `lider_superior`.
- Tabela `project_member_scopes` (member_id, area_id nullable, setor_id nullable) para vincular Líder de Setor a um setor específico (recursivo nos filhos).
- Adicionar `cliente_empresa` (texto) em `projects` se ainda não existir, para escopo do Líder Superior. (Já existe coluna `empresa`? checar — se sim, reutilizar.)
- Funções RLS / helpers:
  - `can_view_dc(user, dc)` security definer que considera papel + escopo de setor (com recursão CTE em `project_areas`).
  - Substituir/ajustar policies de `descricoes_cargo`.

### Frontend
- Renomear aba "Modelos" para "Configurações" na `ProjectSidebar`. Rota `/projetos/$projectId/configuracoes` (substitui `templates`).
- Página acessível só para admin global. Mostra:
  - Lista de membros do projeto com select de papel.
  - Para `lider_setor`: seletor de área/setor que ele gerencia.
  - Botão para adicionar/remover membro (reaproveita `gerenciamento.atrelar`).
- Filtragem no Kanban + lista de DCs respeita o papel.

---

## Detalhes técnicos relevantes

- Server functions para mutações privilegiadas em `src/lib/areas.functions.ts` e `src/lib/dc-stage.functions.ts` usando `requireSupabaseAuth`.
- Atualizações em `DCForm.tsx`: campos Área/Setor passam a usar select dinâmico das áreas do projeto, com Setor filtrado por Área.
- Backfill numa migration única para não quebrar DCs já criadas: criar áreas/setores a partir dos textos distintos por projeto e atualizar `descricoes_cargo.unidade_negocio`/`departamento` para guardar o `id` (uuid) em vez do texto. Manter coluna como texto para retrocompatibilidade — armazenamos o uuid como string.
- A renomeação dos campos é só de label/data_source; nada quebra na leitura.

---

## Ordem de execução

1. Migration Passo 1 (tabela + enum/coluna data_source + backfill) → código frontend áreas + redirecionamento.
2. Migration Passo 2 (enum etapa + coluna) → Kanban.
3. Migration Passo 3 (novos roles + scopes + policies) → tela Configurações + filtros.

Cada passo será uma migration separada para você revisar individualmente. Posso prosseguir?

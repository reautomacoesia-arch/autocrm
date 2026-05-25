# Spec: Pipeline + Clientes — Melhorias (2026-05-24)

## Contexto

AutoCRM — CRM para empresa de automação com IA. Stack: Next.js App Router, TypeScript, Tailwind CSS v4, Supabase.

---

## Pipeline — 6 melhorias

### 1. Editar lead ao clicar no card
- Clicar no card do kanban (em qualquer stage exceto "won") abre `EditLeadModal`
- Modal pré-preenchido com todos os campos do lead
- Salvar chama `PATCH /api/leads/:id` com campos permitidos explicitamente
- Após salvar, atualiza o card no estado local sem recarregar página

### 2. Botão WhatsApp no card
- Ícone WhatsApp no rodapé do card (apenas se `lead.phone` existir)
- Clique abre `https://wa.me/55{phone_limpo}` em nova aba (`target="_blank"`)
- `stopPropagation` para não acionar o modal de edição
- Número limpo: remove caracteres não-numéricos antes de montar a URL

### 3. Campo Observações (notes)
- Campo `notes` já existe no tipo `Lead` e no banco
- Adicionar textarea "Observações" no `EditLeadModal` e `AddLeadModal`
- Não aparece no card do kanban — apenas no modal expandido

### 4. Remover lead (X no card)
- Botão X no canto superior direito do card
- `stopPropagation` para não acionar o modal de edição
- Confirma com `window.confirm("Remover este lead?")`
- Chama `DELETE /api/leads/:id`
- Remove do estado local otimisticamente após confirmação

### 5. Campo Instagram
- Nova coluna `instagram TEXT` na tabela `leads`
- Campo no `AddLeadModal` e `EditLeadModal`
- Tipo `Lead` atualizado em `lib/types.ts`

### 6. Campo Website
- Nova coluna `website TEXT` na tabela `leads`
- Campo no `AddLeadModal` e `EditLeadModal`
- Tipo `Lead` atualizado em `lib/types.ts`

---

## Clientes — 11 melhorias

### 1. Adicionar novo cliente
- Botão "Novo Cliente" na página `/clients` (Server Component passa função para ClientList)
- Modal `AddClientModal` com campos: nome*, empresa, email, telefone, mensalidade, status (ativo/inativo)
- Chama `POST /api/clients`
- Após criação, adiciona ao estado local e fecha modal

### 2. Remover cliente
- Botão "Remover" no cabeçalho do `ClientFolder`
- Confirma com `window.confirm`
- Chama `DELETE /api/clients/:id`
- Redireciona para `/clients` após remoção

### 3. Pausar/reativar cliente
- Botão contextual no cabeçalho do `ClientFolder`:
  - Se `status === 'active'`: mostra "Pausar" → PATCH com `{ status: 'inactive' }`
  - Se `status === 'inactive'`: mostra "Reativar" → PATCH com `{ status: 'active' }`
- Badge de status atualiza imediatamente no estado local

### 4. Aba Dados (nova aba no ClientFolder)
- Nova aba "📊 Dados" inserida como primeira aba
- Campos: Instagram, Website, WhatsApp (phone), Nome do contato (contact_name)
- Interface: formulário editável com botão "Salvar alterações"
- Chama `PATCH /api/clients/:id` com os campos
- Novos campos no banco: `instagram TEXT`, `website TEXT`, `contact_name TEXT`
- Tipo `Client` atualizado em `lib/types.ts`

### 5. Remover projeto
- Botão Trash2 nos cards de projeto em `ProjectsTab`
- Confirma com `window.confirm`
- Chama `DELETE /api/clients/:clientId/projects/:id`
- Remove do estado local otimisticamente

### 6. Editar projeto
- Clique no card de projeto coloca-o em modo de edição inline
- Formulário inline com: nome, descrição, status
- Botões Salvar / Cancelar
- Chama `PATCH /api/clients/:clientId/projects/:id`
- Atualiza estado local após salvar

### 7. Editar transação
- Clique na transação coloca-a em modo de edição inline
- Formulário inline com: valor, tipo (recebido/pendente), data, descrição
- Botões Salvar / Cancelar
- Chama `PATCH /api/transactions/:id`
- Atualiza estado local após salvar

### 8. Badge "Atrasado" em transações
- Condição: `t.type === 'pending'` e `parseDate(t.date) < hoje`
- Badge vermelho com texto "Atrasado" exibido ao lado do badge "Pendente"
- `parseDate` usa parsing local (sem UTC shift): `new Date(year, month-1, day)`

### 9. Remover nota (Histórico)
- Botão Trash2 em cada interação em `HistoryTab`
- Chama `DELETE /api/clients/:clientId/interactions/:id`
- Remove do estado local otimisticamente

### 10. Remover tarefa (TasksTab)
- Botão Trash2 em cada tarefa em `TasksTab`
- Chama `DELETE /api/tasks/:id`
- Remove do estado local otimisticamente

### 11. Editar tarefa (TasksTab)
- Clique na tarefa coloca-a em modo de edição inline
- Formulário inline com: título, descrição, status, prioridade, data de vencimento
- Botões Salvar / Cancelar
- Chama `PATCH /api/tasks/:id`
- Atualiza estado local após salvar

---

## Banco de Dados — Migrações

```sql
-- Tabela leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE leads ADD COLUMN IF NOT EXISTS website TEXT;

-- Tabela clients
ALTER TABLE clients ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS website TEXT;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS contact_name TEXT;
```

---

## APIs Novas / Modificadas

| Método | Rota | Ação |
|--------|------|------|
| DELETE | `/api/leads/[id]` | Remover lead |
| PATCH  | `/api/leads/[id]` | Já existe — verificar se cobre todos os campos novos |
| POST   | `/api/clients` | Criar cliente |
| DELETE | `/api/clients/[id]` | Remover cliente |
| PATCH  | `/api/clients/[id]` | Já existe? Criar se não |
| DELETE | `/api/clients/[id]/projects/[projectId]` | Remover projeto |
| PATCH  | `/api/clients/[id]/projects/[projectId]` | Editar projeto |
| DELETE | `/api/clients/[id]/interactions/[interactionId]` | Remover interação |

---

## Regras Técnicas (do projeto)

- Next.js App Router: `params` é uma `Promise` — sempre `await params`
- Nunca passar funções como props de Server → Client Components
- Supabase com RLS habilitado — todas as rotas usam `createClient()` do server
- PATCH nunca usa `{ ...body }` — sempre lista explícita de campos permitidos
- Datas `YYYY-MM-DD` sempre parseadas com `new Date(year, month-1, day)` para evitar UTC shift

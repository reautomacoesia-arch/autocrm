-- Habilitar extensão UUID
create extension if not exists "uuid-ossp";

-- Tabela de Leads (funil de vendas)
create table public.leads (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  company text,
  email text,
  phone text,
  stage text not null default 'lead'
    check (stage in ('lead','contacted','proposal_sent','negotiating','won','lost')),
  estimated_value numeric(10,2) default 0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabela de Clientes
create table public.clients (
  id uuid default uuid_generate_v4() primary key,
  lead_id uuid references public.leads(id),
  name text not null,
  company text,
  email text,
  phone text,
  monthly_value numeric(10,2) default 0,
  status text not null default 'active'
    check (status in ('active','inactive','churned')),
  started_at date,
  referred_by text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabela de Onboarding (dados coletados do cliente)
create table public.onboarding (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  segment text,
  team_size text,
  current_tools text,
  main_pain text,
  accesses text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabela de Projetos
create table public.projects (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  name text not null,
  status text not null default 'in_progress'
    check (status in ('in_progress','completed','paused','cancelled')),
  description text,
  start_date date,
  end_date date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Catálogo de Serviços
create table public.services (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  description text,
  default_price numeric(10,2) default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabela de Propostas
create table public.proposals (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id),
  lead_id uuid references public.leads(id),
  value numeric(10,2) not null default 0,
  status text not null default 'draft'
    check (status in ('draft','sent','approved','rejected')),
  valid_until date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Itens das Propostas
create table public.proposal_items (
  id uuid default uuid_generate_v4() primary key,
  proposal_id uuid references public.proposals(id) on delete cascade not null,
  service_id uuid references public.services(id),
  custom_description text,
  price numeric(10,2) not null default 0,
  created_at timestamptz default now()
);

-- Transações Financeiras
create table public.transactions (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  amount numeric(10,2) not null,
  type text not null check (type in ('received','pending')),
  date date not null,
  description text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Tabela de Tarefas
create table public.tasks (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id),
  lead_id uuid references public.leads(id),
  title text not null,
  description text,
  priority text not null default 'medium'
    check (priority in ('low','medium','high')),
  due_date date,
  status text not null default 'pending'
    check (status in ('pending','in_progress','done')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Histórico de Interações
create table public.interactions (
  id uuid default uuid_generate_v4() primary key,
  client_id uuid references public.clients(id) on delete cascade not null,
  type text not null check (type in ('note','meeting','email')),
  description text not null,
  happened_at timestamptz default now(),
  created_at timestamptz default now()
);

-- Habilitar Row Level Security em todas as tabelas
alter table public.leads enable row level security;
alter table public.clients enable row level security;
alter table public.onboarding enable row level security;
alter table public.projects enable row level security;
alter table public.services enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_items enable row level security;
alter table public.transactions enable row level security;
alter table public.tasks enable row level security;
alter table public.interactions enable row level security;

-- Políticas RLS: usuários autenticados têm acesso total (Fase 1 - usuário único)
create policy "auth_leads" on public.leads for all using (auth.role() = 'authenticated');
create policy "auth_clients" on public.clients for all using (auth.role() = 'authenticated');
create policy "auth_onboarding" on public.onboarding for all using (auth.role() = 'authenticated');
create policy "auth_projects" on public.projects for all using (auth.role() = 'authenticated');
create policy "auth_services" on public.services for all using (auth.role() = 'authenticated');
create policy "auth_proposals" on public.proposals for all using (auth.role() = 'authenticated');
create policy "auth_proposal_items" on public.proposal_items for all using (auth.role() = 'authenticated');
create policy "auth_transactions" on public.transactions for all using (auth.role() = 'authenticated');
create policy "auth_tasks" on public.tasks for all using (auth.role() = 'authenticated');
create policy "auth_interactions" on public.interactions for all using (auth.role() = 'authenticated');

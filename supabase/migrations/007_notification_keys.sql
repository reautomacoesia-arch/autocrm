-- Migration 007: tabelas faltantes + colunas de perfil
-- Seguro para rodar múltiplas vezes (IF NOT EXISTS em tudo)

-- ── 1. Tabela de Notificações ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid        DEFAULT uuid_generate_v4() PRIMARY KEY,
  key        text,
  title      text        NOT NULL,
  body       text,
  link       text,
  read       boolean     NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'notifications' AND policyname = 'auth_notifications'
  ) THEN
    CREATE POLICY "auth_notifications"
      ON public.notifications FOR ALL
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Índice único na coluna key (só quando key não é null — registros antigos sem key são ignorados)
CREATE UNIQUE INDEX IF NOT EXISTS notifications_key_idx
  ON public.notifications (key)
  WHERE key IS NOT NULL;

-- ── 2. Tabela de Configurações de Automações ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.automation_configs (
  id             uuid    DEFAULT uuid_generate_v4() PRIMARY KEY,
  automation_key text    UNIQUE NOT NULL,
  enabled        boolean NOT NULL DEFAULT false,
  config         jsonb,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

ALTER TABLE public.automation_configs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'automation_configs' AND policyname = 'auth_automation_configs'
  ) THEN
    CREATE POLICY "auth_automation_configs"
      ON public.automation_configs FOR ALL
      USING (auth.role() = 'authenticated');
  END IF;
END $$;

-- Seed das 3 automações padrão (ignora se já existirem)
INSERT INTO public.automation_configs (automation_key, enabled, config)
VALUES
  ('proposal_no_response', false, '{"days_threshold": 7, "notify": true, "create_task": true, "task_title": "Follow-up: proposta sem resposta", "task_priority": "medium"}'),
  ('client_no_contact',    false, '{"days_threshold": 30, "notify": true, "create_task": true, "task_title": "Retomar contato com cliente", "task_priority": "medium"}'),
  ('task_overdue',         false, '{"days_threshold": 1, "notify": true}')
ON CONFLICT (automation_key) DO NOTHING;

-- ── 3. Colunas de perfil (migration 006 — seguro se já existirem) ───────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS bio        text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone      text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS birth_date date;

-- ── 4. Bucket de avatares (só cria se ainda não existir) ───────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage para o bucket avatars
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_select'
  ) THEN
    CREATE POLICY "avatars_select" ON storage.objects FOR SELECT USING (bucket_id = 'avatars');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_insert'
  ) THEN
    CREATE POLICY "avatars_insert" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_update'
  ) THEN
    CREATE POLICY "avatars_update" ON storage.objects FOR UPDATE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname = 'avatars_delete'
  ) THEN
    CREATE POLICY "avatars_delete" ON storage.objects FOR DELETE USING (bucket_id = 'avatars' AND auth.role() = 'authenticated');
  END IF;
END $$;

-- Motor de automações plugável (Fase 4)
-- Regras "gatilho -> condições -> ações" criadas pelo próprio usuário,
-- em paralelo às automações fixas de automation_configs.

CREATE TABLE public.automation_workflows (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  name text NOT NULL,
  trigger_type text NOT NULL CHECK (trigger_type IN (
    'lead.stage_changed', 'proposal.status_changed', 'client.status_changed'
  )),
  enabled boolean NOT NULL DEFAULT true,
  conditions jsonb NOT NULL DEFAULT '[]'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.automation_workflows ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_automation_workflows" ON public.automation_workflows
  FOR ALL USING (auth.role() = 'authenticated');

CREATE INDEX automation_workflows_trigger_idx
  ON public.automation_workflows(trigger_type)
  WHERE enabled = true;

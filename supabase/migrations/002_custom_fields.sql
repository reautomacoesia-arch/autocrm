-- Custom field definitions (shared across clients and leads)
CREATE TABLE IF NOT EXISTS public.custom_field_definitions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type text NOT NULL CHECK (entity_type IN ('client', 'lead')),
  name text NOT NULL,
  field_type text NOT NULL CHECK (field_type IN ('text', 'number', 'date', 'select', 'checkbox', 'url')),
  options text[] DEFAULT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

-- Custom field values per entity
CREATE TABLE IF NOT EXISTS public.custom_field_values (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  definition_id uuid NOT NULL REFERENCES public.custom_field_definitions(id) ON DELETE CASCADE,
  entity_id uuid NOT NULL,
  value text DEFAULT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (definition_id, entity_id)
);

-- RLS (mesmo padrão das outras tabelas do projeto)
ALTER TABLE public.custom_field_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custom_field_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_custom_field_definitions"
  ON public.custom_field_definitions FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "auth_custom_field_values"
  ON public.custom_field_values FOR ALL
  USING (auth.role() = 'authenticated');

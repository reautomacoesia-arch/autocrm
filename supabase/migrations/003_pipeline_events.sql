CREATE TABLE public.pipeline_events (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  lead_id uuid REFERENCES public.leads(id) ON DELETE CASCADE,
  lead_name text NOT NULL,
  from_stage text NOT NULL,
  to_stage text NOT NULL,
  happened_at timestamptz DEFAULT now()
);

ALTER TABLE public.pipeline_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_pipeline_events"
  ON public.pipeline_events FOR ALL
  USING (auth.role() = 'authenticated');

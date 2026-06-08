ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS assigned_to text;
ALTER TABLE public.tasks ADD COLUMN IF NOT EXISTS tags text[] DEFAULT '{}';

CREATE TABLE public.task_checklist_items (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  text text NOT NULL,
  done boolean DEFAULT false,
  position integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.task_checklist_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_task_checklist" ON public.task_checklist_items FOR ALL USING (auth.role() = 'authenticated');

CREATE TABLE public.task_comments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  task_id uuid REFERENCES public.tasks(id) ON DELETE CASCADE NOT NULL,
  body text NOT NULL,
  author text NOT NULL,
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_task_comments" ON public.task_comments FOR ALL USING (auth.role() = 'authenticated');

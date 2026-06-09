CREATE TABLE public.client_documents (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  client_id uuid REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  size integer NOT NULL,
  mime_type text NOT NULL,
  r2_key text NOT NULL,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now()
);
ALTER TABLE public.client_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_client_documents" ON public.client_documents FOR ALL USING (auth.role() = 'authenticated');

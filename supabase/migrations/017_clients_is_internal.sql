-- Marca clientes que são a própria empresa dona do CRM
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_internal boolean DEFAULT false;

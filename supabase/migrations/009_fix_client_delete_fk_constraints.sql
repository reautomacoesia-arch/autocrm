-- Corrige FK sem ON DELETE que bloqueavam a exclusão de clientes.
-- proposals e tasks têm client_id nullable — ao deletar o cliente
-- os registros são mantidos com client_id = NULL (não são perdidos).

ALTER TABLE public.proposals
  DROP CONSTRAINT IF EXISTS proposals_client_id_fkey,
  ADD CONSTRAINT proposals_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

ALTER TABLE public.tasks
  DROP CONSTRAINT IF EXISTS tasks_client_id_fkey,
  ADD CONSTRAINT tasks_client_id_fkey
    FOREIGN KEY (client_id) REFERENCES public.clients(id) ON DELETE SET NULL;

-- 023_notifications_per_user.sql
-- Notificações direcionadas a um perfil específico (ex.: você foi atribuído a uma tarefa).
-- user_id NULL = notificação global (todos veem, comportamento atual preservado).
-- user_id preenchido = só aquele usuário vê.

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications (user_id);

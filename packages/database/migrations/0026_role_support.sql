-- Rol `support` (#160): entre usuario y moderador, ve Soporte y Estado.
--
-- SQLite no cambia un CHECK con ALTER y recrear `users` borraría en cascada sesiones, cuentas y todo lo que le
-- apunta. El CHECK es de la propia columna, así que se puede borrar: columna nueva, copia, se borra la vieja y se
-- renombra.

ALTER TABLE users ADD COLUMN role_new TEXT NOT NULL DEFAULT 'user'
  CHECK (role_new IN ('user', 'support', 'moderator', 'admin'));
UPDATE users SET role_new = role;
ALTER TABLE users DROP COLUMN role;
ALTER TABLE users RENAME COLUMN role_new TO role;

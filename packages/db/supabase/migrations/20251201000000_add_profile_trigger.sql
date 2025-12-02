-- Trigger para crear automáticamente un perfil cuando un nuevo usuario se registra
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, username, avatar_url)
  values (
    new.id,
    new.raw_user_meta_data ->> 'username',
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

-- Ejecutar la función cada vez que se crea un usuario
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();


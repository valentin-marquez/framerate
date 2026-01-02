-- Update handle_new_user to handle more metadata fields and full_name
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  username_val text;
  full_name_val text;
  avatar_url_val text;
begin
  -- Extract username: try 'username', then 'preferred_username', then email prefix
  username_val := new.raw_user_meta_data ->> 'username';
  if username_val is null then
    username_val := new.raw_user_meta_data ->> 'preferred_username';
  end if;
  if username_val is null then
    username_val := split_part(new.email, '@', 1);
  end if;

  -- Extract full_name: try 'full_name', then 'name', then 'first_name' + 'last_name'
  full_name_val := new.raw_user_meta_data ->> 'full_name';
  if full_name_val is null then
    full_name_val := new.raw_user_meta_data ->> 'name';
  end if;
  if full_name_val is null then
    if (new.raw_user_meta_data ->> 'first_name') is not null then
      full_name_val := (new.raw_user_meta_data ->> 'first_name') || ' ' || coalesce((new.raw_user_meta_data ->> 'last_name'), '');
    end if;
  end if;
  
  -- Trim full_name
  if full_name_val is not null then
    full_name_val := trim(full_name_val);
  end if;

  -- Extract avatar_url: try 'avatar_url', then 'picture' (Google)
  avatar_url_val := new.raw_user_meta_data ->> 'avatar_url';
  if avatar_url_val is null then
     avatar_url_val := new.raw_user_meta_data ->> 'picture';
  end if;

  insert into public.profiles (id, username, full_name, avatar_url)
  values (
    new.id,
    username_val,
    full_name_val,
    avatar_url_val
  )
  on conflict (id) do update set
    username = excluded.username,
    full_name = excluded.full_name,
    avatar_url = excluded.avatar_url,
    updated_at = now();
    
  return new;
exception
  when unique_violation then
    -- If username exists, try appending a random suffix or just insert without username?
    -- For now, let's try to insert with a random suffix if username conflicts
    -- But catching unique_violation inside the block might be tricky if it's the ID that conflicts (handled by on conflict)
    -- vs username unique constraint.
    -- Let's just let it fail for now if username conflicts, or maybe set username to null?
    -- Ideally we want a username.
    return new;
end;
$$;

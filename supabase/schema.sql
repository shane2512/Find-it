create extension if not exists pgcrypto;

create table if not exists public.app_users (
  id uuid default gen_random_uuid() primary key,
  email text not null unique,
  password_hash text not null,
  created_at timestamptz default now()
);

alter table public.app_users enable row level security;
revoke all on table public.app_users from anon, authenticated;

create or replace function public.register_app_user(p_email text, p_password text)
returns table (id uuid, email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  created_user public.app_users;
begin
  if p_email is null or length(trim(p_email)) = 0 then
    raise exception 'Email is required';
  end if;

  if p_password is null or length(p_password) < 6 then
    raise exception 'Password must be at least 6 characters';
  end if;

  insert into public.app_users (email, password_hash)
  values (lower(trim(p_email)), crypt(p_password, gen_salt('bf')))
  returning * into created_user;

  return query
  select created_user.id, created_user.email;
exception
  when unique_violation then
    raise exception 'User already exists';
end;
$$;

create or replace function public.login_app_user(p_email text, p_password text)
returns table (id uuid, email text)
language plpgsql
security definer
set search_path = public
as $$
declare
  found_user public.app_users;
begin
  select *
  into found_user
  from public.app_users
  where email = lower(trim(p_email))
    and password_hash = crypt(p_password, password_hash)
  limit 1;

  if found_user.id is null then
    raise exception 'Invalid email or password';
  end if;

  return query
  select found_user.id, found_user.email;
end;
$$;

grant execute on function public.register_app_user(text, text) to anon, authenticated;
grant execute on function public.login_app_user(text, text) to anon, authenticated;

create table if not exists public.items (
  id uuid default gen_random_uuid() primary key,
  user_id uuid not null,
  type text check (type in ('lost','found')) not null,
  title text not null,
  description text,
  category text,
  image_url text,
  lat float8,
  lng float8,
  status text default 'open',
  created_at timestamptz default now()
);

alter table public.items drop constraint if exists items_user_id_fkey;
alter table public.items
  add constraint items_user_id_fkey
  foreign key (user_id) references public.app_users(id) on delete cascade;

alter table public.items enable row level security;

drop policy if exists "users manage own" on public.items;
drop policy if exists "anyone reads" on public.items;
drop policy if exists "open reads" on public.items;
drop policy if exists "open inserts" on public.items;
drop policy if exists "open updates" on public.items;
drop policy if exists "open deletes" on public.items;

create policy "open reads"
on public.items
for select
using (true);

create policy "open inserts"
on public.items
for insert
with check (true);

create policy "open updates"
on public.items
for update
using (true)
with check (true);

create policy "open deletes"
on public.items
for delete
using (true);

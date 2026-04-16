create extension if not exists pgcrypto with schema extensions;

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
set search_path = public, extensions
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
  values (lower(trim(p_email)), extensions.crypt(p_password, extensions.gen_salt('bf')))
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
set search_path = public, extensions
as $$
declare
  found_user public.app_users;
begin
  select *
  into found_user
  from public.app_users as au
  where au.email = lower(trim(p_email))
    and au.password_hash = extensions.crypt(p_password, au.password_hash)
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

create table if not exists public.matches (
  id uuid default gen_random_uuid() primary key,
  lost_item_id uuid not null references public.items(id) on delete cascade,
  found_item_id uuid not null references public.items(id) on delete cascade,
  score int not null check (score >= 0 and score <= 100),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz default now(),
  unique (lost_item_id, found_item_id)
);

alter table public.matches enable row level security;

drop policy if exists "open match reads" on public.matches;
drop policy if exists "open match writes" on public.matches;

create policy "open match reads"
on public.matches
for select
using (true);

create policy "open match writes"
on public.matches
for all
using (true)
with check (true);

create index if not exists matches_lost_idx on public.matches(lost_item_id);
create index if not exists matches_found_idx on public.matches(found_item_id);

create table if not exists public.chat_threads (
  id uuid default gen_random_uuid() primary key,
  match_id uuid not null unique references public.matches(id) on delete cascade,
  lost_user_id uuid not null references public.app_users(id) on delete cascade,
  found_user_id uuid not null references public.app_users(id) on delete cascade,
  created_at timestamptz default now()
);

alter table public.chat_threads enable row level security;

drop policy if exists "open thread reads" on public.chat_threads;
drop policy if exists "open thread writes" on public.chat_threads;

create policy "open thread reads"
on public.chat_threads
for select
using (true);

create policy "open thread writes"
on public.chat_threads
for all
using (true)
with check (true);

create table if not exists public.chat_messages (
  id uuid default gen_random_uuid() primary key,
  thread_id uuid not null references public.chat_threads(id) on delete cascade,
  sender_user_id uuid not null references public.app_users(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

alter table public.chat_messages enable row level security;

drop policy if exists "open message reads" on public.chat_messages;
drop policy if exists "open message writes" on public.chat_messages;

create policy "open message reads"
on public.chat_messages
for select
using (true);

create policy "open message writes"
on public.chat_messages
for all
using (true)
with check (true);

create index if not exists chat_messages_thread_created_idx
on public.chat_messages(thread_id, created_at);

insert into storage.buckets (id, name, public)
values ('item-images', 'item-images', true)
on conflict (id) do nothing;

drop policy if exists "public read item images" on storage.objects;
drop policy if exists "open upload item images" on storage.objects;
drop policy if exists "open update item images" on storage.objects;
drop policy if exists "open delete item images" on storage.objects;

create policy "public read item images"
on storage.objects
for select
using (bucket_id = 'item-images');

create policy "open upload item images"
on storage.objects
for insert
with check (bucket_id = 'item-images');

create policy "open update item images"
on storage.objects
for update
using (bucket_id = 'item-images')
with check (bucket_id = 'item-images');

create policy "open delete item images"
on storage.objects
for delete
using (bucket_id = 'item-images');

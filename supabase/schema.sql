-- =====================================================================
-- WorthyOps Content Tracking: Supabase schema
-- Paste into Supabase > SQL Editor > New query > Run.
-- Run it once on a fresh project.
-- =====================================================================


-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------

-- One row per client the agency manages.
create table public.clients (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (length(trim(name)) > 0),
  created_at  timestamptz not null default now()
);

-- One row per login (created automatically when a Supabase Auth user is created).
-- role = 'admin'  -> sees and manages every client
-- role = 'client' -> sees only the client in client_id (read-only)
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text not null,
  full_name   text,
  role        text not null default 'client' check (role in ('admin', 'client')),
  client_id   uuid references public.clients (id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Every post / carousel / reel / story sequence / thread / video.
create table public.content_items (
  id            uuid primary key default gen_random_uuid(),
  client_id     uuid not null references public.clients (id) on delete cascade,
  title         text not null check (length(trim(title)) > 0),
  platform      text not null check (platform in ('LinkedIn', 'Instagram', 'Twitter', 'YouTube')),
  type          text not null,
  publish_date  date not null,
  status        text not null default 'planned' check (status in ('planned', 'scheduled', 'published')),
  link          text,
  notes         text,
  reach         integer not null default 0 check (reach >= 0),
  likes         integer not null default 0 check (likes >= 0),
  comments      integer not null default 0 check (comments >= 0),
  shares        integer not null default 0 check (shares >= 0),
  saves         integer not null default 0 check (saves >= 0),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),

  -- Same platform -> content type rules as the website.
  constraint valid_type_for_platform check (
    (platform = 'LinkedIn'  and type in ('Post', 'Carousel', 'Video')) or
    (platform = 'Instagram' and type in ('Post', 'Carousel', 'Reel', 'Story Sequence')) or
    (platform = 'Twitter'   and type in ('Post', 'Thread')) or
    (platform = 'YouTube'   and type in ('Video', 'Short'))
  )
);

create index content_items_client_date_idx on public.content_items (client_id, publish_date desc);
create index profiles_client_idx on public.profiles (client_id);


-- ---------------------------------------------------------------------
-- 2. Keep updated_at current
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger content_items_set_updated_at
  before update on public.content_items
  for each row execute function public.set_updated_at();


-- ---------------------------------------------------------------------
-- 3. Create a profile automatically for every new Auth user
--    Role and client come from app_metadata, which only the server
--    (service role) can set, so nobody can make themselves an admin.
-- ---------------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role, client_id)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data ->> 'full_name',
    coalesce(new.raw_app_meta_data ->> 'role', 'client'),
    nullif(new.raw_app_meta_data ->> 'client_id', '')::uuid
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- 4. Helper functions used by the security rules
-- ---------------------------------------------------------------------

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.my_client_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select client_id from public.profiles where id = auth.uid();
$$;


-- ---------------------------------------------------------------------
-- 5. Row Level Security (who can see / change what)
-- ---------------------------------------------------------------------

alter table public.clients       enable row level security;
alter table public.profiles      enable row level security;
alter table public.content_items enable row level security;

-- clients
create policy "Admins manage clients"
  on public.clients for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Clients read their own client"
  on public.clients for select to authenticated
  using (id = public.my_client_id());

-- profiles (rows are created by the trigger above, never by the browser)
create policy "Users read their own profile"
  on public.profiles for select to authenticated
  using (id = auth.uid());

create policy "Admins read all profiles"
  on public.profiles for select to authenticated
  using (public.is_admin());

create policy "Admins update profiles"
  on public.profiles for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- content_items
create policy "Admins manage content"
  on public.content_items for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy "Clients read their own content"
  on public.content_items for select to authenticated
  using (client_id = public.my_client_id());


-- =====================================================================
-- AFTER RUNNING THIS:
-- 1. Authentication > Users > Add user > Create new user
--    (your admin email + password, tick "Auto Confirm User").
-- 2. Then run this once, with your email, to make that user the admin:
--
--    update public.profiles
--    set role = 'admin', client_id = null
--    where email = 'you@yourdomain.com';
-- =====================================================================

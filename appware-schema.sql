-- ============================================================
--  Hungry × AppWare Ecosystem — Supabase Schema
--  Paste the entire file into the Supabase SQL Editor and run.
-- ============================================================

-- ── Enable UUID extension ────────────────────────────────────
create extension if not exists "uuid-ossp";


-- ── households ───────────────────────────────────────────────
create table if not exists public.households (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  invite_code     text unique not null default upper(substring(md5(random()::text), 1, 8)),
  budget_limit    numeric(10,2) not null default 0,
  created_by      uuid references auth.users(id) on delete set null,
  created_at      timestamptz not null default now()
);

alter table public.households enable row level security;

create policy "members can view their household"
  on public.households for select
  using (
    id in (
      select active_household_id from public.profiles where id = auth.uid()
    )
    or created_by = auth.uid()
  );

create policy "household creator can update"
  on public.households for update
  using (created_by = auth.uid());

create policy "authenticated users can insert"
  on public.households for insert
  with check (auth.uid() is not null);


-- ── profiles ─────────────────────────────────────────────────
create table if not exists public.profiles (
  id                  uuid primary key references auth.users(id) on delete cascade,
  display_name        text,
  active_household_id uuid references public.households(id) on delete set null,
  friend_code         text unique default upper(substring(md5(random()::text), 1, 8)),
  created_at          timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "users can view any profile"
  on public.profiles for select
  using (true);

create policy "users can manage their own profile"
  on public.profiles for all
  using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create profile row on first sign-in
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ── fridge_inventory ─────────────────────────────────────────
create table if not exists public.fridge_inventory (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  household_id    uuid references public.households(id) on delete set null,
  item_name       text not null,
  raw_name        text,
  category        text,
  quantity        numeric not null default 1,
  unit            text,
  expiry_date     date,
  price           numeric(10,2),
  barcode         text,
  nutrition       jsonb,
  is_household    boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.fridge_inventory enable row level security;

create policy "users can manage their own pantry"
  on public.fridge_inventory for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "household members can view shared items"
  on public.fridge_inventory for select
  using (
    is_household = true
    and household_id in (
      select active_household_id from public.profiles where id = auth.uid()
    )
  );


-- ── shopping_list ────────────────────────────────────────────
create table if not exists public.shopping_list (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  household_id    uuid references public.households(id) on delete cascade,
  item_name       text not null,
  is_completed    boolean not null default false,
  price           numeric(10,2),
  aisle           text,
  created_at      timestamptz not null default now()
);

alter table public.shopping_list enable row level security;

create policy "users can manage their personal list"
  on public.shopping_list for all
  using (user_id = auth.uid() and household_id is null)
  with check (user_id = auth.uid());

create policy "household members can manage shared list"
  on public.shopping_list for all
  using (
    household_id in (
      select active_household_id from public.profiles where id = auth.uid()
    )
  )
  with check (
    household_id in (
      select active_household_id from public.profiles where id = auth.uid()
    )
  );


-- ── saved_recipes ────────────────────────────────────────────
create table if not exists public.saved_recipes (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  household_id    uuid references public.households(id) on delete cascade,
  recipe_id       text not null,
  recipe_name     text not null,
  meal_type       text,
  cuisine         text,
  ingredients     jsonb,
  steps           jsonb,
  created_at      timestamptz not null default now(),
  unique (user_id, recipe_id, household_id)
);

alter table public.saved_recipes enable row level security;

create policy "users can manage their saved recipes"
  on public.saved_recipes for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "household members can view shared recipes"
  on public.saved_recipes for select
  using (
    household_id in (
      select active_household_id from public.profiles where id = auth.uid()
    )
  );


-- ── friendships ──────────────────────────────────────────────
create table if not exists public.friendships (
  user_id     uuid not null references auth.users(id) on delete cascade,
  friend_id   uuid not null references auth.users(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, friend_id)
);

alter table public.friendships enable row level security;

create policy "users can manage their own friendships"
  on public.friendships for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can see friendships where they are the friend"
  on public.friendships for select
  using (friend_id = auth.uid());


-- ── friend_requests ──────────────────────────────────────────
create table if not exists public.friend_requests (
  id          uuid primary key default uuid_generate_v4(),
  sender_id   uuid not null references auth.users(id) on delete cascade,
  receiver_id uuid not null references auth.users(id) on delete cascade,
  status      text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at  timestamptz not null default now(),
  unique (sender_id, receiver_id)
);

alter table public.friend_requests enable row level security;

create policy "users can send friend requests"
  on public.friend_requests for insert
  with check (sender_id = auth.uid());

create policy "users can view their own requests"
  on public.friend_requests for select
  using (sender_id = auth.uid() or receiver_id = auth.uid());

create policy "receiver can update status"
  on public.friend_requests for update
  using (receiver_id = auth.uid());


-- ── Realtime subscriptions ───────────────────────────────────
-- Enable real-time for shopping list and fridge (used by HouseholdTab and PantryManager)
alter publication supabase_realtime add table public.shopping_list;
alter publication supabase_realtime add table public.fridge_inventory;

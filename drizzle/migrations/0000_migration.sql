create type public.app_role as enum ('admin');
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null,
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

-- first registered user becomes admin
create or replace function public.handle_first_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from public.user_roles where role = 'admin') then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  end if;
  return new;
end $$;
create trigger on_auth_user_first_admin after insert on auth.users
for each row execute function public.handle_first_admin();

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null,
  lsc text,
  created_at timestamptz not null default now()
);
create table public.groups (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  name text not null
);
create table public.athletes (
  id uuid primary key default gen_random_uuid(),
  tm_athlete_id text unique,
  federation_id text,
  first_name text not null,
  last_name text not null,
  birth_date date,
  gender text check (gender in ('M','F','X')),
  group_id uuid references public.groups(id) on delete set null,
  team_id uuid references public.teams(id) on delete set null,
  active_status boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.meets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  location text,
  start_date date,
  end_date date,
  course text not null default 'LCM' check (course in ('LCM','SCM','SCY')),
  altitude integer default 0,
  created_at timestamptz not null default now()
);
create table public.events (
  id uuid primary key default gen_random_uuid(),
  meet_id uuid not null references public.meets(id) on delete cascade,
  event_number text,
  distance integer not null,
  stroke smallint not null check (stroke between 1 and 7),
  gender text,
  min_age integer,
  max_age integer,
  is_relay boolean not null default false,
  unique (meet_id, event_number, distance, stroke, gender, min_age, max_age)
);
create table public.results (
  id uuid primary key default gen_random_uuid(),
  athlete_id uuid not null references public.athletes(id) on delete cascade,
  meet_id uuid not null references public.meets(id) on delete cascade,
  event_id uuid references public.events(id) on delete cascade,
  seed_time_ms integer,
  final_time_ms integer,
  course text,
  place integer,
  aqua_points integer,
  is_dq boolean not null default false,
  video_url text,
  stroke_rate numeric,
  round text default 'F',
  created_at timestamptz not null default now(),
  unique (athlete_id, event_id, round)
);
create table public.splits (
  id uuid primary key default gen_random_uuid(),
  result_id uuid not null references public.results(id) on delete cascade,
  split_distance integer not null,
  cumulative_time_ms integer not null,
  lap_time_ms integer,
  unique (result_id, split_distance)
);
create table public.time_standards (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  gender text,
  age_group text,
  distance integer not null,
  stroke smallint not null,
  course text not null,
  qualifying_time_ms integer not null
);
create table public.import_logs (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  file_type text not null,
  summary jsonb,
  created_at timestamptz not null default now()
);

create index on public.results(athlete_id);
create index on public.results(meet_id);
create index on public.splits(result_id);

do $$
declare t text;
begin
  foreach t in array array['teams','groups','athletes','meets','events','results','splits','time_standards','import_logs'] loop
    execute format('grant select, insert, update, delete on public.%I to authenticated', t);
    execute format('grant all on public.%I to service_role', t);
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "admins all" on public.%I for all to authenticated using (public.has_role(auth.uid(), ''admin'')) with check (public.has_role(auth.uid(), ''admin''))', t);
  end loop;
end $$;
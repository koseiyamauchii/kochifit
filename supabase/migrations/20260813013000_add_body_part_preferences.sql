create table if not exists public.body_part_preferences (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body_part_id uuid not null references public.body_parts(id) on delete cascade,
  display_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint body_part_preferences_display_order_positive check (display_order > 0),
  unique (user_id, body_part_id)
);

create index if not exists body_part_preferences_user_order_idx
on public.body_part_preferences(user_id, display_order);

drop trigger if exists body_part_preferences_set_updated_at on public.body_part_preferences;
create trigger body_part_preferences_set_updated_at
before update on public.body_part_preferences
for each row execute function public.set_updated_at();

grant select, insert, update, delete on table public.body_part_preferences to authenticated;

alter table public.body_part_preferences enable row level security;

create policy "body_part_preferences select own"
on public.body_part_preferences for select to authenticated
using (auth.uid() = user_id);

create policy "body_part_preferences insert own"
on public.body_part_preferences for insert to authenticated
with check (auth.uid() = user_id);

create policy "body_part_preferences update own"
on public.body_part_preferences for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "body_part_preferences delete own"
on public.body_part_preferences for delete to authenticated
using (auth.uid() = user_id);

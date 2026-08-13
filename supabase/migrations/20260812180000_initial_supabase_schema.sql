create extension if not exists pgcrypto;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.body_parts (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  display_name text not null,
  display_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint body_parts_key_format check (key ~ '^[a-z0-9_]+$'),
  constraint body_parts_display_order_positive check (display_order > 0)
);

create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  body_part_id uuid not null references public.body_parts(id) on delete restrict,
  seed_key text,
  name text not null,
  display_order integer not null,
  active boolean not null default true,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint exercises_name_not_blank check (length(btrim(name)) > 0),
  constraint exercises_seed_key_format check (seed_key is null or seed_key ~ '^[a-z0-9_]+$'),
  constraint exercises_display_order_positive check (display_order > 0),
  constraint exercises_archive_consistency check (
    (active = true and archived_at is null)
    or (active = false and archived_at is not null)
  )
);

create table public.workouts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_date date not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id)
);

create table public.workout_exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_id uuid not null,
  exercise_id uuid not null,
  display_order integer not null,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, user_id),
  constraint workout_exercises_workout_owner_fk
    foreign key (workout_id, user_id)
    references public.workouts(id, user_id)
    on delete cascade,
  constraint workout_exercises_exercise_owner_fk
    foreign key (exercise_id, user_id)
    references public.exercises(id, user_id)
    on delete restrict,
  constraint workout_exercises_display_order_positive check (display_order > 0)
);

create table public.sets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  workout_exercise_id uuid not null,
  set_number integer not null,
  weight_kg numeric(7, 2),
  reps integer,
  rir numeric(4, 1),
  rpe numeric(4, 1),
  is_warmup boolean not null default false,
  duration_sec integer,
  distance_km numeric(8, 3),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint sets_workout_exercise_owner_fk
    foreign key (workout_exercise_id, user_id)
    references public.workout_exercises(id, user_id)
    on delete cascade,
  constraint sets_set_number_positive check (set_number > 0),
  constraint sets_weight_non_negative check (weight_kg is null or weight_kg >= 0),
  constraint sets_reps_non_negative check (reps is null or reps >= 0),
  constraint sets_rir_range check (rir is null or (rir >= 0 and rir <= 10)),
  constraint sets_rpe_range check (rpe is null or (rpe >= 0 and rpe <= 10)),
  constraint sets_duration_non_negative check (duration_sec is null or duration_sec >= 0),
  constraint sets_distance_non_negative check (distance_km is null or distance_km >= 0),
  unique (workout_exercise_id, set_number)
);

create table public.exercise_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  exercise_id uuid not null,
  setting_key text not null,
  setting_label text not null,
  setting_value text not null,
  display_order integer not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint exercise_settings_exercise_owner_fk
    foreign key (exercise_id, user_id)
    references public.exercises(id, user_id)
    on delete cascade,
  constraint exercise_settings_key_format check (setting_key ~ '^[a-z0-9_]+$'),
  constraint exercise_settings_label_not_blank check (length(btrim(setting_label)) > 0),
  constraint exercise_settings_display_order_positive check (display_order > 0),
  unique (user_id, exercise_id, setting_key)
);

create index body_parts_display_order_idx on public.body_parts(display_order);
create index exercises_user_body_part_order_idx on public.exercises(user_id, body_part_id, display_order);
create index exercises_user_active_idx on public.exercises(user_id, active);
create unique index exercises_user_seed_key_unique_idx on public.exercises(user_id, seed_key) where seed_key is not null;
create index workouts_user_date_idx on public.workouts(user_id, workout_date desc);
create index workout_exercises_user_workout_order_idx on public.workout_exercises(user_id, workout_id, display_order);
create index workout_exercises_user_exercise_idx on public.workout_exercises(user_id, exercise_id);
create index sets_user_workout_exercise_order_idx on public.sets(user_id, workout_exercise_id, set_number);
create index exercise_settings_user_exercise_order_idx on public.exercise_settings(user_id, exercise_id, display_order);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

create trigger body_parts_set_updated_at
before update on public.body_parts
for each row execute function public.set_updated_at();

create trigger exercises_set_updated_at
before update on public.exercises
for each row execute function public.set_updated_at();

create trigger workouts_set_updated_at
before update on public.workouts
for each row execute function public.set_updated_at();

create trigger workout_exercises_set_updated_at
before update on public.workout_exercises
for each row execute function public.set_updated_at();

create trigger sets_set_updated_at
before update on public.sets
for each row execute function public.set_updated_at();

create trigger exercise_settings_set_updated_at
before update on public.exercise_settings
for each row execute function public.set_updated_at();

insert into public.body_parts (id, key, display_name, display_order)
values
  ('10000000-0000-0000-0000-000000000001', 'chest', '胸', 1),
  ('10000000-0000-0000-0000-000000000002', 'back', '背中', 2),
  ('10000000-0000-0000-0000-000000000003', 'legs', '脚', 3),
  ('10000000-0000-0000-0000-000000000004', 'shoulders', '肩', 4),
  ('10000000-0000-0000-0000-000000000005', 'arms', '腕', 5),
  ('10000000-0000-0000-0000-000000000006', 'abs', '腹筋', 6),
  ('10000000-0000-0000-0000-000000000007', 'cardio', '有酸素運動', 7)
on conflict (key) do update
set
  display_name = excluded.display_name,
  display_order = excluded.display_order;

create or replace function public.initialize_user(
  target_user_id uuid,
  target_display_name text default null,
  target_avatar_url text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if target_user_id is null then
    return;
  end if;

  insert into public.profiles (id, display_name, avatar_url)
  values (target_user_id, target_display_name, target_avatar_url)
  on conflict (id) do update
  set
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    avatar_url = coalesce(public.profiles.avatar_url, excluded.avatar_url);

  insert into public.exercises (user_id, body_part_id, seed_key, name, display_order)
  select
    target_user_id,
    body_parts.id,
    seed.seed_key,
    seed.name,
    seed.display_order
  from (
    values
      ('chest', 'chest_bench_press', 'ベンチプレス', 1),
      ('chest', 'chest_incline_dumbbell_press', 'インクラインダンベルプレス', 2),
      ('chest', 'chest_chest_press', 'チェストプレス', 3),
      ('chest', 'chest_pec_fly', 'ペックフライ', 4),
      ('chest', 'chest_cable_fly', 'ケーブルフライ', 5),
      ('back', 'back_lat_pulldown', 'ラットプルダウン', 1),
      ('back', 'back_pull_up', '懸垂', 2),
      ('back', 'back_seated_row', 'シーテッドロー', 3),
      ('back', 'back_one_hand_dumbbell_row', 'ワンハンドダンベルロー', 4),
      ('back', 'back_deadlift', 'デッドリフト', 5),
      ('legs', 'legs_squat', 'スクワット', 1),
      ('legs', 'legs_leg_press', 'レッグプレス', 2),
      ('legs', 'legs_leg_extension', 'レッグエクステンション', 3),
      ('legs', 'legs_leg_curl', 'レッグカール', 4),
      ('legs', 'legs_calf_raise', 'カーフレイズ', 5),
      ('shoulders', 'shoulders_shoulder_press', 'ショルダープレス', 1),
      ('shoulders', 'shoulders_side_raise', 'サイドレイズ', 2),
      ('shoulders', 'shoulders_rear_raise', 'リアレイズ', 3),
      ('shoulders', 'shoulders_face_pull', 'フェイスプル', 4),
      ('arms', 'arms_arm_curl', 'アームカール', 1),
      ('arms', 'arms_incline_dumbbell_curl', 'インクラインダンベルカール', 2),
      ('arms', 'arms_hammer_curl', 'ハンマーカール', 3),
      ('arms', 'arms_triceps_pressdown', 'トライセプスプレスダウン', 4),
      ('arms', 'arms_skull_crusher', 'スカルクラッシャー', 5),
      ('abs', 'abs_crunch', 'クランチ', 1),
      ('abs', 'abs_ab_roller', 'アブローラー', 2),
      ('abs', 'abs_leg_raise', 'レッグレイズ', 3),
      ('cardio', 'cardio_treadmill', 'トレッドミル', 1),
      ('cardio', 'cardio_exercise_bike', 'エアロバイク', 2),
      ('cardio', 'cardio_cross_trainer', 'クロストレーナー', 3)
  ) as seed(body_part_key, seed_key, name, display_order)
  join public.body_parts on body_parts.key = seed.body_part_key
  on conflict (user_id, seed_key) where seed_key is not null do nothing;
end;
$$;

create or replace function public.initialize_current_user()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  metadata jsonb;
begin
  metadata = coalesce(auth.jwt() -> 'user_metadata', '{}'::jsonb);

  perform public.initialize_user(
    auth.uid(),
    coalesce(metadata ->> 'full_name', metadata ->> 'name', auth.jwt() ->> 'email'),
    metadata ->> 'avatar_url'
  );
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.initialize_user(
    new.id,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', new.email),
    new.raw_user_meta_data ->> 'avatar_url'
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

revoke execute on function public.initialize_user(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.initialize_current_user() from public, anon;
grant execute on function public.initialize_current_user() to authenticated;

revoke all on all tables in schema public from anon;
grant usage on schema public to authenticated;
grant select on table public.body_parts to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.exercises to authenticated;
grant select, insert, update, delete on table public.workouts to authenticated;
grant select, insert, update, delete on table public.workout_exercises to authenticated;
grant select, insert, update, delete on table public.sets to authenticated;
grant select, insert, update, delete on table public.exercise_settings to authenticated;

alter table public.profiles enable row level security;
alter table public.body_parts enable row level security;
alter table public.exercises enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;
alter table public.sets enable row level security;
alter table public.exercise_settings enable row level security;

create policy "profiles select own"
on public.profiles for select to authenticated
using (auth.uid() = id);

create policy "profiles insert own"
on public.profiles for insert to authenticated
with check (auth.uid() = id);

create policy "profiles update own"
on public.profiles for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

create policy "body_parts select authenticated"
on public.body_parts for select to authenticated
using (true);

create policy "exercises select own"
on public.exercises for select to authenticated
using (auth.uid() = user_id);

create policy "exercises insert own"
on public.exercises for insert to authenticated
with check (auth.uid() = user_id);

create policy "exercises update own"
on public.exercises for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "exercises delete own"
on public.exercises for delete to authenticated
using (auth.uid() = user_id);

create policy "workouts select own"
on public.workouts for select to authenticated
using (auth.uid() = user_id);

create policy "workouts insert own"
on public.workouts for insert to authenticated
with check (auth.uid() = user_id);

create policy "workouts update own"
on public.workouts for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "workouts delete own"
on public.workouts for delete to authenticated
using (auth.uid() = user_id);

create policy "workout_exercises select own"
on public.workout_exercises for select to authenticated
using (auth.uid() = user_id);

create policy "workout_exercises insert own"
on public.workout_exercises for insert to authenticated
with check (auth.uid() = user_id);

create policy "workout_exercises update own"
on public.workout_exercises for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "workout_exercises delete own"
on public.workout_exercises for delete to authenticated
using (auth.uid() = user_id);

create policy "sets select own"
on public.sets for select to authenticated
using (auth.uid() = user_id);

create policy "sets insert own"
on public.sets for insert to authenticated
with check (auth.uid() = user_id);

create policy "sets update own"
on public.sets for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "sets delete own"
on public.sets for delete to authenticated
using (auth.uid() = user_id);

create policy "exercise_settings select own"
on public.exercise_settings for select to authenticated
using (auth.uid() = user_id);

create policy "exercise_settings insert own"
on public.exercise_settings for insert to authenticated
with check (auth.uid() = user_id);

create policy "exercise_settings update own"
on public.exercise_settings for update to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);

create policy "exercise_settings delete own"
on public.exercise_settings for delete to authenticated
using (auth.uid() = user_id);

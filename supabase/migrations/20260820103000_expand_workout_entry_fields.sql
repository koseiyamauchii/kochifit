alter table public.profiles
  add column if not exists session_sort_order text not null default 'asc';

alter table public.profiles
  drop constraint if exists profiles_session_sort_order_valid,
  add constraint profiles_session_sort_order_valid
    check (session_sort_order in ('asc', 'desc'));

alter table public.workout_exercises
  add column if not exists condition text,
  add column if not exists elapsed_sec integer;

alter table public.workout_exercises
  drop constraint if exists workout_exercises_elapsed_non_negative,
  add constraint workout_exercises_elapsed_non_negative
    check (elapsed_sec is null or elapsed_sec >= 0);

alter table public.sets
  add column if not exists is_assisted boolean not null default false,
  add column if not exists speed_kmh numeric(8, 2),
  add column if not exists calories_kcal numeric(8, 1),
  add column if not exists left_reps integer,
  add column if not exists right_reps integer;

alter table public.sets
  drop constraint if exists sets_speed_non_negative,
  drop constraint if exists sets_calories_non_negative,
  drop constraint if exists sets_left_reps_non_negative,
  drop constraint if exists sets_right_reps_non_negative,
  add constraint sets_speed_non_negative check (speed_kmh is null or speed_kmh >= 0),
  add constraint sets_calories_non_negative check (calories_kcal is null or calories_kcal >= 0),
  add constraint sets_left_reps_non_negative check (left_reps is null or left_reps >= 0),
  add constraint sets_right_reps_non_negative check (right_reps is null or right_reps >= 0);

comment on column public.workout_exercises.condition is
  'Condition note entered with the first set of an exercise session.';
comment on column public.workout_exercises.elapsed_sec is
  'Elapsed seconds from exercise selection to the final set input.';
comment on column public.profiles.session_sort_order is
  'Display order for same-day exercise sessions: asc or desc.';

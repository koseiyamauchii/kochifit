alter table public.profiles
  drop constraint if exists profiles_one_month_goal_workout_days_range,
  drop constraint if exists profiles_three_month_goal_workout_days_range,
  drop constraint if exists profiles_one_year_goal_workout_days_range;

alter table public.profiles
  drop column if exists one_month_goal_workout_days,
  drop column if exists three_month_goal_workout_days,
  drop column if exists one_year_goal_workout_days;

alter table public.profiles
  add column if not exists training_purpose text,
  add column if not exists final_goal text,
  add column if not exists one_month_goal_date date default ((current_date + interval '1 month')::date),
  add column if not exists three_month_goal_date date default ((current_date + interval '3 months')::date),
  add column if not exists one_year_goal_date date default ((current_date + interval '1 year')::date);

alter table public.profiles
  alter column one_month_goal_date set default ((current_date + interval '1 month')::date),
  alter column three_month_goal_date set default ((current_date + interval '3 months')::date),
  alter column one_year_goal_date set default ((current_date + interval '1 year')::date);

alter table public.profiles
  drop constraint if exists profiles_training_purpose_length,
  add constraint profiles_training_purpose_length
    check (training_purpose is null or char_length(training_purpose) <= 200);

alter table public.profiles
  drop constraint if exists profiles_final_goal_length,
  add constraint profiles_final_goal_length
    check (final_goal is null or char_length(final_goal) <= 200);

update public.profiles
set
  one_month_goal_date = coalesce(one_month_goal_date, (current_date + interval '1 month')::date),
  three_month_goal_date = coalesce(three_month_goal_date, (current_date + interval '3 months')::date),
  one_year_goal_date = coalesce(one_year_goal_date, (current_date + interval '1 year')::date);

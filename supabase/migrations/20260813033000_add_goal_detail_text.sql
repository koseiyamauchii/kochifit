alter table public.profiles
  add column if not exists one_month_goal_text text,
  add column if not exists three_month_goal_text text,
  add column if not exists one_year_goal_text text;

alter table public.profiles
  drop constraint if exists profiles_one_month_goal_text_length,
  add constraint profiles_one_month_goal_text_length
    check (one_month_goal_text is null or char_length(one_month_goal_text) <= 200);

alter table public.profiles
  drop constraint if exists profiles_three_month_goal_text_length,
  add constraint profiles_three_month_goal_text_length
    check (three_month_goal_text is null or char_length(three_month_goal_text) <= 200);

alter table public.profiles
  drop constraint if exists profiles_one_year_goal_text_length,
  add constraint profiles_one_year_goal_text_length
    check (one_year_goal_text is null or char_length(one_year_goal_text) <= 200);

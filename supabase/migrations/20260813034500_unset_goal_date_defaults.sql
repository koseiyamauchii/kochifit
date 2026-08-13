alter table public.profiles
  alter column one_month_goal_date drop default,
  alter column three_month_goal_date drop default,
  alter column one_year_goal_date drop default;

update public.profiles
set
  one_month_goal_date = case
    when one_month_goal_text is null and one_month_goal_date = (current_date + interval '1 month')::date then null
    else one_month_goal_date
  end,
  three_month_goal_date = case
    when three_month_goal_text is null and three_month_goal_date = (current_date + interval '3 months')::date then null
    else three_month_goal_date
  end,
  one_year_goal_date = case
    when one_year_goal_text is null and one_year_goal_date = (current_date + interval '1 year')::date then null
    else one_year_goal_date
  end;

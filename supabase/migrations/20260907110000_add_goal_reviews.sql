begin;

create table public.goal_reviews (
  id uuid primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  goal_kind text not null check (goal_kind in ('one_month', 'three_month', 'one_year')),
  goal_text text not null check (char_length(goal_text) between 1 and 200),
  goal_deadline date not null,
  period_start date not null check (period_start <= goal_deadline),
  achieved boolean not null,
  achievement_percent integer not null check (achievement_percent between 0 and 100),
  reflection text not null check (char_length(reflection) between 1 and 2000),
  next_action text not null check (char_length(next_action) between 1 and 2000),
  next_goal_text text not null check (char_length(next_goal_text) between 1 and 200),
  next_goal_deadline date not null check (next_goal_deadline > goal_deadline),
  progress jsonb not null default '{}'::jsonb check (jsonb_typeof(progress) = 'object'),
  reviewed_at timestamptz not null default now(),
  unique (user_id, goal_kind, goal_deadline, goal_text)
);
create index goal_reviews_user_date_idx on public.goal_reviews(user_id, reviewed_at desc);
alter table public.goal_reviews enable row level security;
revoke all on table public.goal_reviews from anon, authenticated;
grant select, insert on table public.goal_reviews to authenticated;
create policy goal_reviews_select_own on public.goal_reviews for select to authenticated using (auth.uid() = user_id);
create policy goal_reviews_insert_own on public.goal_reviews for insert to authenticated with check (auth.uid() = user_id);

-- Invoker permissions and RLS apply. Review + rollover succeed or fail together.
create function public.complete_goal_review(
  p_id uuid, p_goal_kind text, p_goal_text text, p_goal_deadline date, p_period_start date,
  p_achieved boolean, p_achievement_percent integer, p_reflection text, p_next_action text,
  p_next_goal_text text, p_next_goal_deadline date, p_progress jsonb
) returns uuid language plpgsql security invoker set search_path = '' as $$
declare
  current_profile public.profiles%rowtype;
  expected_text text;
  expected_date date;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into strict current_profile from public.profiles where id = auth.uid() for update;
  if exists (select 1 from public.goal_reviews where id = p_id and user_id = auth.uid()) then return p_id; end if;
  case p_goal_kind
    when 'one_month' then expected_text := current_profile.one_month_goal_text; expected_date := current_profile.one_month_goal_date;
    when 'three_month' then expected_text := current_profile.three_month_goal_text; expected_date := current_profile.three_month_goal_date;
    when 'one_year' then expected_text := current_profile.one_year_goal_text; expected_date := current_profile.one_year_goal_date;
    else raise exception 'invalid goal kind';
  end case;
  if expected_text is distinct from p_goal_text or expected_date is distinct from p_goal_deadline then
    raise exception 'goal changed; reload before reviewing';
  end if;
  if p_goal_deadline > (now() at time zone 'Asia/Tokyo')::date then raise exception 'goal is not due'; end if;
  if p_next_goal_deadline <= (now() at time zone 'Asia/Tokyo')::date then raise exception 'next deadline must be in the future'; end if;
  insert into public.goal_reviews (id, user_id, goal_kind, goal_text, goal_deadline, period_start, achieved, achievement_percent, reflection, next_action, next_goal_text, next_goal_deadline, progress)
  values (p_id, auth.uid(), p_goal_kind, p_goal_text, p_goal_deadline, p_period_start, p_achieved, p_achievement_percent, p_reflection, p_next_action, p_next_goal_text, p_next_goal_deadline, p_progress);
  update public.profiles set
    one_month_goal_text = case when p_goal_kind = 'one_month' then p_next_goal_text else one_month_goal_text end,
    one_month_goal_date = case when p_goal_kind = 'one_month' then p_next_goal_deadline else one_month_goal_date end,
    three_month_goal_text = case when p_goal_kind = 'three_month' then p_next_goal_text else three_month_goal_text end,
    three_month_goal_date = case when p_goal_kind = 'three_month' then p_next_goal_deadline else three_month_goal_date end,
    one_year_goal_text = case when p_goal_kind = 'one_year' then p_next_goal_text else one_year_goal_text end,
    one_year_goal_date = case when p_goal_kind = 'one_year' then p_next_goal_deadline else one_year_goal_date end
  where id = auth.uid();
  return p_id;
end;
$$;
revoke all on function public.complete_goal_review(uuid,text,text,date,date,boolean,integer,text,text,text,date,jsonb) from public, anon;
grant execute on function public.complete_goal_review(uuid,text,text,date,date,boolean,integer,text,text,text,date,jsonb) to authenticated;
commit;

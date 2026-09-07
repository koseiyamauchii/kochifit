-- Run against a development or linked database as an administrator.
-- Synthetic users and all test writes are rolled back, including on failure.
begin;
do $test$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  review_id uuid := gen_random_uuid();
  deadline date := (now() at time zone 'Asia/Tokyo')::date;
  result_id uuid;
begin
  insert into auth.users (id, email, raw_user_meta_data) values
    (user_a, user_a::text || '@example.invalid', '{}'::jsonb),
    (user_b, user_b::text || '@example.invalid', '{}'::jsonb);
  update public.profiles set one_month_goal_text = 'Review test', one_month_goal_date = deadline where id = user_a;
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  execute 'set local role authenticated';
  begin
    perform public.complete_goal_review(review_id, 'one_month', 'Review test', deadline, deadline - 30,
      false, 80, 'Test reflection', 'Test action', 'Next test', deadline, '{"workoutDays":5,"setCount":15}'::jsonb);
    raise exception 'invalid deadline unexpectedly accepted';
  exception when raise_exception then
    if sqlerrm <> 'next deadline must be in the future' then raise; end if;
  end;
  if exists(select 1 from public.goal_reviews where id = review_id) then raise exception 'failed review was saved'; end if;
  if (select one_month_goal_text from public.profiles where id = user_a) <> 'Review test' then raise exception 'failed review changed active goal'; end if;
  result_id := public.complete_goal_review(review_id, 'one_month', 'Review test', deadline, deadline - 30,
    false, 80, 'Test reflection', 'Test action', 'Next test', deadline + 30, '{"workoutDays":5,"setCount":15}'::jsonb);
  if result_id <> review_id then raise exception 'wrong review id'; end if;
  perform public.complete_goal_review(review_id, 'one_month', 'Review test', deadline, deadline - 30,
    false, 80, 'Test reflection', 'Test action', 'Next test', deadline + 30, '{"workoutDays":5,"setCount":15}'::jsonb);
  if (select count(*) from public.goal_reviews where id = review_id) <> 1 then raise exception 'retry is not idempotent'; end if;
  if (select one_month_goal_text from public.profiles where id = user_a) <> 'Next test' then raise exception 'goal did not roll over'; end if;
  perform set_config('request.jwt.claim.sub', user_b::text, true);
  if exists(select 1 from public.goal_reviews where id = review_id) then raise exception 'user B read user A review'; end if;
  begin
    insert into public.goal_reviews (id,user_id,goal_kind,goal_text,goal_deadline,period_start,achieved,achievement_percent,reflection,next_action,next_goal_text,next_goal_deadline)
    values (gen_random_uuid(),user_a,'one_month','Forbidden',deadline,deadline-30,false,0,'Test','Test','Test',deadline+30);
    raise exception 'cross-user insert unexpectedly accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.goal_reviews set reflection = 'Forbidden' where id = review_id;
    raise exception 'immutable review update unexpectedly accepted';
  exception when insufficient_privilege then null;
  end;
  begin
    delete from public.goal_reviews where id = review_id;
    raise exception 'immutable review deletion unexpectedly accepted';
  exception when insufficient_privilege then null;
  end;
  if has_table_privilege('anon', 'public.goal_reviews', 'select') then raise exception 'anon table access'; end if;
  if has_function_privilege('anon', 'public.complete_goal_review(uuid,text,text,date,date,boolean,integer,text,text,text,date,jsonb)', 'execute') then raise exception 'anon RPC access'; end if;
  execute 'reset role';
end;
$test$;
rollback;
select 'Goal review transaction, retry, RLS and grants passed; all fixtures rolled back' as result;

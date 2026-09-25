-- Run on a development database as an administrator. All fixtures roll back.
begin;
do $test$
declare
  user_a uuid := gen_random_uuid();
  user_b uuid := gen_random_uuid();
  exercise_a uuid;
  workout_a uuid;
  entry_a uuid;
  set_a uuid;
  other_workout uuid;
  other_entry uuid;
  before_count integer;
begin
  insert into auth.users(id, email, raw_user_meta_data) values
    (user_a, user_a::text || '@example.invalid', '{}'::jsonb),
    (user_b, user_b::text || '@example.invalid', '{}'::jsonb);
  select id into strict exercise_a from public.exercises where user_id = user_a limit 1;
  perform set_config('request.jwt.claim.sub', user_a::text, true);
  execute 'set local role authenticated';
  workout_a := public.save_workout(null, null, '2026-09-25', exercise_a, 'original', 'good', 60,
    '[{"weight_kg":20,"left_reps":10,"right_reps":12,"note":"set note","is_assisted":true}]');
  select id into strict entry_a from public.workout_exercises where workout_id = workout_a;
  select id into strict set_a from public.sets where workout_exercise_id = entry_a;
  if not exists(select 1 from public.sets where id = set_a and left_reps = 10 and right_reps = 12 and is_assisted and note = 'set note') then
    raise exception 'set fields not preserved';
  end if;
  begin
    perform public.save_workout(workout_a, entry_a, '2026-09-24', exercise_a, 'changed', 'bad', 90,
      '[{"weight_kg":30,"reps":10},{"weight_kg":30,"reps":-1}]');
    raise exception 'invalid update accepted';
  exception when check_violation then null;
  end;
  if not exists(select 1 from public.workouts where id = workout_a and workout_date = '2026-09-25' and note = 'original') then
    raise exception 'parent update was not rolled back';
  end if;
  if not exists(select 1 from public.workout_exercises where id = entry_a and condition = 'good' and elapsed_sec = 60) then
    raise exception 'entry update was not rolled back';
  end if;
  if not exists(select 1 from public.sets where id = set_a and weight_kg = 20) or
    (select count(*) from public.sets where workout_exercise_id = entry_a) <> 1 then
    raise exception 'original sets were lost or partially replaced';
  end if;
  select count(*) into before_count from public.workouts;
  begin
    perform public.save_workout(null, null, '2026-09-25', exercise_a, null, null, null, '[{"reps":-1}]');
    raise exception 'invalid create accepted';
  exception when check_violation then null;
  end;
  if (select count(*) from public.workouts) <> before_count then raise exception 'orphan workout after failed create'; end if;

  other_workout := public.save_workout(null, null, '2026-09-25', exercise_a, null, null, null, '[{"reps":5}]');
  select id into strict other_entry from public.workout_exercises where workout_id = other_workout;
  begin
    perform public.save_workout(workout_a, other_entry, '2026-09-25', exercise_a, null, null, null, '[{"reps":5}]');
    raise exception 'mismatched parent accepted';
  exception when raise_exception then
    if sqlerrm <> 'workout exercise not found' then raise; end if;
  end;

  perform public.save_workout(workout_a, entry_a, '2026-09-25', exercise_a, 'updated', null, null,
    '[{"weight_kg":25,"left_reps":8,"right_reps":9,"note":"new note"}]');
  if not exists(select 1 from public.sets where workout_exercise_id = entry_a and weight_kg = 25 and right_reps = 9) then
    raise exception 'valid update failed';
  end if;

  perform set_config('request.jwt.claim.sub', user_b::text, true);
  if exists(select 1 from public.workouts where id = workout_a) or exists(select 1 from public.sets where workout_exercise_id = entry_a) then
    raise exception 'cross-user read allowed';
  end if;
  begin
    perform public.save_workout(workout_a, entry_a, '2026-09-25', exercise_a, 'forbidden', null, null, '[{"reps":5}]');
    raise exception 'cross-user RPC allowed';
  exception when raise_exception then
    if sqlerrm <> 'exercise not found' then raise; end if;
  end;
  update public.sets set reps = 999 where workout_exercise_id = entry_a;
  if found then raise exception 'cross-user update allowed'; end if;
  delete from public.workouts where id = workout_a;
  if found then raise exception 'cross-user delete allowed'; end if;
  begin
    insert into public.sets(user_id, workout_exercise_id, set_number) values(user_a, entry_a, 99);
    raise exception 'cross-user insert allowed';
  exception when insufficient_privilege then null;
  end;
  if has_function_privilege('anon', 'public.save_workout(uuid,uuid,date,uuid,text,text,integer,jsonb)', 'execute') then
    raise exception 'anonymous RPC allowed';
  end if;
  execute 'reset role';
end;
$test$;
rollback;

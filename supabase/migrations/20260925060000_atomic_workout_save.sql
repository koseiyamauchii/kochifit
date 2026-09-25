begin;

-- One invocation is one transaction. RLS and table grants remain in force.
create function public.save_workout(
  p_workout_id uuid, p_workout_exercise_id uuid, p_workout_date date,
  p_exercise_id uuid, p_note text, p_condition text, p_elapsed_sec integer, p_sets jsonb
) returns uuid
language plpgsql security invoker set search_path = '' as $$
declare
  owner_id uuid := auth.uid();
  workout_id uuid := p_workout_id;
  entry_id uuid := p_workout_exercise_id;
begin
  if owner_id is null then raise exception 'authentication required'; end if;
  if p_workout_date is null or p_exercise_id is null then raise exception 'date and exercise required'; end if;
  if p_sets is null or jsonb_typeof(p_sets) <> 'array' then raise exception 'sets must be an array'; end if;
  if jsonb_array_length(p_sets) not between 1 and 200 then raise exception 'expected 1 to 200 sets'; end if;
  if exists (select 1 from jsonb_array_elements(p_sets) s where jsonb_typeof(s) <> 'object') then
    raise exception 'invalid set';
  end if;
  if not exists (select 1 from public.exercises where id = p_exercise_id and user_id = owner_id) then
    raise exception 'exercise not found';
  end if;

  if workout_id is null and entry_id is null then
    insert into public.workouts(user_id, workout_date, note)
      values(owner_id, p_workout_date, p_note) returning id into workout_id;
    insert into public.workout_exercises(user_id, workout_id, exercise_id, display_order, note, condition, elapsed_sec)
      values(owner_id, workout_id, p_exercise_id, 1, p_note, p_condition, p_elapsed_sec) returning id into entry_id;
  elsif workout_id is not null and entry_id is not null then
    -- Serialize writers before changing the parent or its sets.
    perform 1 from public.workouts where id = workout_id and user_id = owner_id for update;
    if not found then raise exception 'workout not found'; end if;
    perform 1 from public.workout_exercises
      where id = entry_id and user_id = owner_id and workout_exercises.workout_id = p_workout_id for update;
    if not found then raise exception 'workout exercise not found'; end if;
    update public.workouts set workout_date = p_workout_date, note = p_note where id = workout_id and user_id = owner_id;
    update public.workout_exercises set exercise_id = p_exercise_id, note = p_note, condition = p_condition, elapsed_sec = p_elapsed_sec
      where id = entry_id and user_id = owner_id;
    delete from public.sets where workout_exercise_id = entry_id and user_id = owner_id;
  else
    raise exception 'both record ids are required for an update';
  end if;

  -- Numeric casts and existing CHECK constraints reject invalid input; any
  -- failure here also rolls back the parent updates and deletion above.
  insert into public.sets(user_id, workout_exercise_id, set_number, weight_kg, reps,
    is_warmup, is_assisted, note, distance_km, duration_sec, speed_kmh, calories_kcal, left_reps, right_reps)
  select owner_id, entry_id, n::integer,
    (s->>'weight_kg')::numeric, (s->>'reps')::integer,
    coalesce((s->>'is_warmup')::boolean, false), coalesce((s->>'is_assisted')::boolean, false), s->>'note',
    (s->>'distance_km')::numeric, (s->>'duration_sec')::integer,
    (s->>'speed_kmh')::numeric, (s->>'calories_kcal')::numeric,
    (s->>'left_reps')::integer, (s->>'right_reps')::integer
  from jsonb_array_elements(p_sets) with ordinality as items(s, n);
  return workout_id;
end;
$$;
revoke all on function public.save_workout(uuid,uuid,date,uuid,text,text,integer,jsonb) from public, anon;
grant execute on function public.save_workout(uuid,uuid,date,uuid,text,text,integer,jsonb) to authenticated;
commit;

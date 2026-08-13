revoke all on all tables in schema public from public;
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant usage on schema public to authenticated;

grant select on table public.body_parts to authenticated;
grant select, insert, update on table public.profiles to authenticated;
grant select, insert, update, delete on table public.exercises to authenticated;
grant select, insert, update, delete on table public.workouts to authenticated;
grant select, insert, update, delete on table public.workout_exercises to authenticated;
grant select, insert, update, delete on table public.sets to authenticated;
grant select, insert, update, delete on table public.exercise_settings to authenticated;

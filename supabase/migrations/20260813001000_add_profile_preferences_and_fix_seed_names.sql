alter table public.profiles
  add column if not exists height_cm numeric(5, 1),
  add column if not exists body_weight_kg numeric(5, 1),
  add column if not exists age integer,
  add column if not exists sex text,
  add column if not exists training_split text,
  add column if not exists default_set_count integer not null default 5;

alter table public.profiles
  drop constraint if exists profiles_height_cm_range,
  add constraint profiles_height_cm_range check (height_cm is null or (height_cm >= 50 and height_cm <= 250));

alter table public.profiles
  drop constraint if exists profiles_body_weight_kg_range,
  add constraint profiles_body_weight_kg_range check (body_weight_kg is null or (body_weight_kg >= 20 and body_weight_kg <= 300));

alter table public.profiles
  drop constraint if exists profiles_age_range,
  add constraint profiles_age_range check (age is null or (age >= 1 and age <= 120));

alter table public.profiles
  drop constraint if exists profiles_sex_value,
  add constraint profiles_sex_value check (sex is null or sex in ('unspecified', 'male', 'female', 'other'));

alter table public.profiles
  drop constraint if exists profiles_default_set_count_range,
  add constraint profiles_default_set_count_range check (default_set_count >= 1 and default_set_count <= 10);

update public.body_parts
set display_name = corrected.display_name
from (
  values
    ('chest', '胸'),
    ('back', '背中'),
    ('legs', '脚'),
    ('shoulders', '肩'),
    ('arms', '腕'),
    ('abs', '腹筋'),
    ('cardio', '有酸素運動')
) as corrected(key, display_name)
where public.body_parts.key = corrected.key;

update public.exercises
set name = corrected.name
from (
  values
    ('chest_bench_press', 'ベンチプレス'),
    ('chest_incline_dumbbell_press', 'インクラインダンベルプレス'),
    ('chest_chest_press', 'チェストプレス'),
    ('chest_pec_fly', 'ペックフライ'),
    ('chest_cable_fly', 'ケーブルフライ'),
    ('back_lat_pulldown', 'ラットプルダウン'),
    ('back_pull_up', '懸垂'),
    ('back_seated_row', 'シーテッドロー'),
    ('back_one_hand_dumbbell_row', 'ワンハンドダンベルロー'),
    ('back_deadlift', 'デッドリフト'),
    ('legs_squat', 'スクワット'),
    ('legs_leg_press', 'レッグプレス'),
    ('legs_leg_extension', 'レッグエクステンション'),
    ('legs_leg_curl', 'レッグカール'),
    ('legs_calf_raise', 'カーフレイズ'),
    ('shoulders_shoulder_press', 'ショルダープレス'),
    ('shoulders_side_raise', 'サイドレイズ'),
    ('shoulders_rear_raise', 'リアレイズ'),
    ('shoulders_face_pull', 'フェイスプル'),
    ('arms_arm_curl', 'アームカール'),
    ('arms_incline_dumbbell_curl', 'インクラインダンベルカール'),
    ('arms_hammer_curl', 'ハンマーカール'),
    ('arms_triceps_pressdown', 'トライセプスプレスダウン'),
    ('arms_skull_crusher', 'スカルクラッシャー'),
    ('abs_crunch', 'クランチ'),
    ('abs_ab_roller', 'アブローラー'),
    ('abs_leg_raise', 'レッグレイズ'),
    ('cardio_treadmill', 'トレッドミル'),
    ('cardio_exercise_bike', 'エアロバイク'),
    ('cardio_cross_trainer', 'クロストレーナー')
) as corrected(seed_key, name)
where public.exercises.seed_key = corrected.seed_key;

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

revoke execute on function public.initialize_user(uuid, text, text) from public, anon, authenticated;

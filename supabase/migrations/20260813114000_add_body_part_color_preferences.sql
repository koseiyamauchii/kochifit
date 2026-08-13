alter table public.body_part_preferences
  add column if not exists color_key text;

alter table public.body_part_preferences
  drop constraint if exists body_part_preferences_color_key_length,
  add constraint body_part_preferences_color_key_length
    check (color_key is null or char_length(color_key) <= 32);

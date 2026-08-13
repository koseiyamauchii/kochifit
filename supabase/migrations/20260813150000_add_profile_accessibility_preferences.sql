alter table public.profiles
  add column if not exists theme_preference text not null default 'system',
  add column if not exists accent_preference text not null default 'gray';

alter table public.profiles
  drop constraint if exists profiles_theme_preference_value,
  add constraint profiles_theme_preference_value
    check (theme_preference in ('system', 'light', 'dark'));

alter table public.profiles
  drop constraint if exists profiles_accent_preference_value,
  add constraint profiles_accent_preference_value
    check (accent_preference in ('gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'));

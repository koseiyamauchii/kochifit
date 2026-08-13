import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const migrationSql = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260812180000_initial_supabase_schema.sql"),
  "utf8",
);
const grantTighteningMigrationSql = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260812221000_tighten_table_grants.sql"),
  "utf8",
);
const profilePreferencesMigrationSql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260813001000_add_profile_preferences_and_fix_seed_names.sql",
  ),
  "utf8",
);
const bodyPartPreferencesMigrationSql = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260813013000_add_body_part_preferences.sql"),
  "utf8",
);
const workoutGoalsMigrationSql = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260813030000_add_workout_goals.sql"),
  "utf8",
);
const goalDetailMigrationSql = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260813033000_add_goal_detail_text.sql"),
  "utf8",
);
const unsetGoalDateDefaultsMigrationSql = readFileSync(
  join(process.cwd(), "supabase", "migrations", "20260813034500_unset_goal_date_defaults.sql"),
  "utf8",
);
const bodyPartColorPreferencesMigrationSql = readFileSync(
  join(
    process.cwd(),
    "supabase",
    "migrations",
    "20260813114000_add_body_part_color_preferences.sql",
  ),
  "utf8",
);

describe("Supabase schema migration", () => {
  it("defines the required tables", () => {
    for (const table of [
      "profiles",
      "body_parts",
      "exercises",
      "workouts",
      "workout_exercises",
      "sets",
      "exercise_settings",
    ]) {
      expect(migrationSql).toContain(`create table public.${table}`);
    }
  });

  it("enables RLS and uses auth.uid for user-owned tables", () => {
    for (const table of [
      "profiles",
      "exercises",
      "workouts",
      "workout_exercises",
      "sets",
      "exercise_settings",
    ]) {
      expect(migrationSql).toContain(`alter table public.${table} enable row level security`);
    }

    expect(migrationSql).toContain("auth.uid() = user_id");
    expect(migrationSql).toContain("auth.uid() = id");
  });

  it("grants Data API access to authenticated users without exposing tables to anon", () => {
    expect(migrationSql).toContain("revoke all on all tables in schema public from anon");
    expect(migrationSql).toContain("grant select on table public.body_parts to authenticated");
    expect(migrationSql).toContain("grant select, insert, update on table public.profiles to authenticated");

    for (const table of ["exercises", "workouts", "workout_exercises", "sets", "exercise_settings"]) {
      expect(migrationSql).toContain(`grant select, insert, update, delete on table public.${table} to authenticated`);
    }

    expect(migrationSql).not.toContain("grant select on table public.body_parts to anon");
    expect(migrationSql).not.toContain("grant select, insert, update, delete on table public.profiles");
    expect(migrationSql).not.toContain('create policy "profiles delete own"');
  });

  it("tightens table grants to the intended Data API privileges", () => {
    expect(grantTighteningMigrationSql).toContain("revoke all on all tables in schema public from public");
    expect(grantTighteningMigrationSql).toContain("revoke all on all tables in schema public from anon");
    expect(grantTighteningMigrationSql).toContain("revoke all on all tables in schema public from authenticated");
    expect(grantTighteningMigrationSql).toContain("grant select on table public.body_parts to authenticated");
    expect(grantTighteningMigrationSql).toContain(
      "grant select, insert, update on table public.profiles to authenticated",
    );
    expect(grantTighteningMigrationSql).not.toContain("truncate");
    expect(grantTighteningMigrationSql).not.toContain("trigger");
    expect(grantTighteningMigrationSql).not.toContain("references");
  });

  it("seeds shared body parts and per-user initial exercises", () => {
    const initialExerciseSeedRows =
      migrationSql.match(/\('[a-z_]+', '[a-z0-9_]+', '[^']+', \d+\)/g) ?? [];

    expect(initialExerciseSeedRows).toHaveLength(30);

    for (const value of ["胸", "背中", "脚", "肩", "腕", "腹筋", "有酸素運動"]) {
      expect(migrationSql).toContain(value);
    }

    for (const value of ["ベンチプレス", "ラットプルダウン", "スクワット", "トレッドミル"]) {
      expect(migrationSql).toContain(value);
    }

    expect(migrationSql).toContain("create or replace function public.initialize_current_user");
    expect(migrationSql).toContain("create trigger on_auth_user_created");
    expect(migrationSql).toContain("seed_key text");
    expect(migrationSql).toContain("exercises_user_seed_key_unique_idx");
    expect(migrationSql).toContain("on conflict (user_id, seed_key) where seed_key is not null do nothing");
  });

  it("adds profile preferences and fixes Japanese seed display names", () => {
    for (const column of [
      "height_cm",
      "body_weight_kg",
      "age",
      "sex",
      "training_split",
      "default_set_count",
    ]) {
      expect(profilePreferencesMigrationSql).toContain(column);
    }

    for (const value of ["胸", "背中", "脚", "肩", "腕", "腹筋", "有酸素運動"]) {
      expect(profilePreferencesMigrationSql).toContain(value);
    }

    for (const value of ["ベンチプレス", "ラットプルダウン", "スクワット", "トレッドミル"]) {
      expect(profilePreferencesMigrationSql).toContain(value);
    }

    expect(profilePreferencesMigrationSql).toContain("create or replace function public.initialize_user");
  });

  it("adds per-user body part display order preferences", () => {
    expect(bodyPartPreferencesMigrationSql).toContain("create table if not exists public.body_part_preferences");
    expect(bodyPartPreferencesMigrationSql).toContain("unique (user_id, body_part_id)");
    expect(bodyPartPreferencesMigrationSql).toContain(
      "grant select, insert, update, delete on table public.body_part_preferences to authenticated",
    );
    expect(bodyPartPreferencesMigrationSql).toContain(
      "alter table public.body_part_preferences enable row level security",
    );
    expect(bodyPartPreferencesMigrationSql).toContain("auth.uid() = user_id");
  });

  it("adds profile purpose, final goal, and deadline goals", () => {
    for (const column of [
      "training_purpose text",
      "final_goal text",
      "one_month_goal_date date",
      "three_month_goal_date date",
      "one_year_goal_date date",
    ]) {
      expect(workoutGoalsMigrationSql).toContain(column);
    }

    expect(workoutGoalsMigrationSql).toContain("profiles_training_purpose_length");
    expect(workoutGoalsMigrationSql).toContain("profiles_final_goal_length");
  });

  it("adds profile deadline goal text", () => {
    for (const column of [
      "one_month_goal_text text",
      "three_month_goal_text text",
      "one_year_goal_text text",
    ]) {
      expect(goalDetailMigrationSql).toContain(column);
    }

    expect(goalDetailMigrationSql).toContain("profiles_one_month_goal_text_length");
    expect(goalDetailMigrationSql).toContain("profiles_three_month_goal_text_length");
    expect(goalDetailMigrationSql).toContain("profiles_one_year_goal_text_length");
  });

  it("keeps goal dates unset by default", () => {
    expect(unsetGoalDateDefaultsMigrationSql).toContain("alter column one_month_goal_date drop default");
    expect(unsetGoalDateDefaultsMigrationSql).toContain("alter column three_month_goal_date drop default");
    expect(unsetGoalDateDefaultsMigrationSql).toContain("alter column one_year_goal_date drop default");
  });

  it("adds per-user body part color preferences", () => {
    expect(bodyPartColorPreferencesMigrationSql).toContain("add column if not exists color_key text");
    expect(bodyPartColorPreferencesMigrationSql).toContain("body_part_preferences_color_key_length");
    expect(bodyPartColorPreferencesMigrationSql).toContain(
      "check (color_key is null or char_length(color_key) <= 32)",
    );
  });
});

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type GoalReviewRow = {
  id: string;
  user_id: string;
  goal_kind: string;
  goal_text: string;
  goal_deadline: string;
  period_start: string;
  achieved: boolean;
  achievement_percent: number;
  reflection: string;
  next_action: string;
  next_goal_text: string;
  next_goal_deadline: string;
  progress: Json;
  reviewed_at: string;
};

export interface Database {
  public: {
    Tables: {
      goal_reviews: {
        Row: GoalReviewRow;
        Insert: Omit<GoalReviewRow, "reviewed_at"> & { reviewed_at?: string };
        Update: Partial<GoalReviewRow>;
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          display_name: string | null;
          avatar_url: string | null;
          height_cm: number | null;
          body_weight_kg: number | null;
          age: number | null;
          sex: string | null;
          training_split: string | null;
          default_set_count: number;
          session_sort_order: string;
          training_purpose: string | null;
          final_goal: string | null;
          one_month_goal_date: string | null;
          one_month_goal_text: string | null;
          three_month_goal_date: string | null;
          three_month_goal_text: string | null;
          one_year_goal_date: string | null;
          one_year_goal_text: string | null;
          theme_preference: string;
          accent_preference: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          display_name?: string | null;
          avatar_url?: string | null;
          height_cm?: number | null;
          body_weight_kg?: number | null;
          age?: number | null;
          sex?: string | null;
          training_split?: string | null;
          default_set_count?: number;
          session_sort_order?: string;
          training_purpose?: string | null;
          final_goal?: string | null;
          one_month_goal_date?: string | null;
          one_month_goal_text?: string | null;
          three_month_goal_date?: string | null;
          three_month_goal_text?: string | null;
          one_year_goal_date?: string | null;
          one_year_goal_text?: string | null;
          theme_preference?: string;
          accent_preference?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          display_name?: string | null;
          avatar_url?: string | null;
          height_cm?: number | null;
          body_weight_kg?: number | null;
          age?: number | null;
          sex?: string | null;
          training_split?: string | null;
          default_set_count?: number;
          session_sort_order?: string;
          training_purpose?: string | null;
          final_goal?: string | null;
          one_month_goal_date?: string | null;
          one_month_goal_text?: string | null;
          three_month_goal_date?: string | null;
          three_month_goal_text?: string | null;
          one_year_goal_date?: string | null;
          one_year_goal_text?: string | null;
          theme_preference?: string;
          accent_preference?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      body_parts: {
        Row: {
          id: string;
          key: string;
          display_name: string;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          key: string;
          display_name: string;
          display_order: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          key?: string;
          display_name?: string;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      body_part_preferences: {
        Row: {
          id: string;
          user_id: string;
          body_part_id: string;
          display_order: number;
          color_key: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          body_part_id: string;
          display_order: number;
          color_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          body_part_id?: string;
          display_order?: number;
          color_key?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      exercises: {
        Row: {
          id: string;
          user_id: string;
          body_part_id: string;
          seed_key: string | null;
          name: string;
          display_order: number;
          active: boolean;
          archived_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          body_part_id: string;
          seed_key?: string | null;
          name: string;
          display_order: number;
          active?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          body_part_id?: string;
          seed_key?: string | null;
          name?: string;
          display_order?: number;
          active?: boolean;
          archived_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workouts: {
        Row: {
          id: string;
          user_id: string;
          workout_date: string;
          note: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_date: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          workout_date?: string;
          note?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      workout_exercises: {
        Row: {
          id: string;
          user_id: string;
          workout_id: string;
          exercise_id: string;
          display_order: number;
          note: string | null;
          condition: string | null;
          elapsed_sec: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_id: string;
          exercise_id: string;
          display_order: number;
          note?: string | null;
          condition?: string | null;
          elapsed_sec?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          workout_id?: string;
          exercise_id?: string;
          display_order?: number;
          note?: string | null;
          condition?: string | null;
          elapsed_sec?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{
          foreignKeyName: "workout_exercises_workout_owner_fk";
          columns: ["workout_id", "user_id"];
          isOneToOne: false;
          referencedRelation: "workouts";
          referencedColumns: ["id", "user_id"];
        }];
      };
      sets: {
        Row: {
          id: string;
          user_id: string;
          workout_exercise_id: string;
          set_number: number;
          weight_kg: number | null;
          reps: number | null;
          rir: number | null;
          rpe: number | null;
          is_warmup: boolean;
          is_assisted: boolean;
          note: string | null;
          duration_sec: number | null;
          distance_km: number | null;
          speed_kmh: number | null;
          calories_kcal: number | null;
          left_reps: number | null;
          right_reps: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          workout_exercise_id: string;
          set_number: number;
          weight_kg?: number | null;
          reps?: number | null;
          rir?: number | null;
          rpe?: number | null;
          is_warmup?: boolean;
          is_assisted?: boolean;
          note?: string | null;
          duration_sec?: number | null;
          distance_km?: number | null;
          speed_kmh?: number | null;
          calories_kcal?: number | null;
          left_reps?: number | null;
          right_reps?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          workout_exercise_id?: string;
          set_number?: number;
          weight_kg?: number | null;
          reps?: number | null;
          rir?: number | null;
          rpe?: number | null;
          is_warmup?: boolean;
          is_assisted?: boolean;
          note?: string | null;
          duration_sec?: number | null;
          distance_km?: number | null;
          speed_kmh?: number | null;
          calories_kcal?: number | null;
          left_reps?: number | null;
          right_reps?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [{
          foreignKeyName: "sets_workout_exercise_owner_fk";
          columns: ["workout_exercise_id", "user_id"];
          isOneToOne: false;
          referencedRelation: "workout_exercises";
          referencedColumns: ["id", "user_id"];
        }];
      };
      exercise_settings: {
        Row: {
          id: string;
          user_id: string;
          exercise_id: string;
          setting_key: string;
          setting_label: string;
          setting_value: string;
          display_order: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          exercise_id: string;
          setting_key: string;
          setting_label: string;
          setting_value: string;
          display_order: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          exercise_id?: string;
          setting_key?: string;
          setting_label?: string;
          setting_value?: string;
          display_order?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: {
      save_workout: {
        Args: {
          p_workout_id: string | null; p_workout_exercise_id: string | null;
          p_workout_date: string; p_exercise_id: string; p_note: string | null;
          p_condition: string | null; p_elapsed_sec: number | null; p_sets: Json;
        };
        Returns: string;
      };
      complete_goal_review: {
        Args: {
          p_id: string; p_goal_kind: string; p_goal_text: string; p_goal_deadline: string; p_period_start: string;
          p_achieved: boolean; p_achievement_percent: number; p_reflection: string; p_next_action: string;
          p_next_goal_text: string; p_next_goal_deadline: string; p_progress: Json;
        };
        Returns: string;
      };
      initialize_current_user: {
        Args: Record<string, never>;
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

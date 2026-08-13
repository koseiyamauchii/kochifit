export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
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
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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
          duration_sec: number | null;
          distance_km: number | null;
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
          duration_sec?: number | null;
          distance_km?: number | null;
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
          duration_sec?: number | null;
          distance_km?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
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

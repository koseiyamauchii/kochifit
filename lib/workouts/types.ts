export interface BodyPart {
  id: string;
  key: string;
  displayName: string;
  displayOrder: number;
  defaultDisplayOrder: number;
  colorKey: string;
}

export interface Exercise {
  id: string;
  bodyPartId: string;
  bodyPartKey: string | null;
  name: string;
  displayOrder: number;
  active: boolean;
  rackPosition: string | null;
  memo: string | null;
  defaultSetCount: number | null;
  bodyWeightEnabled: boolean;
  bilateralRepsEnabled: boolean;
  cardioMetrics: CardioMetric[];
}

export type CardioMetric = "distance" | "duration" | "speed" | "calories";

export interface WorkoutSummary {
  id: string;
  workoutDate: string;
  exerciseCount: number;
  setCount: number;
  bodyParts: Array<{ key: string; colorKey: string }>;
}

export interface WorkoutStats {
  totalWorkoutDays: number;
  monthWorkoutDays: number;
  weeklyAverageWorkoutDays: number;
  averageDailyCalories: number;
}

export interface BodyPartWorkoutDistribution {
  bodyPartId: string;
  bodyPartKey: string;
  bodyPartName: string;
  colorKey: string;
  workoutDays: number;
}

export interface WorkoutSet {
  id: string;
  setNumber: number;
  weightKg: number | null;
  reps: number | null;
  rir: number | null;
  isWarmup: boolean;
  isAssisted: boolean;
  note: string | null;
  distanceKm: number | null;
  durationSec: number | null;
  speedKmh: number | null;
  caloriesKcal: number | null;
  leftReps: number | null;
  rightReps: number | null;
}

export interface WorkoutExercise {
  id: string;
  exerciseId: string;
  exerciseName: string;
  workoutDate: string;
  displayOrder: number;
  note: string | null;
  condition: string | null;
  elapsedSec: number | null;
  sets: WorkoutSet[];
}

export interface Workout {
  id: string;
  workoutDate: string;
  createdAt: string;
  note: string | null;
  exercises: WorkoutExercise[];
}

export interface CreateWorkoutSetInput {
  weightKg: number | null;
  reps: number | null;
  isWarmup: boolean;
  isAssisted: boolean;
  note: string | null;
  distanceKm: number | null;
  durationSec: number | null;
  speedKmh: number | null;
  caloriesKcal: number | null;
  leftReps: number | null;
  rightReps: number | null;
}

export interface CreateWorkoutInput {
  userId: string;
  workoutDate: string;
  exerciseId: string;
  note: string | null;
  condition: string | null;
  elapsedSec: number | null;
  sets: CreateWorkoutSetInput[];
}

export interface UpdateWorkoutInput extends CreateWorkoutInput {
  workoutId: string;
  workoutExerciseId: string;
}

export interface ExerciseMasterInput {
  userId: string;
  bodyPartId: string;
  name: string;
  displayOrder: number;
  rackPosition: string | null;
  memo: string | null;
  defaultSetCount: number | null;
  bodyWeightEnabled: boolean;
  bilateralRepsEnabled: boolean;
  cardioMetrics: CardioMetric[];
}

export interface ExerciseRecord {
  exerciseId: string;
  bodyPartId: string;
  exerciseName: string;
  displayOrder: number;
  maxWeightKg: number | null;
  maxVolumeKg: number | null;
  lastWorkoutDate: string | null;
}

# Repository設計

## 目的

UIやドメインロジックからSupabaseのDB行やSDKレスポンスを直接広げすぎない．

Workout CRUDでは，DB行とドメイン型の変換境界を明確にする．

## 現在の実装

現在は，月別Workout summary，選択日Workout一覧，1種目単位のWorkout作成，Workout削除を実装する．

## 層構造

```text
UI
 ↓
Application Service
 ↓
Domain Model
 ↓
WorkoutRepository
 ↓
SupabaseWorkoutRepository
 ↓
Supabase PostgreSQL
```

## Repositoryインターフェース案

```ts
export interface WorkoutRepository {
  getBodyParts(): Promise<BodyPart[]>;

  getExercises(): Promise<Exercise[]>;
  createExercise(input: CreateExerciseInput): Promise<Exercise>;
  updateExercise(input: UpdateExerciseInput): Promise<Exercise>;
  archiveExercise(exerciseId: string): Promise<void>;
  reorderExercises(input: ReorderExerciseInput[]): Promise<void>;

  getWorkoutByDate(date: string): Promise<Workout[]>;
  createWorkout(input: CreateWorkoutInput): Promise<Workout>;
  updateWorkout(input: UpdateWorkoutInput): Promise<Workout>;
  deleteWorkout(workoutId: string): Promise<void>;

  getExerciseSettings(exerciseId: string): Promise<ExerciseSetting[]>;
  saveExerciseSettings(exerciseId: string, settings: ExerciseSettingInput[]): Promise<void>;
}
```

## Supabase固有の責務

`SupabaseWorkoutRepository` は以下を担当する．

* Supabase clientの受け取り
* RLS前提のクエリ発行
* DB行からドメイン型への変換
* ドメイン入力からDB行への変換
* PostgreSQL errorのRepository errorへの変換
* 認証切れ時のエラー整理

Service Role Keyは使用しない．

ブラウザからはpublishable keyとユーザーsessionでRLSを通す．

## Service層の責務

Service層は以下を担当する．

* 種目のアーカイブ判断
* workoutの日付別整列
* 前回記録の抽出
* 過去メモの抽出
* 最高重量と推定1RMの計算
* UI用ViewModelへの変換

## エラー型

```ts
export type RepositoryErrorCode =
  | "auth_required"
  | "not_found"
  | "validation"
  | "permission_denied"
  | "network"
  | "unknown";

export interface RepositoryError extends Error {
  code: RepositoryErrorCode;
  retryable: boolean;
}
```

RLS違反や他ユーザー行への操作は `permission_denied` として扱う．

楽観ロックは今回のPhaseでは実装しない．
